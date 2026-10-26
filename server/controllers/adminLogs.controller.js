import {
  listActivityLogs,
  getActivityLogById,
  getDistinctEventTypes,
} from '../services/activityLogService.js';

/**
 * Retrieves paginated system activity logs with search, filter, and sorting.
 * 
 * GET /api/admin/logs
 */
export async function listLogs(req, res) {
  try {
    const {
      page,
      pageSize,
      search,
      eventType,
      actorType,
      entityType,
      entityId,
      status,
      startDate,
      endDate,
    } = req.query;

    const result = await listActivityLogs({
      page,
      pageSize,
      search,
      eventType,
      actorType,
      entityType,
      entityId,
      status,
      startDate,
      endDate,
    });

    return res.json({
      success: true,
      logs: result.logs,
      pagination: result.pagination,
    });
  } catch (err) {
    console.error('[AdminLogsController] listLogs error:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve system activity logs.',
    });
  }
}

/**
 * Retrieves a single activity log entry.
 * 
 * GET /api/admin/logs/:logId
 */
export async function getLogDetail(req, res) {
  const { logId } = req.params;
  try {
    const log = await getActivityLogById(logId);
    if (!log) {
      return res.status(404).json({
        success: false,
        error: `Activity log #${logId} not found.`,
      });
    }

    return res.json({
      success: true,
      log,
    });
  } catch (err) {
    console.error(`[AdminLogsController] getLogDetail(${logId}) error:`, err.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve activity log detail.',
    });
  }
}

/**
 * Returns distinct event types for frontend filtering dropdowns.
 * 
 * GET /api/admin/logs/event-types
 */
export async function getEventTypes(req, res) {
  try {
    const types = await getDistinctEventTypes();
    return res.json({
      success: true,
      eventTypes: types,
    });
  } catch (err) {
    console.error('[AdminLogsController] getEventTypes error:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve event types.',
    });
  }
}
