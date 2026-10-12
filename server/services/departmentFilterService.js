import * as patientService from './patientService.js';

/**
 * Resolves raw department input (ID, name, or code) against department master data.
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
 * Shared/organization-wide forms (with no department or department === 'ALL') always match.
 */
export function matchesDepartmentScope(form, resolvedDept, rawServiceCenter = null) {
  if (!resolvedDept || resolvedDept.isAll) {
    return true; // No department filter applied
  }

  const formDeptId = form.departmentId || form.settings?.departmentId;
  const formDeptName = form.departmentName || form.settings?.departmentName;

  // Shared / organization-wide check
  const isFormShared =
    (!formDeptId && !formDeptName) ||
    (formDeptId && String(formDeptId).toUpperCase() === 'ALL') ||
    (formDeptName &&
      (formDeptName.toUpperCase() === 'ALL' ||
        formDeptName.toLowerCase().includes('all departments')));

  if (isFormShared) {
    return true;
  }

  // Department-restricted check
  const matchesDeptId =
    resolvedDept.departmentId &&
    formDeptId &&
    String(formDeptId) === String(resolvedDept.departmentId);

  const matchesDeptName =
    resolvedDept.departmentName &&
    formDeptName &&
    formDeptName.toUpperCase() === resolvedDept.departmentName.toUpperCase();

  const directParamMatch =
    (resolvedDept.departmentName &&
      formDeptId &&
      String(formDeptId) === resolvedDept.departmentName) ||
    (resolvedDept.departmentId &&
      formDeptName &&
      formDeptName.toUpperCase() === String(resolvedDept.departmentId).toUpperCase());

  const matchesDept = matchesDeptId || matchesDeptName || directParamMatch;
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
      (formScId && String(formScId) === rawScTrimmed) ||
      (formScName && formScName.toUpperCase() === rawScTrimmed);
    return scMatches;
  }

  return true;
}
