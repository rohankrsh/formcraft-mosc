import * as userService from '../services/userService.js';

/**
 * Handles GET /api/users/:userId/staff-details
 */
export async function getStaffDetails(req, res) {
  const { userId } = req.params;

  try {
    const details = await userService.getStaffDetails(userId);
    return res.json(details);
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({
      success: false,
      code: err.code || 'STAFF_DETAILS_ERROR',
      error: status === 500 ? 'An unexpected error occurred while retrieving staff details.' : err.message,
    });
  }
}
