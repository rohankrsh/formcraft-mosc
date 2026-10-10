/**
 * Authentication Gate for Oracle Database and Form Data Routes.
 * Checks for a valid secret token in `x-api-key` or `Authorization: Bearer <token>`.
 */
export function requireAuth(req, res, next) {
  const configuredSecret = process.env.AUTH_SECRET || 'formcraft_secret_key_2026';

  const authHeader = req.headers['authorization'];
  const apiKeyHeader = req.headers['x-api-key'];

  let providedToken = apiKeyHeader;

  if (!providedToken && authHeader) {
    if (authHeader.startsWith('Bearer ')) {
      providedToken = authHeader.substring(7).trim();
    } else {
      providedToken = authHeader.trim();
    }
  }

  if (!providedToken || providedToken !== configuredSecret) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized access. A valid API key is required.',
    });
  }

  next();
}
