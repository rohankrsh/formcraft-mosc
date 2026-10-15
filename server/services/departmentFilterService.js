import * as patientService from './patientService.js';

/**
 * Normalizes any form, settings, or metadata object into a consistent multi-department structure.
 * Gracefully normalizes legacy single-department properties (departmentId, departmentName).
 *
 * @param {object} formOrSettings - Form definition, settings, or metadata object
 * @returns {{ departmentIds: string[], departmentNames: string[], isShared: boolean }}
 */
export function normalizeDepartmentAssignment(formOrSettings) {
  if (!formOrSettings || typeof formOrSettings !== 'object') {
    return { departmentIds: ['ALL'], departmentNames: ['All Departments (Organization-wide)'], isShared: true };
  }

  const rawIds =
    formOrSettings.departmentIds ??
    formOrSettings.settings?.departmentIds ??
    formOrSettings.meta?.departmentIds;

  const rawNames =
    formOrSettings.departmentNames ??
    formOrSettings.settings?.departmentNames ??
    formOrSettings.meta?.departmentNames;

  const legacyId =
    formOrSettings.departmentId ??
    formOrSettings.settings?.departmentId ??
    formOrSettings.meta?.departmentId;

  const legacyName =
    formOrSettings.departmentName ??
    formOrSettings.settings?.departmentName ??
    formOrSettings.meta?.departmentName;

  let departmentIds = [];
  let departmentNames = [];

  if (Array.isArray(rawIds) && rawIds.length > 0) {
    departmentIds = rawIds
      .map((id) => (id != null ? String(id).trim() : ''))
      .filter((id) => id.length > 0);
  } else if (legacyId != null && String(legacyId).trim() !== '') {
    const val = String(legacyId).trim();
    departmentIds = [val];
  }

  if (Array.isArray(rawNames) && rawNames.length > 0) {
    departmentNames = rawNames
      .map((name) => (name != null ? String(name).trim() : ''))
      .filter((name) => name.length > 0);
  } else if (legacyName != null && String(legacyName).trim() !== '') {
    const val = String(legacyName).trim();
    departmentNames = [val];
  }

  // Deduplicate departmentIds preserving order
  departmentIds = Array.from(new Set(departmentIds));
  departmentNames = Array.from(new Set(departmentNames));

  // Determine if this form is organization-wide / shared:
  // 1) Contains 'ALL' (case-insensitive) in departmentIds or legacyId
  // 2) Contains 'all departments' in legacyName or departmentNames
  // 3) Has no department assignment configured at all (legacy shared policy)
  const hasAllId = departmentIds.some((id) => id.toUpperCase() === 'ALL');
  const hasAllName = departmentNames.some(
    (name) => name.toUpperCase() === 'ALL' || name.toLowerCase().includes('all departments')
  );
  const isExplicitlyEmpty = departmentIds.length === 0 && departmentNames.length === 0;

  const isShared = hasAllId || hasAllName || isExplicitlyEmpty;

  if (isShared && !hasAllId) {
    departmentIds = ['ALL'];
    if (departmentNames.length === 0) {
      departmentNames = ['All Departments (Organization-wide)'];
    }
  }

  return {
    departmentIds,
    departmentNames,
    isShared,
  };
}

/**
 * Checks whether a form is designated as shared / organization-wide.
 *
 * @param {object} form - Form definition or metadata
 * @returns {boolean}
 */
export function isFormShared(form) {
  const normalized = normalizeDepartmentAssignment(form);
  return normalized.isShared;
}

/**
 * Resolves raw department input (ID, name, or code) against department master data.
 *
 * @param {string|number} rawDept - Department identifier or name from request
 * @returns {Promise<{ isAll: boolean, departmentId: string|null, departmentName: string|null }>}
 */
export async function resolveDepartment(rawDept) {
  if (
    !rawDept ||
    rawDept.toString().trim() === '' ||
    rawDept.toString().trim().toLowerCase() === 'all'
  ) {
    return { isAll: true, departmentId: null, departmentName: null };
  }

  const trimmed = rawDept.toString().trim();
  const isNumeric = /^\d+$/.test(trimmed);

  try {
    const departments = await patientService.getDepartments();
    if (isNumeric) {
      const match = departments.find((d) => String(d.departmentId) === trimmed);
      if (match) {
        return {
          isAll: false,
          departmentId: String(match.departmentId),
          departmentName: match.departmentName,
        };
      }
      return { isAll: false, departmentId: trimmed, departmentName: null };
    } else {
      const match = departments.find(
        (d) =>
          d.departmentName &&
          (d.departmentName.toUpperCase() === trimmed.toUpperCase() ||
            d.departmentName.toUpperCase().replace(/\s+/g, '') ===
              trimmed.toUpperCase().replace(/\s+/g, ''))
      );
      if (match) {
        return {
          isAll: false,
          departmentId: String(match.departmentId),
          departmentName: match.departmentName,
        };
      }
      return { isAll: false, departmentId: null, departmentName: trimmed.toUpperCase() };
    }
  } catch (err) {
    console.warn('[DepartmentFilterService] Notice resolving department:', err.message);
    if (isNumeric) {
      return { isAll: false, departmentId: trimmed, departmentName: null };
    }
    return { isAll: false, departmentId: null, departmentName: trimmed.toUpperCase() };
  }
}

/**
 * Checks whether a form matches the requested department and service center filters.
 *
 * Filtering uses OR matching: if a form is assigned to multiple departments (e.g. Cardiology,
 * Neurology, Oncology), a user from ANY of those departments can see/access the form.
 *
 * Shared/organization-wide forms (with department 'ALL' or unassigned) always match.
 *
 * @param {object} form - Form definition, metadata, or deployed form record
 * @param {object} resolvedDept - Result from resolveDepartment()
 * @param {string} [rawServiceCenter] - Optional service center parameter
 * @returns {boolean}
 */
export function matchesDepartmentScope(form, resolvedDept, rawServiceCenter = null) {
  // If no department filter applied or filter is ALL, all forms match
  if (!resolvedDept || resolvedDept.isAll) {
    return true;
  }

  const normalized = normalizeDepartmentAssignment(form);

  // Shared / organization-wide forms always match
  if (normalized.isShared) {
    return true;
  }

  const { departmentIds, departmentNames } = normalized;

  // Multi-department OR matching: check if resolvedDept matches ANY assigned department
  const resolvedId = resolvedDept.departmentId ? String(resolvedDept.departmentId).trim() : null;
  const resolvedName = resolvedDept.departmentName ? resolvedDept.departmentName.trim().toUpperCase() : null;

  let matchesDept = false;

  // 1. Check ID matching against any departmentId in the assigned collection
  if (resolvedId) {
    matchesDept = departmentIds.some((id) => String(id).trim() === resolvedId);
  }

  // 2. Check Name matching against any departmentName in the assigned collection
  if (!matchesDept && resolvedName) {
    matchesDept = departmentNames.some(
      (name) => name && name.trim().toUpperCase() === resolvedName
    );
  }

  // 3. Fallback cross-matching (e.g. if an ID was stored in names or name passed in ID)
  if (!matchesDept) {
    if (resolvedName) {
      matchesDept = departmentIds.some(
        (id) => String(id).trim().toUpperCase() === resolvedName
      );
    }
    if (!matchesDept && resolvedId) {
      matchesDept = departmentNames.some(
        (name) => name && name.trim().toUpperCase() === resolvedId.toUpperCase()
      );
    }
  }

  if (!matchesDept) {
    return false;
  }

  // Service Center check (if form is restricted to a specific service center)
  const formScId = form.serviceCenterId || form.settings?.serviceCenterId;
  const formScName = form.serviceCenterName || form.settings?.serviceCenterName;

  if (formScId || formScName) {
    if (!rawServiceCenter || rawServiceCenter.toLowerCase() === 'all') {
      return true; // department matched, no SC constraint requested
    }
    const rawScTrimmed = rawServiceCenter.trim().toUpperCase();
    const scMatches =
      (formScId && String(formScId).trim().toUpperCase() === rawScTrimmed) ||
      (formScName && formScName.trim().toUpperCase() === rawScTrimmed);
    return scMatches;
  }

  return true;
}

/**
 * Checks whether the incoming request is from an administrator.
 * Recognizes role headers (x-user-role, x-role) and valid API key / Bearer authentication.
 *
 * @param {import('express').Request} req
 * @returns {boolean}
 */
export function isUserAdmin(req) {
  if (!req) return false;

  const role = req.headers['x-user-role'] || req.headers['x-role'];
  if (role && String(role).trim().toLowerCase() === 'admin') {
    return true;
  }

  const configuredSecret = process.env.AUTH_SECRET || 'formcraft_secret_key_2026';
  const apiKey = req.headers['x-api-key'];
  if (apiKey && apiKey === configuredSecret) {
    return true;
  }

  const authHeader = req.headers['authorization'];
  if (authHeader) {
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : authHeader.trim();
    if (token === configuredSecret) {
      return true;
    }
  }

  return false;
}

/**
 * Extracts the user's department context from the request.
 * Prioritizes authenticated headers over URL query parameters or request body.
 *
 * @param {import('express').Request} req
 * @returns {{ rawDept: string|null, isFromHeader: boolean }}
 */
export function getRequestDepartmentContext(req) {
  if (!req) return { rawDept: null, isFromHeader: false };

  const headerDept =
    req.headers['x-user-department'] ||
    req.headers['x-department'] ||
    req.headers['x-department-id'];

  if (headerDept && String(headerDept).trim() !== '') {
    return { rawDept: String(headerDept).trim(), isFromHeader: true };
  }

  const queryDept = req.query?.department || req.query?.departmentId;
  if (queryDept && String(queryDept).trim() !== '') {
    return { rawDept: String(queryDept).trim(), isFromHeader: false };
  }

  const bodyDept = req.body?.department || req.body?.departmentId;
  if (bodyDept && String(bodyDept).trim() !== '') {
    return { rawDept: String(bodyDept).trim(), isFromHeader: false };
  }

  return { rawDept: null, isFromHeader: false };
}

/**
 * Enforces backend access control for a published form according to its assigned departments.
 *
 * Rules:
 * 1. Administrators are permitted access to all forms across all departments.
 * 2. Shared / Organization-wide forms are accessible to any user context.
 * 3. Department-restricted forms require an authorized department context matching at least one
 *    assigned department (OR matching).
 * 4. Direct runtime access without an authorized department context to a restricted form is denied.
 * 5. URL query parameters cannot override an authenticated user department header.
 *
 * @param {object} form - Published form record or definition
 * @param {import('express').Request} req - Express request
 * @param {string} [rawServiceCenterOverride] - Optional service center override
 * @returns {Promise<{ allowed: boolean, code?: string, error?: string, reason?: string }>}
 */
export async function checkFormAccess(form, req, rawServiceCenterOverride = null) {
  if (!form) {
    return { allowed: false, code: 'FORM_NOT_FOUND', error: 'Form not found.' };
  }

  // 1. Administrators have cross-department access
  if (isUserAdmin(req)) {
    return { allowed: true, reason: 'admin' };
  }

  // 2. Organization-wide / shared forms are open
  if (isFormShared(form)) {
    return { allowed: true, reason: 'organization_wide' };
  }

  // 3. Department-restricted form: evaluate user context
  const { rawDept } = getRequestDepartmentContext(req);
  const rawSc =
    rawServiceCenterOverride ||
    req.headers['x-service-center'] ||
    req.query?.serviceCenter ||
    req.body?.serviceCenter ||
    null;

  if (!rawDept || rawDept.toLowerCase() === 'all') {
    return {
      allowed: false,
      code: 'DEPARTMENT_ACCESS_REQUIRED',
      error: 'Access Denied: This form is department-restricted. A valid department context is required to access it.',
    };
  }

  const resolvedDept = await resolveDepartment(rawDept);
  const allowed = matchesDepartmentScope(form, resolvedDept, rawSc);

  if (!allowed) {
    return {
      allowed: false,
      code: 'DEPARTMENT_ACCESS_DENIED',
      error: `Access Denied: This form is restricted and not available for department '${rawDept}'.`,
    };
  }

  return { allowed: true, reason: 'department_match' };
}
