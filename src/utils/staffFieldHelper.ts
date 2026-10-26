import type { FormField, TableColumn } from '../types/schema';
import type { StaffDetailsResponse } from '../services/userApi';

export interface StaffMappingResult {
  isStaffField: boolean;
  sourceField: 'staff_name' | 'user_id' | 'employee_id' | 'emp_no' | 'email' | 'designation' | 'login' | string;
  isLocked: boolean;
  populateWhen: 'always' | 'empty';
}

/**
 * Extracts the appropriate staff attribute value from the logged-in staff context.
 */
export function getStaffValueForField(sourceField: string, staff: StaffDetailsResponse | null | undefined): string {
  if (!staff) return '';
  const key = (sourceField || 'staff_name').toLowerCase().trim();

  switch (key) {
    case 'staff_name':
    case 'name':
    case 'display_name':
    case 'staffname':
      return staff.staff_name || '';

    case 'user_id':
    case 'userid':
    case 'id':
      return staff.user_id ? String(staff.user_id) : '';

    case 'employee_id':
    case 'employeeid':
      return staff.employee_id ? String(staff.employee_id) : (staff.emp_no || '');

    case 'emp_no':
    case 'empno':
    case 'employee_number':
      return staff.emp_no || (staff.employee_id ? String(staff.employee_id) : '');

    case 'email':
    case 'staff_email':
    case 'emailid':
      return staff.email || '';

    case 'designation':
    case 'staff_designation':
    case 'designation_name':
      return staff.designation || '';

    case 'login':
    case 'username':
      return staff.login || staff.username || '';

    default:
      return (staff as any)[sourceField] ? String((staff as any)[sourceField]) : (staff.staff_name || '');
  }
}

/**
 * Resolves whether a FormField is configured or semantically recognized as a staff field,
 * what staff attribute it maps to, and whether it must be locked (read-only) in the form runtime.
 */
export function resolveStaffFieldMapping(field: FormField): StaffMappingResult {
  if (!field) {
    return { isStaffField: false, sourceField: 'staff_name', isLocked: false, populateWhen: 'empty' };
  }

  // Explicitly disabled
  if (
    field.autoPopulate === false ||
    (typeof field.autoPopulate === 'object' && field.autoPopulate !== null && field.autoPopulate.autoPopulate === false) ||
    field.dataSource === 'none'
  ) {
    return { isStaffField: false, sourceField: '', isLocked: field.readOnly === true, populateWhen: 'empty' };
  }

  // 1. Explicit autoPopulate object configuration
  if (field.autoPopulate && typeof field.autoPopulate === 'object') {
    const cfg = field.autoPopulate;
    if (cfg.autoPopulate !== false && (cfg.dataSource === 'loggedInUser' || field.dataSource === 'loggedInUser')) {
      const sourceField = cfg.sourceField || field.sourceField || 'staff_name';
      const isLocked = cfg.readOnly !== false && field.readOnly !== false;
      const populateWhen = cfg.populateWhen || field.populateWhen || 'empty';
      return { isStaffField: true, sourceField, isLocked, populateWhen };
    }
  }

  // 2. Direct property configuration
  if (field.dataSource === 'loggedInUser' || (field.autoPopulate === true && field.sourceField)) {
    const sourceField = field.sourceField || 'staff_name';
    const isLocked = field.readOnly !== false;
    const populateWhen = field.populateWhen || 'empty';
    return { isStaffField: true, sourceField, isLocked, populateWhen };
  }

  // 3. Intelligent clinical semantic matching
  const labelLower = (field.label || '').toLowerCase().trim();
  const nameLower = (field.name || '').toLowerCase().trim();
  const idLower = (field.id || '').toLowerCase().trim();

  // Protect standalone signature controls from being populated as staff name strings
  if (
    labelLower === 'sign' ||
    labelLower === 'signature' ||
    labelLower === 'nurse sign' ||
    labelLower === 'doctor sign' ||
    labelLower === 'staff sign' ||
    nameLower === 'nurse_sign' ||
    nameLower === 'sign' ||
    nameLower === 'signature' ||
    idLower === 'fld_nurse_sign' ||
    (idLower.includes('sign') && !idLower.includes('name'))
  ) {
    return { isStaffField: false, sourceField: '', isLocked: false, populateWhen: 'empty' };
  }

  // A. Staff Name
  if (
    labelLower === 'assessment completed by staff nurse (name)' ||
    labelLower.includes('staff nurse (name)') ||
    labelLower.includes('staff nurse name') ||
    labelLower === 'nurse name' ||
    labelLower === 'staff name' ||
    labelLower === 'staff member name' ||
    nameLower === 'nurse_name' ||
    nameLower === 'staff_name' ||
    idLower === 'fld_nurse_name'
  ) {
    return { isStaffField: true, sourceField: 'staff_name', isLocked: true, populateWhen: 'empty' };
  }

  // B. Staff ID / User ID
  if (
    labelLower === 'staff id' ||
    labelLower === 'staff user id' ||
    labelLower === 'user id' ||
    labelLower === 'his user id' ||
    nameLower === 'staff_id' ||
    nameLower === 'user_id' ||
    idLower === 'fld_staff_id' ||
    idLower === 'fld_user_id'
  ) {
    return { isStaffField: true, sourceField: 'user_id', isLocked: true, populateWhen: 'empty' };
  }

  // C. Employee ID / Number
  if (
    labelLower === 'employee id' ||
    labelLower === 'emp id' ||
    labelLower === 'employee no' ||
    labelLower === 'employee number' ||
    labelLower === 'staff code' ||
    nameLower === 'employee_id' ||
    nameLower === 'emp_no' ||
    idLower === 'fld_employee_id' ||
    idLower === 'fld_emp_no'
  ) {
    return { isStaffField: true, sourceField: 'employee_id', isLocked: true, populateWhen: 'empty' };
  }

  // D. Staff Designation
  if (
    labelLower === 'staff designation' ||
    labelLower === 'designation' ||
    labelLower === 'nurse designation' ||
    nameLower === 'staff_designation' ||
    nameLower === 'designation' ||
    idLower === 'fld_designation'
  ) {
    return { isStaffField: true, sourceField: 'designation', isLocked: true, populateWhen: 'empty' };
  }

  // E. Staff Email
  if (
    labelLower === 'staff email' ||
    labelLower === 'nurse email' ||
    nameLower === 'staff_email' ||
    nameLower === 'email' ||
    idLower === 'fld_staff_email'
  ) {
    return { isStaffField: true, sourceField: 'email', isLocked: true, populateWhen: 'empty' };
  }

  // Respect field-level readOnly flag if set on any other field
  if (field.readOnly === true) {
    return { isStaffField: false, sourceField: '', isLocked: true, populateWhen: 'empty' };
  }

  return { isStaffField: false, sourceField: '', isLocked: false, populateWhen: 'empty' };
}

/**
 * Resolves whether a TableColumn is configured or semantically recognized as a staff column,
 * what staff attribute it maps to, and whether it must be locked (read-only) in table rows.
 */
export function resolveStaffColumnMapping(col: TableColumn): StaffMappingResult {
  if (!col) {
    return { isStaffField: false, sourceField: 'staff_name', isLocked: false, populateWhen: 'empty' };
  }

  // Explicitly disabled
  if (
    col.autoPopulate === false ||
    (typeof col.autoPopulate === 'object' && col.autoPopulate !== null && col.autoPopulate.autoPopulate === false) ||
    col.dataSource === 'none'
  ) {
    return { isStaffField: false, sourceField: '', isLocked: col.readOnly === true, populateWhen: 'empty' };
  }

  // 1. Explicit autoPopulate object configuration
  if (col.autoPopulate && typeof col.autoPopulate === 'object') {
    const cfg = col.autoPopulate;
    if (cfg.autoPopulate !== false && (cfg.dataSource === 'loggedInUser' || col.dataSource === 'loggedInUser')) {
      const sourceField = cfg.sourceField || col.sourceField || 'staff_name';
      const isLocked = cfg.readOnly !== false && col.readOnly !== false;
      const populateWhen = cfg.populateWhen || col.populateWhen || 'empty';
      return { isStaffField: true, sourceField, isLocked, populateWhen };
    }
  }

  // 2. Direct property configuration
  if (col.dataSource === 'loggedInUser' || (col.autoPopulate === true && col.sourceField)) {
    const sourceField = col.sourceField || 'staff_name';
    const isLocked = col.readOnly !== false;
    const populateWhen = col.populateWhen || 'empty';
    return { isStaffField: true, sourceField, isLocked, populateWhen };
  }

  // 3. Intelligent clinical semantic matching
  const labelLower = (col.label || '').toLowerCase().trim();
  const keyLower = ((col.key || col.id) || '').toLowerCase().trim();

  // Exclude pure signature columns
  if (
    labelLower === 'sign' ||
    labelLower === 'signature' ||
    labelLower === 'nurse sign' ||
    keyLower === 'sign' ||
    keyLower === 'signature' ||
    keyLower === 'nurse_sign'
  ) {
    return { isStaffField: false, sourceField: '', isLocked: false, populateWhen: 'empty' };
  }

  // Target field B: Morse Fall Risk Reassessment Record -> "Staff Name & Sign"
  if (
    labelLower === 'staff name & sign' ||
    labelLower === 'staff name and sign' ||
    labelLower.includes('staff name') ||
    labelLower.includes('nurse name') ||
    keyLower === 'staff_name_sign' ||
    keyLower === 'staff_name' ||
    keyLower === 'nurse_name' ||
    keyLower === 'col_b4it_6'
  ) {
    return { isStaffField: true, sourceField: 'staff_name', isLocked: true, populateWhen: 'empty' };
  }

  if (
    labelLower === 'staff id' ||
    labelLower === 'user id' ||
    keyLower === 'staff_id' ||
    keyLower === 'user_id'
  ) {
    return { isStaffField: true, sourceField: 'user_id', isLocked: true, populateWhen: 'empty' };
  }

  if (
    labelLower === 'employee id' ||
    labelLower === 'emp id' ||
    keyLower === 'employee_id' ||
    keyLower === 'emp_no'
  ) {
    return { isStaffField: true, sourceField: 'employee_id', isLocked: true, populateWhen: 'empty' };
  }

  if (
    labelLower === 'designation' ||
    labelLower === 'staff designation' ||
    keyLower === 'designation'
  ) {
    return { isStaffField: true, sourceField: 'designation', isLocked: true, populateWhen: 'empty' };
  }

  // Respect column-level readOnly flag if set on any other column
  if (col.readOnly === true) {
    return { isStaffField: false, sourceField: '', isLocked: true, populateWhen: 'empty' };
  }

  return { isStaffField: false, sourceField: '', isLocked: false, populateWhen: 'empty' };
}

/**
 * Checks if a FormField is configured or semantically mapped to any staff attribute.
 */
export function isStaffField(field: FormField): boolean {
  return resolveStaffFieldMapping(field).isStaffField;
}

/**
 * Checks if a TableColumn is configured or semantically mapped to any staff attribute.
 */
export function isStaffColumn(col: TableColumn): boolean {
  return resolveStaffColumnMapping(col).isStaffField;
}

/**
 * Checks if a FormField must be rendered as read-only / locked in the form runtime.
 */
export function isStaffFieldLocked(field: FormField): boolean {
  return resolveStaffFieldMapping(field).isLocked || field.readOnly === true;
}

/**
 * Checks if a TableColumn must be rendered as read-only / locked in table cells.
 */
export function isStaffColumnLocked(col: TableColumn): boolean {
  return resolveStaffColumnMapping(col).isLocked || col.readOnly === true;
}

/**
 * Safely parses and validates a HIS user ID from URL parameters or API input.
 * Supports positive integers and strings containing the established HIS trailing colon delimiter (e.g., '950:', '1212:').
 * Strictly rejects any malformed, non-numeric, negative, or multi-delimited values.
 *
 * @param raw - The raw user ID from URL parameters or API input.
 * @returns Positive integer ID, or null if invalid or absent.
 */
export function parseAndValidateUserId(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') {
    return Number.isInteger(raw) && raw > 0 ? raw : null;
  }
  const trimmed = String(raw).trim();
  if (!trimmed) return null;

  let decoded = trimmed;
  try {
    decoded = decodeURIComponent(trimmed).trim();
  } catch {
    // If decoding fails, continue with trimmed
  }

  // Matches one or more digits, with at most one optional trailing colon (HIS integration delimiter)
  const match = decoded.match(/^(\d+):?$/);
  if (!match) return null;

  const num = parseInt(match[1], 10);
  return !isNaN(num) && num > 0 && Number.isSafeInteger(num) ? num : null;
}
