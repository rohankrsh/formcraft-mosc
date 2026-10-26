import { executeQuery, getOracleHealth } from '../database/oracle.js';

/**
 * Sanitizes details payload so passwords, tokens, full confidential payloads
 * are never persisted into system activity logs.
 */
function sanitizeLogDetails(details) {
  if (!details) return null;
  if (typeof details !== 'object') return { info: String(details) };

  const sanitized = Array.isArray(details) ? [] : {};
  const forbiddenKeys = ['password', 'passwordhash', 'token', 'admin_token', 'cookie', 'authorization', 'secret'];

  for (const [key, val] of Object.entries(details)) {
    const lowerKey = key.toLowerCase();
    if (forbiddenKeys.some((f) => lowerKey.includes(f))) {
      sanitized[key] = '[REDACTED]';
    } else if (val && typeof val === 'object') {
      sanitized[key] = sanitizeLogDetails(val);
    } else {
      sanitized[key] = val;
    }
  }

  return sanitized;
}

/**
 * Helper to convert CLOB or string to parsed JSON.
 */
async function parseClobJson(clobOrStr) {
  if (!clobOrStr) return null;
  let str = '';
  if (typeof clobOrStr === 'string') {
    str = clobOrStr;
  } else if (clobOrStr && typeof clobOrStr.getData === 'function') {
    str = await clobOrStr.getData();
  } else {
    str = String(clobOrStr);
  }
  try {
    return JSON.parse(str);
  } catch {
    return { raw: str };
  }
}

/**
 * Normalizes Date into an ISO string.
 */
function toIso(val) {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString();
  return String(val);
}

/**
 * Logs a system-wide or administrative event to FORMCRAFT_ACTIVITY_LOGS.
 * 
 * @param {Object} entry
 * @param {string} entry.eventType - Event type (e.g., 'FORM_CREATED', 'FORM_PUBLISHED', 'SUBMISSION_CREATED', 'SUBMISSION_EDITED', 'ADMIN_LOGIN_SUCCESS')
 * @param {string} [entry.entityType] - Target entity ('FORM', 'SUBMISSION', 'ADMIN', 'SYSTEM')
 * @param {string} [entry.entityId] - Target ID
 * @param {string} [entry.actorType] - 'admin' | 'user' | 'system' | 'anonymous'
 * @param {string} [entry.actorId] - ID of actor
 * @param {string} [entry.actorName] - Display name of actor
 * @param {string} entry.description - Human-readable summary
 * @param {Object} [entry.details] - Safe contextual metadata
 * @param {string} [entry.ipAddress] - Client IP address
 * @param {string} [entry.status] - 'SUCCESS' | 'FAILED' | 'BLOCKED'
 */
export async function logActivity({
  eventType,
  entityType = null,
  entityId = null,
  actorType = 'system',
  actorId = null,
  actorName = 'System',
  description = '',
  details = null,
  ipAddress = null,
  status = 'SUCCESS',
}) {
  if (!eventType) return null;

  try {
    const health = await getOracleHealth();
    if (!health.connected) {
      console.warn(`[ActivityLog] Database offline: Event ${eventType} [${actorName}]: ${description}`);
      return null;
    }

    const safeDetails = sanitizeLogDetails(details);
    const detailsJson = safeDetails ? JSON.stringify(safeDetails) : null;

    const sql = `
      INSERT INTO FORMCRAFT_ACTIVITY_LOGS (
        EVENT_TYPE, ENTITY_TYPE, ENTITY_ID, ACTOR_TYPE, ACTOR_ID, ACTOR_NAME,
        DESCRIPTION, DETAILS_JSON, IP_ADDRESS, STATUS, CREATED_AT
      ) VALUES (
        :b_event, :b_entityType, :b_entityId, :b_actorType, :b_actorId, :b_actorName,
        :b_desc, :b_details, :b_ip, :b_status, SYSTIMESTAMP
      )
    `;

    const binds = {
      b_event: String(eventType).slice(0, 100),
      b_entityType: entityType ? String(entityType).slice(0, 100) : null,
      b_entityId: entityId ? String(entityId).slice(0, 255) : null,
      b_actorType: actorType ? String(actorType).slice(0, 50) : 'system',
      b_actorId: actorId ? String(actorId).slice(0, 255) : null,
      b_actorName: actorName ? String(actorName).slice(0, 255) : 'Unknown',
      b_desc: description ? String(description).slice(0, 1000) : '',
      b_details: detailsJson,
      b_ip: ipAddress ? String(ipAddress).slice(0, 100) : null,
      b_status: String(status || 'SUCCESS').slice(0, 50),
    };

    await executeQuery(sql, binds);
    return true;
  } catch (err) {
    console.error(`[ActivityLog] Failed to record audit log for event "${eventType}":`, err.message);
    return false;
  }
}

/**
 * Retrieves paginated system activity logs with search and filtering.
 */
export async function listActivityLogs({
  page = 1,
  pageSize = 20,
  search = '',
  eventType = '',
  actorType = '',
  entityType = '',
  entityId = '',
  status = '',
  startDate = '',
  endDate = '',
} = {}) {
  const p = Math.max(1, Number(page) || 1);
  const size = Math.min(100, Math.max(5, Number(pageSize) || 20));
  const offset = (p - 1) * size;

  const conditions = ['1=1'];
  const binds = {
    b_offset: offset,
    b_limit: size,
  };

  if (search && search.trim()) {
    conditions.push(`(
      UPPER(DESCRIPTION) LIKE :b_search
      OR UPPER(ACTOR_NAME) LIKE :b_search
      OR UPPER(EVENT_TYPE) LIKE :b_search
      OR UPPER(ENTITY_ID) LIKE :b_search
    )`);
    binds.b_search = `%${search.trim().toUpperCase()}%`;
  }

  if (eventType && eventType.trim()) {
    conditions.push('EVENT_TYPE = :b_event_type');
    binds.b_event_type = eventType.trim();
  }

  if (actorType && actorType.trim()) {
    conditions.push('ACTOR_TYPE = :b_actor_type');
    binds.b_actor_type = actorType.trim().toLowerCase();
  }

  if (entityType && entityType.trim()) {
    conditions.push('ENTITY_TYPE = :b_entity_type');
    binds.b_entity_type = entityType.trim().toUpperCase();
  }

  if (entityId && entityId.trim()) {
    conditions.push('ENTITY_ID = :b_entity_id');
    binds.b_entity_id = entityId.trim();
  }

  if (status && status.trim()) {
    conditions.push('STATUS = :b_status');
    binds.b_status = status.trim().toUpperCase();
  }

  if (startDate && startDate.trim()) {
    conditions.push('CREATED_AT >= TO_TIMESTAMP_TZ(:b_start_date, \'YYYY-MM-DD"T"HH24:MI:SS.FF3"Z"\')');
    try {
      binds.b_start_date = new Date(startDate).toISOString();
    } catch {
      delete binds.b_start_date;
      conditions.pop();
    }
  }

  if (endDate && endDate.trim()) {
    conditions.push('CREATED_AT <= TO_TIMESTAMP_TZ(:b_end_date, \'YYYY-MM-DD"T"HH24:MI:SS.FF3"Z"\')');
    try {
      const d = new Date(endDate);
      d.setHours(23, 59, 59, 999);
      binds.b_end_date = d.toISOString();
    } catch {
      delete binds.b_end_date;
      conditions.pop();
    }
  }

  const whereClause = conditions.join(' AND ');

  const sql = `
    SELECT
      LOG_ID,
      EVENT_TYPE,
      ENTITY_TYPE,
      ENTITY_ID,
      ACTOR_TYPE,
      ACTOR_ID,
      ACTOR_NAME,
      DESCRIPTION,
      DETAILS_JSON,
      IP_ADDRESS,
      STATUS,
      CREATED_AT,
      COUNT(*) OVER() AS TOTAL_COUNT
    FROM FORMCRAFT_ACTIVITY_LOGS
    WHERE ${whereClause}
    ORDER BY CREATED_AT DESC
    OFFSET :b_offset ROWS FETCH NEXT :b_limit ROWS ONLY
  `;

  const res = await executeQuery(sql, binds);
  const rows = res.rows || [];
  const total = rows.length > 0 ? Number(rows[0].TOTAL_COUNT || rows[0].total_count || 0) : 0;

  const logs = await Promise.all(
    rows.map(async (r) => {
      const details = await parseClobJson(r.DETAILS_JSON);
      return {
        logId: r.LOG_ID,
        eventType: r.EVENT_TYPE,
        entityType: r.ENTITY_TYPE,
        entityId: r.ENTITY_ID,
        actorType: r.ACTOR_TYPE,
        actorId: r.ACTOR_ID,
        actorName: r.ACTOR_NAME,
        description: r.DESCRIPTION,
        details,
        ipAddress: r.IP_ADDRESS,
        status: r.STATUS,
        createdAt: toIso(r.CREATED_AT),
      };
    })
  );

  return {
    logs,
    pagination: {
      page: p,
      pageSize: size,
      total,
      totalPages: Math.ceil(total / size) || 1,
    },
  };
}

/**
 * Retrieves a single log entry by its LOG_ID.
 */
export async function getActivityLogById(logId) {
  const numId = Number(logId);
  if (isNaN(numId)) return null;

  const sql = `
    SELECT
      LOG_ID,
      EVENT_TYPE,
      ENTITY_TYPE,
      ENTITY_ID,
      ACTOR_TYPE,
      ACTOR_ID,
      ACTOR_NAME,
      DESCRIPTION,
      DETAILS_JSON,
      IP_ADDRESS,
      STATUS,
      CREATED_AT
    FROM FORMCRAFT_ACTIVITY_LOGS
    WHERE LOG_ID = :b_id
  `;

  const res = await executeQuery(sql, { b_id: numId });
  if (!res.rows || res.rows.length === 0) return null;

  const r = res.rows[0];
  const details = await parseClobJson(r.DETAILS_JSON);

  return {
    logId: r.LOG_ID,
    eventType: r.EVENT_TYPE,
    entityType: r.ENTITY_TYPE,
    entityId: r.ENTITY_ID,
    actorType: r.ACTOR_TYPE,
    actorId: r.ACTOR_ID,
    actorName: r.ACTOR_NAME,
    description: r.DESCRIPTION,
    details,
    ipAddress: r.IP_ADDRESS,
    status: r.STATUS,
    createdAt: toIso(r.CREATED_AT),
  };
}

/**
 * Returns distinct event types present in the activity logs.
 */
export async function getDistinctEventTypes() {
  const sql = `
    SELECT DISTINCT EVENT_TYPE
    FROM FORMCRAFT_ACTIVITY_LOGS
    ORDER BY EVENT_TYPE ASC
  `;
  const res = await executeQuery(sql);
  return (res.rows || []).map((r) => r.EVENT_TYPE || r.event_type).filter(Boolean);
}

/**
 * Retrieves recent activities for dashboard widgets.
 */
export async function getRecentActivities(limit = 8) {
  const sql = `
    SELECT
      LOG_ID,
      EVENT_TYPE,
      ENTITY_TYPE,
      ENTITY_ID,
      ACTOR_TYPE,
      ACTOR_ID,
      ACTOR_NAME,
      DESCRIPTION,
      STATUS,
      CREATED_AT
    FROM FORMCRAFT_ACTIVITY_LOGS
    ORDER BY CREATED_AT DESC
    FETCH FIRST :b_limit ROWS ONLY
  `;

  const res = await executeQuery(sql, { b_limit: Number(limit) || 8 });
  return (res.rows || []).map((r) => ({
    logId: r.LOG_ID,
    eventType: r.EVENT_TYPE,
    entityType: r.ENTITY_TYPE,
    entityId: r.ENTITY_ID,
    actorType: r.ACTOR_TYPE,
    actorName: r.ACTOR_NAME,
    description: r.DESCRIPTION,
    status: r.STATUS,
    createdAt: toIso(r.CREATED_AT),
  }));
}
