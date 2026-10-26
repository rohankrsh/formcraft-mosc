import { executeQuery, getOracleHealth } from '../database/oracle.js';

/**
 * Retrieves staff details for a given HISUSER.ID from Oracle Database.
 * Joins with the EMPLOYEE table using EMPLOYEE_ID when available to resolve
 * the full canonical staff display name (EMPLOYEE.EMPLOYEE_NAME).
 */
export async function getStaffDetails(userId) {
  if (userId === undefined || userId === null || String(userId).trim() === '') {
    const err = new Error('User ID parameter is required.');
    err.status = 400;
    err.code = 'INVALID_USER_ID';
    throw err;
  }

  const strId = String(userId).trim();
  let decoded = strId;
  try {
    decoded = decodeURIComponent(strId).trim();
  } catch {
    // If decoding fails, continue with trimmed string
  }

  // Matches one or more digits, with at most one optional trailing colon (HIS integration delimiter)
  const match = decoded.match(/^(\d+):?$/);
  if (!match) {
    const err = new Error('Invalid User ID. Must be a positive integer identifier.');
    err.status = 400;
    err.code = 'INVALID_USER_ID';
    throw err;
  }

  const numId = parseInt(match[1], 10);
  if (isNaN(numId) || !Number.isInteger(numId) || numId <= 0) {
    const err = new Error('Invalid User ID. Must be a positive integer identifier.');
    err.status = 400;
    err.code = 'INVALID_USER_ID';
    throw err;
  }

  const health = await getOracleHealth();
  if (!health.connected) {
    const { initOraclePool } = await import('../database/oracle.js');
    await initOraclePool();
  }

  const sql = `
    SELECT 
      u.ID AS USER_ID,
      u.LOGIN,
      u.USERNAME,
      u.EMAILID,
      u.EMPLOYEE_ID,
      u.GLOBALDEPARTMENT,
      u.GLOBALSERVICECENTER,
      u.ISACTIVE,
      e.EMPLOYEE_NAME,
      e.EMPNO,
      e.FIRSTNAME,
      e.LASTNAME,
      e.EMAIL AS EMP_EMAIL,
      l.LOOKUPVALUE AS DESIGNATION_NAME
    FROM HISUSER u
    LEFT JOIN EMPLOYEE e ON u.EMPLOYEE_ID = e.EMPLOYEE_ID
    LEFT JOIN LOOKUPENTITY l ON e.DESIGNATION = l.LOOKUPID
    WHERE u.ID = :b_user_id
  `;

  let res;
  try {
    res = await executeQuery(sql, { b_user_id: numId });
  } catch (dbErr) {
    console.error(`[UserService] Error querying staff details for user ${numId}:`, dbErr.message);
    const err = new Error('Database query failed while retrieving user staff details.');
    err.status = 500;
    err.code = 'DATABASE_ERROR';
    throw err;
  }

  if (!res.rows || res.rows.length === 0) {
    const err = new Error(`User with ID ${numId} was not found in the hospital system.`);
    err.status = 404;
    err.code = 'USER_NOT_FOUND';
    throw err;
  }

  const row = res.rows[0];

  // Inactive account check according to HIS rules
  if (row.ISACTIVE !== 1) {
    const err = new Error(`User account for ID ${numId} is inactive.`);
    err.status = 403;
    err.code = 'USER_INACTIVE';
    throw err;
  }

  // Prefer full employee name from EMPLOYEE master table, falling back to USERNAME or LOGIN
  let staffName = '';
  if (row.EMPLOYEE_NAME && typeof row.EMPLOYEE_NAME === 'string') {
    staffName = row.EMPLOYEE_NAME.trim();
  } else if (row.FIRSTNAME && typeof row.FIRSTNAME === 'string') {
    const first = row.FIRSTNAME.trim();
    const last = (row.LASTNAME || '').trim();
    staffName = `${first} ${last}`.trim();
  }

  if (!staffName && row.USERNAME && typeof row.USERNAME === 'string') {
    staffName = row.USERNAME.trim();
  }

  if (!staffName && row.LOGIN && typeof row.LOGIN === 'string') {
    staffName = row.LOGIN.trim();
  }

  // Clean trailing dot formatting (e.g. "ADMIN ." -> "ADMIN")
  staffName = staffName.replace(/\s+\.$/, '').trim();

  const resolvedEmail = (row.EMAILID ? String(row.EMAILID).trim() : null) ||
    (row.EMP_EMAIL ? String(row.EMP_EMAIL).trim() : null);

  return {
    success: true,
    user_id: row.USER_ID,
    staff_name: staffName,
    employee_id: row.EMPLOYEE_ID ?? null,
    emp_no: row.EMPNO ? String(row.EMPNO).trim() : null,
    login: row.LOGIN ? String(row.LOGIN).trim() : null,
    username: row.USERNAME ? String(row.USERNAME).trim() : null,
    email: resolvedEmail || null,
    designation: row.DESIGNATION_NAME ? String(row.DESIGNATION_NAME).trim() : null,
    global_department: row.GLOBALDEPARTMENT ?? null,
    global_service_center: row.GLOBALSERVICECENTER ?? null,
  };
}
