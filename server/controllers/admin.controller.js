import {
  authenticateAdmin,
  createAdminToken,
  revokeSession,
  registerAdmin,
  checkLoginRateLimit,
  recordFailedLoginAttempt,
  resetLoginRateLimit,
} from '../services/adminAuthService.js';
import { extractAdminToken } from '../middleware/adminAuth.js';
import { verifyAdminToken } from '../services/adminAuthService.js';
import { formRepository } from '../repositories/formRepository.js';
import { executeQuery, getOracleHealth } from '../database/oracle.js';
import { getTables } from '../services/databaseMetadataService.js';
import { logActivity, getRecentActivities } from '../services/activityLogService.js';

/**
 * Handles administrator login.
 * Validates credentials against Oracle ADMIN_USERS table with bcrypt.
 * 
 * POST /api/admin/login
 */
export async function login(req, res) {
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '127.0.0.1';

  // 1. Check rate limits
  const rateLimit = checkLoginRateLimit(clientIp);
  if (!rateLimit.allowed) {
    await logActivity({
      eventType: 'ADMIN_LOGIN_RATE_LIMITED',
      entityType: 'ADMIN',
      actorType: 'anonymous',
      actorName: req.body?.email || 'Unknown',
      description: `Rate limit triggered on admin login attempt from ${clientIp}`,
      ipAddress: clientIp,
      status: 'BLOCKED',
    });

    return res.status(429).json({
      success: false,
      error: `Too many failed login attempts. Please try again in ${Math.ceil((rateLimit.retryAfterSeconds || 60) / 60)} minutes.`,
      code: 'RATE_LIMITED',
      retryAfterSeconds: rateLimit.retryAfterSeconds,
    });
  }

  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: 'Email and password are required.',
    });
  }

  try {
    const authResult = await authenticateAdmin(email, password);

    if (!authResult.success) {
      recordFailedLoginAttempt(clientIp);
      await logActivity({
        eventType: 'ADMIN_LOGIN_FAILED',
        entityType: 'ADMIN',
        actorType: 'admin',
        actorName: email,
        description: `Failed login attempt for admin email "${email}": invalid credentials`,
        ipAddress: clientIp,
        status: 'FAILED',
      });

      return res.status(401).json({
        success: false,
        error: authResult.error || 'Invalid email or password.',
      });
    }

    // Reset failed attempts on success
    resetLoginRateLimit(clientIp);

    const admin = authResult.admin;
    const token = createAdminToken(admin);

    // Set secure HttpOnly cookie
    const isProduction = process.env.NODE_ENV === 'production' || req.secure;
    res.cookie('admin_token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 8 * 60 * 60 * 1000, // 8 hours
    });

    console.log(`[AdminAuth] Administrator "${admin.email}" (ID: ${admin.admin_id}) authenticated successfully from IP ${clientIp}`);

    await logActivity({
      eventType: 'ADMIN_LOGIN_SUCCESS',
      entityType: 'ADMIN',
      entityId: String(admin.admin_id),
      actorType: 'admin',
      actorId: String(admin.admin_id),
      actorName: admin.name,
      description: `Administrator "${admin.name}" (${admin.email}) authenticated successfully`,
      ipAddress: clientIp,
      status: 'SUCCESS',
    });

    return res.json({
      success: true,
      token,
      admin: {
        admin_id: admin.admin_id,
        name: admin.name,
        email: admin.email,
        created_at: admin.created_at,
      },
    });
  } catch (err) {
    console.error('[AdminController] Login exception:', err.message);
    return res.status(500).json({
      success: false,
      error: 'An internal server error occurred during authentication. Please try again.',
    });
  }
}

/**
 * Returns current authenticated administrator profile.
 * 
 * GET /api/admin/me
 */
export async function getMe(req, res) {
  if (!req.admin) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Not authenticated.',
    });
  }

  return res.json({
    success: true,
    admin: {
      admin_id: req.admin.admin_id,
      name: req.admin.name,
      email: req.admin.email,
      created_at: req.admin.created_at,
    },
  });
}

/**
 * Logs out the administrator, revokes session, and clears the cookie.
 * 
 * POST /api/admin/logout
 */
export async function logout(req, res) {
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '127.0.0.1';

  try {
    const token = extractAdminToken(req);
    if (token) {
      const decoded = verifyAdminToken(token);
      if (decoded.valid && decoded.admin?.sessionId) {
        revokeSession(decoded.admin.sessionId);
      }
    }

    if (req.admin) {
      await logActivity({
        eventType: 'ADMIN_LOGOUT',
        entityType: 'ADMIN',
        entityId: String(req.admin.admin_id),
        actorType: 'admin',
        actorId: String(req.admin.admin_id),
        actorName: req.admin.name,
        description: `Administrator "${req.admin.name}" logged out`,
        ipAddress: clientIp,
        status: 'SUCCESS',
      });
    }

    // Clear the cookie
    res.clearCookie('admin_token', {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
    });

    return res.json({
      success: true,
      message: 'Logged out successfully.',
    });
  } catch (err) {
    console.error('[AdminController] Logout error:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Error processing logout.',
    });
  }
}

/**
 * Registers a new administrator in Oracle ADMIN_USERS table.
 * Requires existing administrator authorization.
 * 
 * POST /api/admin/register
 */
export async function register(req, res) {
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '127.0.0.1';
  const { name, email, password } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({
      success: false,
      error: 'Name, email, and password are required.',
    });
  }

  try {
    const result = await registerAdmin({ name, email, password });
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }

    console.log(`[AdminAuth] New administrator "${result.admin.email}" registered by "${req.admin?.email || 'system'}"`);

    await logActivity({
      eventType: 'ADMIN_REGISTERED',
      entityType: 'ADMIN',
      entityId: String(result.admin.admin_id),
      actorType: 'admin',
      actorId: req.admin?.admin_id ? String(req.admin.admin_id) : 'system',
      actorName: req.admin?.name || 'Administrator',
      description: `Administrator account "${result.admin.email}" registered by ${req.admin?.name || 'Admin'}`,
      details: {
        registeredAdminId: result.admin.admin_id,
        registeredEmail: result.admin.email,
        registeredName: result.admin.name,
      },
      ipAddress: clientIp,
      status: 'SUCCESS',
    });

    return res.status(201).json({
      success: true,
      admin: result.admin,
      message: 'Administrator account registered successfully.',
    });
  } catch (err) {
    console.error('[AdminController] Registration error:', err.message);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to register administrator account.',
    });
  }
}

/**
 * Returns administrative metrics and overview data for the Admin Dashboard.
 * 
 * GET /api/admin/stats
 */
export async function getDashboardStats(req, res) {
  try {
    const forms = await formRepository.listForms();
    const publishedCount = forms.filter((f) => f.publishedAt || f.isPublished).length;
    const draftCount = forms.length - publishedCount;

    const dbHealth = await getOracleHealth();
    let allowlistedTables = [];
    try {
      allowlistedTables = await getTables();
    } catch {
      // ignore
    }

    // Extract unique departments configured across forms
    const deptsSet = new Set();
    forms.forEach((f) => {
      if (Array.isArray(f.settings?.departmentIds)) {
        f.settings.departmentIds.forEach((id) => deptsSet.add(String(id)));
      }
    });

    // Submissions metrics from Oracle Database
    const submissionStats = {
      totalSubmissions: 0,
      submissionsToday: 0,
      submissionsThisMonth: 0,
      distinctSubmittersCount: 0,
      totalAdminEdits: 0,
    };

    if (dbHealth.connected) {
      try {
        const subSql = `
          SELECT
            COUNT(*) AS TOTAL_SUBMISSIONS,
            COUNT(CASE WHEN CAST(SUBMITTED_AT AS DATE) = TRUNC(SYSDATE) THEN 1 END) AS SUBMISSIONS_TODAY,
            COUNT(CASE WHEN SUBMITTED_AT >= TRUNC(SYSDATE, 'MM') THEN 1 END) AS SUBMISSIONS_THIS_MONTH,
            COUNT(DISTINCT SUBMITTED_BY) AS DISTINCT_SUBMITTERS
          FROM FORMCRAFT_SUBMISSIONS
        `;
        const subRes = await executeQuery(subSql);
        if (subRes.rows && subRes.rows.length > 0) {
          const r = subRes.rows[0];
          submissionStats.totalSubmissions = Number(r.TOTAL_SUBMISSIONS) || 0;
          submissionStats.submissionsToday = Number(r.SUBMISSIONS_TODAY) || 0;
          submissionStats.submissionsThisMonth = Number(r.SUBMISSIONS_THIS_MONTH) || 0;
          submissionStats.distinctSubmittersCount = Number(r.DISTINCT_SUBMITTERS) || 0;
        }

        const editSql = 'SELECT COUNT(*) AS CNT FROM FORMCRAFT_SUBMISSION_EDITS';
        const editRes = await executeQuery(editSql);
        if (editRes.rows && editRes.rows.length > 0) {
          submissionStats.totalAdminEdits = Number(editRes.rows[0].CNT || editRes.rows[0].cnt) || 0;
        }
      } catch (subErr) {
        console.warn('[AdminController] Notice querying submission stats:', subErr.message);
      }
    }

    // Recent system activity timeline
    let recentActivities = [];
    try {
      recentActivities = await getRecentActivities(8);
    } catch {
      // ignore
    }

    return res.json({
      success: true,
      stats: {
        totalForms: forms.length,
        publishedForms: publishedCount,
        draftForms: draftCount,
        configuredDepartmentsCount: deptsSet.size,
        allowlistedTablesCount: allowlistedTables.length,
        totalSubmissions: submissionStats.totalSubmissions,
        submissionsToday: submissionStats.submissionsToday,
        submissionsThisMonth: submissionStats.submissionsThisMonth,
        distinctSubmittersCount: submissionStats.distinctSubmittersCount,
        totalAdminEdits: submissionStats.totalAdminEdits,
        recentActivities,
        database: {
          connected: dbHealth.connected,
          type: 'oracle',
          schema: process.env.DB_USER || 'moscmar18',
        },
        admin: {
          admin_id: req.admin.admin_id,
          name: req.admin.name,
          email: req.admin.email,
        },
      },
    });
  } catch (err) {
    console.error('[AdminController] Error gathering dashboard stats:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve administrative statistics.',
    });
  }
}

