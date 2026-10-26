import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { executeQuery } from '../database/oracle.js';

// Secret used for HMAC-SHA256 session token signatures
const AUTH_SECRET = process.env.AUTH_SECRET || process.env.JWT_SECRET || 'formcraft_admin_secret_key_2026_mosc';

// In-memory revoked session set (auto-pruned)
const revokedSessions = new Set();

// Rate-limiting map for login attempts by IP: ip -> { count, firstAttempt, lockedUntil }
const loginRateLimitMap = new Map();
const MAX_FAILED_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;  // 15 minutes

/**
 * Checks rate limit for a client IP.
 * @param {string} ip
 * @returns {{ allowed: boolean, remainingAttempts: number, retryAfterSeconds?: number }}
 */
export function checkLoginRateLimit(ip) {
  const now = Date.now();
  const clientKey = ip || 'unknown-client';
  const record = loginRateLimitMap.get(clientKey);

  if (!record) {
    return { allowed: true, remainingAttempts: MAX_FAILED_ATTEMPTS };
  }

  // Check if locked out
  if (record.lockedUntil && record.lockedUntil > now) {
    const retryAfterSeconds = Math.ceil((record.lockedUntil - now) / 1000);
    return { allowed: false, remainingAttempts: 0, retryAfterSeconds };
  }

  // Check if window has expired
  if (now - record.firstAttempt > RATE_LIMIT_WINDOW_MS) {
    loginRateLimitMap.delete(clientKey);
    return { allowed: true, remainingAttempts: MAX_FAILED_ATTEMPTS };
  }

  const remainingAttempts = Math.max(0, MAX_FAILED_ATTEMPTS - record.count);
  if (record.count >= MAX_FAILED_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_DURATION_MS;
    return { allowed: false, remainingAttempts: 0, retryAfterSeconds: Math.ceil(LOCKOUT_DURATION_MS / 1000) };
  }

  return { allowed: true, remainingAttempts };
}

/**
 * Records a failed login attempt for an IP.
 * @param {string} ip
 */
export function recordFailedLoginAttempt(ip) {
  const now = Date.now();
  const clientKey = ip || 'unknown-client';
  const record = loginRateLimitMap.get(clientKey);

  if (!record) {
    loginRateLimitMap.set(clientKey, {
      count: 1,
      firstAttempt: now,
      lockedUntil: null,
    });
    return;
  }

  if (now - record.firstAttempt > RATE_LIMIT_WINDOW_MS) {
    record.count = 1;
    record.firstAttempt = now;
    record.lockedUntil = null;
  } else {
    record.count += 1;
    if (record.count >= MAX_FAILED_ATTEMPTS) {
      record.lockedUntil = now + LOCKOUT_DURATION_MS;
    }
  }
}

/**
 * Resets failed login attempts for an IP upon successful authentication.
 * @param {string} ip
 */
export function resetLoginRateLimit(ip) {
  const clientKey = ip || 'unknown-client';
  loginRateLimitMap.delete(clientKey);
}

/**
 * Creates a cryptographically signed session token for an authenticated administrator.
 * Format: base64url(payload).signature
 * 
 * @param {{ admin_id: number, name: string, email: string }} admin
 * @param {number} expiresInMs
 * @returns {string} Signed token
 */
export function createAdminToken(admin, expiresInMs = 8 * 60 * 60 * 1000) {
  const sessionId = crypto.randomUUID();
  const payload = {
    adminId: admin.admin_id,
    name: admin.name,
    email: admin.email,
    sessionId,
    iat: Date.now(),
    exp: Date.now() + expiresInMs,
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(payloadB64)
    .digest('base64url');

  return `${payloadB64}.${signature}`;
}

/**
 * Verifies and decodes an admin session token.
 * Validates HMAC signature, expiration timestamp, and session revocation status.
 * 
 * @param {string} token
 * @returns {{ valid: boolean, admin?: { adminId: number, name: string, email: string, sessionId: string }, error?: string }}
 */
export function verifyAdminToken(token) {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Token missing or invalid format' };
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return { valid: false, error: 'Invalid token structure' };
  }

  const [payloadB64, signature] = parts;

  // Constant-time signature verification
  const expectedSignature = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(payloadB64)
    .digest('base64url');

  if (signature.length !== expectedSignature.length) {
    return { valid: false, error: 'Invalid token signature' };
  }

  const sigBuffer = Buffer.from(signature, 'utf8');
  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

  if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return { valid: false, error: 'Invalid token signature' };
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));

    // Check expiration
    if (!payload.exp || Date.now() > payload.exp) {
      return { valid: false, error: 'Session expired' };
    }

    // Check if session has been revoked
    if (payload.sessionId && revokedSessions.has(payload.sessionId)) {
      return { valid: false, error: 'Session has been revoked' };
    }

    return {
      valid: true,
      admin: {
        adminId: payload.adminId,
        name: payload.name,
        email: payload.email,
        sessionId: payload.sessionId,
      },
    };
  } catch (err) {
    return { valid: false, error: 'Failed to parse session payload' };
  }
}

/**
 * Revokes an active session ID so that future requests with this token are rejected.
 * @param {string} sessionId
 */
export function revokeSession(sessionId) {
  if (sessionId) {
    revokedSessions.add(sessionId);
    // Cleanup old revoked sessions periodically
    if (revokedSessions.size > 10000) {
      revokedSessions.clear();
    }
  }
}

/**
 * Authenticates administrator credentials against the existing Oracle ADMIN_USERS table.
 * 
 * Queries:
 *   SELECT admin_id, name, email, password, created_at
 *   FROM admin_users
 *   WHERE LOWER(email) = :email
 * 
 * Verifies the password using bcrypt.compare.
 * 
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ success: boolean, admin?: { admin_id: number, name: string, email: string, created_at: string }, error?: string }>}
 */
export async function authenticateAdmin(email, password) {
  if (!email || !password) {
    return { success: false, error: 'Email and password are required.' };
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return { success: false, error: 'Please enter a valid email address.' };
  }

  try {
    const query = `
      SELECT admin_id, name, email, password, created_at
      FROM admin_users
      WHERE LOWER(email) = :email
    `;

    const result = await executeQuery(query, { email: normalizedEmail });

    if (!result || !result.rows || result.rows.length === 0) {
      // Avoid leaking account existence: use generic error
      return { success: false, error: 'Invalid email or password.' };
    }

    const row = result.rows[0];
    const storedHash = row.PASSWORD;

    if (!storedHash) {
      return { success: false, error: 'Invalid email or password.' };
    }

    // Secure bcrypt comparison
    const isMatch = await bcrypt.compare(password, storedHash);
    if (!isMatch) {
      return { success: false, error: 'Invalid email or password.' };
    }

    // Success: return sanitized admin profile (EXCLUDES password)
    return {
      success: true,
      admin: {
        admin_id: Number(row.ADMIN_ID),
        name: row.NAME,
        email: row.EMAIL,
        created_at: row.CREATED_AT,
      },
    };
  } catch (err) {
    console.error('[AdminAuthService] Database error during authentication:', err.message);
    throw new Error('Database authentication service error. Please try again later.');
  }
}

/**
 * Retrieves an administrator profile by admin_id from Oracle ADMIN_USERS.
 * @param {number} adminId
 * @returns {Promise<{ admin_id: number, name: string, email: string, created_at: string } | null>}
 */
export async function getAdminById(adminId) {
  if (!adminId) return null;

  try {
    const query = `
      SELECT admin_id, name, email, created_at
      FROM admin_users
      WHERE admin_id = :adminId
    `;

    const result = await executeQuery(query, { adminId: Number(adminId) });
    if (!result || !result.rows || result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      admin_id: Number(row.ADMIN_ID),
      name: row.NAME,
      email: row.EMAIL,
      created_at: row.CREATED_AT,
    };
  } catch (err) {
    console.error('[AdminAuthService] Error fetching admin by ID:', err.message);
    return null;
  }
}

/**
 * Registers a new administrator in Oracle ADMIN_USERS table with a bcrypt-hashed password.
 * 
 * @param {{ name: string, email: string, password: string }} param0
 * @returns {Promise<{ success: boolean, admin?: { admin_id: number, name: string, email: string }, error?: string }>}
 */
export async function registerAdmin({ name, email, password }) {
  if (!name || !name.trim()) {
    return { success: false, error: 'Admin name is required.' };
  }
  if (!email || !password) {
    return { success: false, error: 'Email and password are required.' };
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return { success: false, error: 'Please enter a valid email address.' };
  }

  if (password.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters in length.' };
  }

  try {
    // Check if email already exists
    const checkQuery = `SELECT admin_id FROM admin_users WHERE LOWER(email) = :email`;
    const checkRes = await executeQuery(checkQuery, { email: normalizedEmail });
    if (checkRes.rows && checkRes.rows.length > 0) {
      return { success: false, error: 'An administrator account with this email already exists.' };
    }

    // Hash password using bcrypt cost factor 12 (matching existing format)
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const insertQuery = `
      INSERT INTO admin_users (name, email, password)
      VALUES (:name, :email, :password)
    `;

    await executeQuery(insertQuery, {
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
    });

    // Fetch the newly created record
    const fetchQuery = `
      SELECT admin_id, name, email, created_at
      FROM admin_users
      WHERE LOWER(email) = :email
    `;
    const fetchRes = await executeQuery(fetchQuery, { email: normalizedEmail });
    const row = fetchRes.rows[0];

    return {
      success: true,
      admin: {
        admin_id: Number(row.ADMIN_ID),
        name: row.NAME,
        email: row.EMAIL,
        created_at: row.CREATED_AT,
      },
    };
  } catch (err) {
    console.error('[AdminAuthService] Error registering admin:', err.message);
    throw new Error('Failed to register administrator account in database.');
  }
}
