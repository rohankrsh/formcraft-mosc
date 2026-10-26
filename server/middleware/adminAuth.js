import { verifyAdminToken, getAdminById } from '../services/adminAuthService.js';
import { logActivity } from '../services/activityLogService.js';

/**
 * Extracts the admin token from an incoming Express request.
 * Prioritizes HttpOnly cookies ('admin_token'), falling back to the Authorization Bearer header.
 * 
 * @param {import('express').Request} req
 * @returns {string | null}
 */
export function extractAdminToken(req) {
  if (!req) return null;

  // 1. Check parsed cookie via cookie-parser
  if (req.cookies && req.cookies.admin_token) {
    return req.cookies.admin_token;
  }

  // 2. Fallback to raw Cookie header if cookie-parser is not used
  const rawCookie = req.headers.cookie;
  if (rawCookie) {
    const match = rawCookie.match(/(?:^|;\s*)admin_token=([^;]+)/);
    if (match) {
      return decodeURIComponent(match[1]);
    }
  }

  // 3. Fallback to Authorization: Bearer <token>
  const authHeader = req.headers.authorization;
  if (authHeader && typeof authHeader === 'string') {
    if (authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7).trim();
    }
    return authHeader.trim();
  }

  return null;
}

/**
 * Middleware that strictly requires valid administrator authentication.
 * 
 * Rejects unauthenticated requests with 401.
 * If verified, attaches `req.admin` containing admin details and sets `req.headers['x-user-role'] = 'admin'`.
 */
export async function requireAdminAuth(req, res, next) {
  const token = extractAdminToken(req);
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '127.0.0.1';

  if (!token) {
    await logActivity({
      eventType: 'UNAUTHORIZED_ACCESS_ATTEMPT',
      entityType: 'ADMIN_PORTAL',
      entityId: req.originalUrl,
      actorType: 'anonymous',
      description: `Unauthorized access attempt to ${req.method} ${req.originalUrl} without credentials`,
      ipAddress: clientIp,
      status: 'BLOCKED',
    });

    return res.status(401).json({
      success: false,
      error: 'Authentication required. Please log in to access the administrator portal.',
      code: 'AUTH_REQUIRED',
    });
  }

  const verification = verifyAdminToken(token);
  if (!verification.valid || !verification.admin) {
    await logActivity({
      eventType: 'UNAUTHORIZED_ACCESS_ATTEMPT',
      entityType: 'ADMIN_PORTAL',
      entityId: req.originalUrl,
      actorType: 'anonymous',
      description: `Access attempt to ${req.method} ${req.originalUrl} with invalid or expired token`,
      ipAddress: clientIp,
      status: 'BLOCKED',
    });

    return res.status(401).json({
      success: false,
      error: verification.error || 'Your admin session has expired or is invalid. Please log in again.',
      code: 'SESSION_EXPIRED',
    });
  }

  // Verify that the administrator still exists in Oracle
  try {
    const adminRecord = await getAdminById(verification.admin.adminId);
    if (!adminRecord) {
      return res.status(401).json({
        success: false,
        error: 'Administrator account no longer exists.',
        code: 'ACCOUNT_NOT_FOUND',
      });
    }

    // Attach verified admin to request object
    req.admin = {
      admin_id: adminRecord.admin_id,
      name: adminRecord.name,
      email: adminRecord.email,
      created_at: adminRecord.created_at,
      sessionId: verification.admin.sessionId,
    };

    // Propagate admin role header so internal permission checks like isUserAdmin(req) pass
    req.headers['x-user-role'] = 'admin';
    req.headers['x-role'] = 'admin';

    next();
  } catch (err) {
    console.error('[requireAdminAuth] Error validating administrator record:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Internal authentication validation failure.',
    });
  }
}
