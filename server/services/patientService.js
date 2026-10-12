import { executeQuery } from '../database/oracle.js';

/**
 * Builds the base SQL query matching the mandatory specification:
 * Preserves the SELECT expressions, table joins, and WHERE condition VISIT_PATIENTSTATUS = 387.
 */
const BASE_PATIENT_SQL = `
SELECT
    p.mrno AS mrno,
    px.PREFIX || '.' || p.patientname AS patient_name,
    i.ADMISSIONDATE AS admission_date,
    b.BED_NO AS bed_no,
    i.ADMISSIONNUMBER AS admission_number,

    p.age || ' ' ||
    (
        CASE
            WHEN p.AGEUNIT = 1 THEN 'Years'
            WHEN p.AGEUNIT = 2 THEN 'Months'
            WHEN p.AGEUNIT = 3 THEN 'Days'
        END
    ) AS age,

    g.lookupvalue AS gender,

    'Dr.' || dr.employee_name AS consultant,

    hDept.DEPARTMENT_NAME AS department_name,

    c.SERVICE_CENTER_NAME AS service_center,

    p.MOBILENO AS mobile_no,

    hDept.DEPARTMENT_ID AS department_id,
    c.SERVICE_CENTER_ID AS service_center_id

FROM inpatients i

INNER JOIN patient p
    ON p.PATIENT_ID = i.patient

INNER JOIN bed b
    ON b.bed_id = i.bed

INNER JOIN prefix_master px
    ON px.id = p.PATPREFIX

INNER JOIN servicecenter c
    ON i.SERVICECENTER = c.SERVICE_CENTER_ID

LEFT JOIN lookupentity g
    ON g.lookupid = p.genderid

INNER JOIN employee dr
    ON dr.EMPLOYEE_ID = i.ADMITTINGDOCTOR

INNER JOIN HISDEPARTMENT hDept
    ON hDept.DEPARTMENT_ID = dr.DEPARTMENT_ID

WHERE i.VISIT_PATIENTSTATUS = 387
`;

const BASE_COUNT_SQL = `
SELECT COUNT(*) AS total_count
FROM inpatients i

INNER JOIN patient p
    ON p.PATIENT_ID = i.patient

INNER JOIN bed b
    ON b.bed_id = i.bed

INNER JOIN prefix_master px
    ON px.id = p.PATPREFIX

INNER JOIN servicecenter c
    ON i.SERVICECENTER = c.SERVICE_CENTER_ID

LEFT JOIN lookupentity g
    ON g.lookupid = p.genderid

INNER JOIN employee dr
    ON dr.EMPLOYEE_ID = i.ADMITTINGDOCTOR

INNER JOIN HISDEPARTMENT hDept
    ON hDept.DEPARTMENT_ID = dr.DEPARTMENT_ID

WHERE i.VISIT_PATIENTSTATUS = 387
`;

/**
 * Formats date into YYYY-MM-DD or readable ISO format.
 */
function formatDate(val) {
  if (!val) return '';
  if (val instanceof Date) {
    return val.toISOString().split('T')[0];
  }
  const str = String(val);
  return str.split('T')[0];
}

/**
 * Normalizes raw Oracle row object into clean camelCase Patient structure.
 */
function mapPatientRow(row) {
  return {
    mrno: row.MRNO != null ? String(row.MRNO) : '',
    patientName: row.PATIENT_NAME || '',
    admissionDate: formatDate(row.ADMISSION_DATE),
    bedNo: row.BED_NO != null ? String(row.BED_NO) : '',
    admissionNumber: row.ADMISSION_NUMBER != null ? String(row.ADMISSION_NUMBER) : '',
    age: row.AGE != null ? String(row.AGE).trim() : '',
    gender: row.GENDER || '',
    consultant: row.CONSULTANT || '',
    departmentName: row.DEPARTMENT_NAME || '',
    serviceCenter: row.SERVICE_CENTER || '',
    mobileNo: row.MOBILE_NO != null ? String(row.MOBILE_NO) : '',
    departmentId: row.DEPARTMENT_ID != null ? String(row.DEPARTMENT_ID) : '',
    serviceCenterId: row.SERVICE_CENTER_ID != null ? String(row.SERVICE_CENTER_ID) : '',
  };
}

/**
 * Fetches patients matching criteria with server-side filtering and pagination.
 *
 * @param {Object} params
 * @param {string} [params.departmentId]
 * @param {string} [params.serviceCenterId]
 * @param {string} [params.search]
 * @param {number} [params.page=1]
 * @param {number} [params.limit=25]
 */
export async function getPatients({
  department,
  departmentId,
  serviceCenter,
  serviceCenterId,
  search,
  page = 1,
  limit = 25,
}) {
  const binds = {};
  let whereClauses = '';

  const rawDept = (department ?? departmentId ?? '').toString().trim();
  if (rawDept && rawDept.toLowerCase() !== 'all') {
    const isDeptNumeric = /^\d+$/.test(rawDept);
    if (isDeptNumeric) {
      whereClauses += ` AND (
        hDept.DEPARTMENT_ID = :deptIdNum
        OR UPPER(TRIM(hDept.DEPARTMENT_NAME)) = :deptParamUpper
        OR UPPER(TRIM(hDept.DEPARTMENT_CODE)) = :deptParamUpper
      )`;
      binds.deptIdNum = Number(rawDept);
      binds.deptParamUpper = rawDept.toUpperCase();
    } else {
      whereClauses += ` AND (
        UPPER(TRIM(hDept.DEPARTMENT_NAME)) = :deptParamUpper
        OR UPPER(TRIM(hDept.DEPARTMENT_CODE)) = :deptParamUpper
      )`;
      binds.deptParamUpper = rawDept.toUpperCase();
    }
  }

  const rawSc = (serviceCenter ?? serviceCenterId ?? '').toString().trim();
  if (rawSc && rawSc.toLowerCase() !== 'all') {
    const isScNumeric = /^\d+$/.test(rawSc);
    if (isScNumeric) {
      whereClauses += ` AND (
        c.SERVICE_CENTER_ID = :scIdNum
        OR UPPER(TRIM(c.SERVICE_CENTER_NAME)) = :scParamUpper
        OR UPPER(TRIM(c.SERVICE_CENTER_CODE)) = :scParamUpper
      )`;
      binds.scIdNum = Number(rawSc);
      binds.scParamUpper = rawSc.toUpperCase();
    } else {
      whereClauses += ` AND (
        UPPER(TRIM(c.SERVICE_CENTER_NAME)) = :scParamUpper
        OR UPPER(TRIM(c.SERVICE_CENTER_CODE)) = :scParamUpper
      )`;
      binds.scParamUpper = rawSc.toUpperCase();
    }
  }

  if (search && String(search).trim() !== '') {
    whereClauses += ` AND (
      UPPER(TO_CHAR(p.mrno)) LIKE :searchPattern
      OR UPPER(p.patientname) LIKE :searchPattern
      OR UPPER(px.PREFIX || '.' || p.patientname) LIKE :searchPattern
      OR UPPER(TO_CHAR(i.ADMISSIONNUMBER)) LIKE :searchPattern
      OR UPPER(TO_CHAR(b.BED_NO)) LIKE :searchPattern
    )`;
    binds.searchPattern = `%${String(search).trim().toUpperCase()}%`;
  }

  // Count total matching records
  const countSql = `${BASE_COUNT_SQL} ${whereClauses}`;
  const countResult = await executeQuery(countSql, binds);
  const total = countResult.rows?.[0]?.TOTAL_COUNT ?? 0;

  // Pagination bounds
  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.max(1, Math.min(200, parseInt(limit, 10) || 25));
  const offset = (parsedPage - 1) * parsedLimit;

  // Data query with ordering & pagination
  const dataSql = `
    ${BASE_PATIENT_SQL}
    ${whereClauses}
    ORDER BY i.ADMISSIONDATE DESC, p.mrno DESC
    OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY
  `;

  const dataBinds = {
    ...binds,
    offset,
    limit: parsedLimit,
  };

  const dataResult = await executeQuery(dataSql, dataBinds);
  const patients = (dataResult.rows || []).map(mapPatientRow);

  return {
    total,
    page: parsedPage,
    limit: parsedLimit,
    totalPages: Math.ceil(total / parsedLimit) || 1,
    patients,
  };
}

/**
 * Fetches list of available departments derived from active inpatients.
 */
export async function getDepartments() {
  const sql = `
    SELECT DISTINCT
      hDept.DEPARTMENT_ID AS department_id,
      hDept.DEPARTMENT_NAME AS department_name
    FROM inpatients i
    INNER JOIN employee dr
      ON dr.EMPLOYEE_ID = i.ADMITTINGDOCTOR
    INNER JOIN HISDEPARTMENT hDept
      ON hDept.DEPARTMENT_ID = dr.DEPARTMENT_ID
    WHERE i.VISIT_PATIENTSTATUS = 387
      AND hDept.DEPARTMENT_NAME IS NOT NULL
    ORDER BY hDept.DEPARTMENT_NAME ASC
  `;

  const result = await executeQuery(sql);
  return (result.rows || []).map((row) => ({
    departmentId: String(row.DEPARTMENT_ID),
    departmentName: row.DEPARTMENT_NAME,
  }));
}

/**
 * Fetches list of available service centers derived from active inpatients.
 */
export async function getServiceCenters() {
  const sql = `
    SELECT DISTINCT
      c.SERVICE_CENTER_ID AS service_center_id,
      c.SERVICE_CENTER_NAME AS service_center_name
    FROM inpatients i
    INNER JOIN servicecenter c
      ON i.SERVICECENTER = c.SERVICE_CENTER_ID
    WHERE i.VISIT_PATIENTSTATUS = 387
      AND c.SERVICE_CENTER_NAME IS NOT NULL
    ORDER BY c.SERVICE_CENTER_NAME ASC
  `;

  const result = await executeQuery(sql);
  return (result.rows || []).map((row) => ({
    serviceCenterId: String(row.SERVICE_CENTER_ID),
    serviceCenterName: row.SERVICE_CENTER_NAME,
  }));
}

/**
 * Fetches a single patient's details by their complete MRNO for form auto-population.
 * Uses bind variable :mrno and safe parameterized SQL.
 *
 * @param {string} mrno
 */
export async function getPatientByMrno(mrno) {
  if (!mrno || String(mrno).trim() === '') {
    const err = new Error('MRNO is required.');
    err.status = 400;
    err.code = 'MRNO_REQUIRED';
    throw err;
  }

  const normalizedMrno = String(mrno).trim();

  const sql = `
    SELECT
      TO_CHAR(p.mrno) AS mrno,
      TO_CHAR(p.patient_id) AS patient_id,
      CASE WHEN px.PREFIX IS NOT NULL THEN px.PREFIX || '.' || p.patientname ELSE p.patientname END AS patientname,
      CASE WHEN px.PREFIX IS NOT NULL THEN px.PREFIX || '.' || p.patientname ELSE p.patientname END AS patient_name,
      p.patientname AS raw_patientname,
      p.patientname AS first_name,
      i.ADMISSIONDATE AS admissiondate,
      i.ADMISSIONDATE AS admission_date,
      b.BED_NO AS bedno,
      b.BED_NO AS bed_no,
      i.ADMISSIONNUMBER AS admissionnumber,
      i.ADMISSIONNUMBER AS admission_number,
      p.age || ' ' || (
        CASE
          WHEN p.AGEUNIT = 1 THEN 'Years'
          WHEN p.AGEUNIT = 2 THEN 'Months'
          WHEN p.AGEUNIT = 3 THEN 'Days'
        END
      ) AS age,
      p.age AS raw_age,
      g.lookupvalue AS gender,
      CASE WHEN dr.employee_name IS NOT NULL THEN 'Dr.' || dr.employee_name ELSE NULL END AS consultant,
      hDept.DEPARTMENT_NAME AS department_name,
      c.SERVICE_CENTER_NAME AS service_center,
      p.MOBILENO AS mobileno,
      p.MOBILENO AS mobile_no,
      p.dob AS dob,
      (
        SELECT vs.current_value
        FROM (
          SELECT current_value
          FROM vitalsign
          WHERE patient_id = p.patient_id
            AND UPPER(TRIM(parameter_value)) = 'WEIGHT'
            AND current_value IS NOT NULL
          ORDER BY entered_datetime DESC
        ) vs
        WHERE ROWNUM = 1
      ) AS weight,
      (
        SELECT ht.current_value
        FROM (
          SELECT current_value
          FROM vitalsign
          WHERE patient_id = p.patient_id
            AND UPPER(TRIM(parameter_value)) = 'HEIGHT'
            AND current_value IS NOT NULL
          ORDER BY entered_datetime DESC
        ) ht
        WHERE ROWNUM = 1
      ) AS height
    FROM patient p
    LEFT JOIN prefix_master px ON px.id = p.PATPREFIX
    LEFT JOIN lookupentity g ON g.lookupid = p.genderid
    LEFT JOIN inpatients i ON p.PATIENT_ID = i.patient
    LEFT JOIN bed b ON b.bed_id = i.bed
    LEFT JOIN servicecenter c ON i.SERVICECENTER = c.SERVICE_CENTER_ID
    LEFT JOIN employee dr ON dr.EMPLOYEE_ID = i.ADMITTINGDOCTOR
    LEFT JOIN HISDEPARTMENT hDept ON hDept.DEPARTMENT_ID = dr.DEPARTMENT_ID
    WHERE TO_CHAR(p.mrno) = :mrno
    ORDER BY i.ADMISSIONDATE DESC NULLS LAST
    FETCH FIRST 1 ROWS ONLY
  `;

  const result = await executeQuery(sql, { mrno: normalizedMrno });
  if (!result || !result.rows || result.rows.length === 0) {
    const err = new Error(`Patient not found for MRNO ${normalizedMrno}.`);
    err.status = 404;
    err.code = 'PATIENT_NOT_FOUND';
    throw err;
  }

  const row = result.rows[0];

  return {
    mrno: row.MRNO != null ? String(row.MRNO) : normalizedMrno,
    patient_id: row.PATIENT_ID != null ? String(row.PATIENT_ID) : '',
    patientId: row.PATIENT_ID != null ? String(row.PATIENT_ID) : '',
    patientname: row.PATIENTNAME || row.PATIENT_NAME || '',
    patient_name: row.PATIENT_NAME || row.PATIENTNAME || '',
    patientName: row.PATIENT_NAME || row.PATIENTNAME || '',
    raw_patientname: row.RAW_PATIENTNAME || '',
    first_name: row.FIRST_NAME || row.RAW_PATIENTNAME || '',
    firstName: row.FIRST_NAME || row.RAW_PATIENTNAME || '',
    admissiondate: formatDate(row.ADMISSIONDATE),
    admission_date: formatDate(row.ADMISSION_DATE),
    admissionDate: formatDate(row.ADMISSION_DATE),
    bedno: row.BEDNO || row.BED_NO || '',
    bed_no: row.BED_NO || row.BEDNO || '',
    bedNo: row.BED_NO || row.BEDNO || '',
    admissionnumber: row.ADMISSIONNUMBER || row.ADMISSION_NUMBER || '',
    admission_number: row.ADMISSION_NUMBER || row.ADMISSIONNUMBER || '',
    admissionNumber: row.ADMISSION_NUMBER || row.ADMISSIONNUMBER || '',
    age: row.AGE != null ? String(row.AGE).trim() : '',
    raw_age: row.RAW_AGE != null ? Number(row.RAW_AGE) : undefined,
    gender: row.GENDER || '',
    consultant: row.CONSULTANT || '',
    department_name: row.DEPARTMENT_NAME || '',
    departmentName: row.DEPARTMENT_NAME || '',
    service_center: row.SERVICE_CENTER || '',
    serviceCenter: row.SERVICE_CENTER || '',
    mobileno: row.MOBILENO != null ? String(row.MOBILENO) : '',
    mobile_no: row.MOBILE_NO != null ? String(row.MOBILE_NO) : '',
    mobileNo: row.MOBILE_NO != null ? String(row.MOBILE_NO) : '',
    dob: formatDate(row.DOB),
    date_of_birth: formatDate(row.DOB),
    weight: row.WEIGHT != null ? (isNaN(Number(row.WEIGHT)) ? row.WEIGHT : Number(row.WEIGHT)) : undefined,
    height: row.HEIGHT != null ? (isNaN(Number(row.HEIGHT)) ? row.HEIGHT : Number(row.HEIGHT)) : undefined,
  };
}
