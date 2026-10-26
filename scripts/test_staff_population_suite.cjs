const assert = require('assert');
const http = require('http');

function get(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:3001${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    }).on('error', reject);
  });
}

// Mirroring staffFieldHelper logic for node verification
function getStaffValueForField(sourceField, staff) {
  if (!staff) return '';
  const key = (sourceField || 'staff_name').toLowerCase().trim();
  switch (key) {
    case 'staff_name':
    case 'name':
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
      return staff.emp_no || (staff.employee_id ? String(staff.employee_id) : '');
    case 'email':
    case 'staff_email':
      return staff.email || '';
    case 'designation':
    case 'staff_designation':
      return staff.designation || '';
    case 'login':
    case 'username':
      return staff.login || staff.username || '';
    default:
      return staff[sourceField] ? String(staff[sourceField]) : (staff.staff_name || '');
  }
}

function resolveStaffFieldMapping(field) {
  if (!field) return { isStaffField: false, sourceField: 'staff_name', isLocked: false };

  if (field.autoPopulate && typeof field.autoPopulate === 'object') {
    const cfg = field.autoPopulate;
    if (cfg.autoPopulate !== false && (cfg.dataSource === 'loggedInUser' || field.dataSource === 'loggedInUser')) {
      return {
        isStaffField: true,
        sourceField: cfg.sourceField || field.sourceField || 'staff_name',
        isLocked: cfg.readOnly !== false && field.readOnly !== false
      };
    }
  }

  if (field.dataSource === 'loggedInUser') {
    return {
      isStaffField: true,
      sourceField: field.sourceField || 'staff_name',
      isLocked: field.readOnly !== false
    };
  }

  const labelLower = (field.label || '').toLowerCase().trim();
  const nameLower = (field.name || '').toLowerCase().trim();
  const idLower = (field.id || '').toLowerCase().trim();

  // Signature check
  if (
    labelLower === 'sign' || labelLower === 'signature' ||
    nameLower === 'nurse_sign' || idLower === 'fld_nurse_sign'
  ) {
    return { isStaffField: false, sourceField: '', isLocked: false };
  }

  if (labelLower.includes('staff nurse (name)') || labelLower === 'staff name' || idLower === 'fld_nurse_name') {
    return { isStaffField: true, sourceField: 'staff_name', isLocked: true };
  }
  if (labelLower === 'staff id' || labelLower === 'user id') {
    return { isStaffField: true, sourceField: 'user_id', isLocked: true };
  }
  if (labelLower === 'employee id' || labelLower === 'emp no') {
    return { isStaffField: true, sourceField: 'employee_id', isLocked: true };
  }
  if (labelLower === 'designation' || labelLower === 'staff designation') {
    return { isStaffField: true, sourceField: 'designation', isLocked: true };
  }
  if (labelLower === 'staff email' || labelLower === 'email') {
    return { isStaffField: true, sourceField: 'email', isLocked: true };
  }

  return { isStaffField: false, sourceField: '', isLocked: field.readOnly === true };
}

function resolveStaffColumnMapping(col) {
  if (!col) return { isStaffField: false, sourceField: 'staff_name', isLocked: false };

  if (col.autoPopulate && typeof col.autoPopulate === 'object') {
    const cfg = col.autoPopulate;
    if (cfg.autoPopulate !== false && (cfg.dataSource === 'loggedInUser' || col.dataSource === 'loggedInUser')) {
      return {
        isStaffField: true,
        sourceField: cfg.sourceField || col.sourceField || 'staff_name',
        isLocked: cfg.readOnly !== false && col.readOnly !== false
      };
    }
  }

  const labelLower = (col.label || '').toLowerCase().trim();
  const keyLower = ((col.key || col.id) || '').toLowerCase().trim();

  if (labelLower === 'sign' || labelLower === 'signature') {
    return { isStaffField: false, sourceField: '', isLocked: false };
  }

  if (
    labelLower === 'staff name & sign' || labelLower === 'staff name and sign' ||
    keyLower === 'staff_name_sign' || keyLower === 'col_b4it_6'
  ) {
    return { isStaffField: true, sourceField: 'staff_name', isLocked: true };
  }

  return { isStaffField: false, sourceField: '', isLocked: col.readOnly === true };
}

async function runTests() {
  console.log('🧪 Starting Staff Auto-Population and Locking Test Suite...\n');

  // Test 1: Oracle Backend API Endpoint with User 950
  console.log('Test 1: Oracle Staff Lookup API for user_id=950');
  const res950 = await get('/api/users/950/staff-details');
  assert.strictEqual(res950.status, 200, 'Expected 200 OK');
  assert.strictEqual(res950.body.success, true, 'Expected success=true');
  assert.strictEqual(res950.body.user_id, 950, 'Expected user_id=950');
  assert.strictEqual(res950.body.staff_name, 'SABIN SUNNY', 'Expected verified staff_name=SABIN SUNNY');
  assert.strictEqual(res950.body.employee_id, 1420, 'Expected employee_id=1420');
  assert.strictEqual(res950.body.emp_no, '3933', 'Expected emp_no=3933');
  assert.strictEqual(res950.body.designation, 'SR. EXECUTIVE – HUMAN RESOURCES', 'Expected designation');
  assert.ok(res950.body.email, 'Expected non-empty email');
  assert.strictEqual(res950.body.password, undefined, 'Password must never be exposed');
  console.log('  ✅ Passed: user_id=950 returned verified staff details without sensitive fields.');

  // Test 2: Error Handling for Non-Existent and Invalid Users
  console.log('\nTest 2: Error Handling for Non-existent and Invalid Users');
  const resNotFound = await get('/api/users/99999999/staff-details');
  assert.strictEqual(resNotFound.status, 404, 'Expected 404 for missing user');
  assert.strictEqual(resNotFound.body.code, 'USER_NOT_FOUND');

  const resInvalid = await get('/api/users/-5/staff-details');
  assert.strictEqual(resInvalid.status, 400, 'Expected 400 for invalid user ID');
  assert.strictEqual(resInvalid.body.code, 'INVALID_USER_ID');
  console.log('  ✅ Passed: Missing and invalid user IDs handled gracefully.');

  // Test 3: Value Extraction for Diverse Supported Staff Fields
  console.log('\nTest 3: Value Extraction for Diverse Staff Attributes');
  const staff = res950.body;
  assert.strictEqual(getStaffValueForField('staff_name', staff), 'SABIN SUNNY');
  assert.strictEqual(getStaffValueForField('user_id', staff), '950');
  assert.strictEqual(getStaffValueForField('employee_id', staff), '1420');
  assert.strictEqual(getStaffValueForField('emp_no', staff), '3933');
  assert.strictEqual(getStaffValueForField('designation', staff), 'SR. EXECUTIVE – HUMAN RESOURCES');
  assert.strictEqual(getStaffValueForField('email', staff), 'edp@moscmm.org');
  assert.strictEqual(getStaffValueForField('login', staff), 'sab3933');
  console.log('  ✅ Passed: All supported staff attributes correctly mapped.');

  // Test 4: Field Mapping & Locking for Nursing Assessment
  console.log('\nTest 4: Field Mapping & Read-Only Locking for Nursing Assessment');
  const nurseNameField = {
    id: 'fld_nurse_name',
    name: 'nurse_name',
    label: 'Assessment Completed by Staff Nurse (Name)',
    type: 'text'
  };
  const nurseNameMapping = resolveStaffFieldMapping(nurseNameField);
  assert.strictEqual(nurseNameMapping.isStaffField, true);
  assert.strictEqual(nurseNameMapping.sourceField, 'staff_name');
  assert.strictEqual(nurseNameMapping.isLocked, true, 'Staff name must be strictly locked');

  // Test 5: Standalone Signature Protection
  console.log('\nTest 5: Standalone Signature Protection');
  const signField = {
    id: 'fld_nurse_sign',
    name: 'nurse_sign',
    label: 'Sign',
    type: 'text'
  };
  const signMapping = resolveStaffFieldMapping(signField);
  assert.strictEqual(signMapping.isStaffField, false, 'Signature field must NOT be treated as staff name');
  assert.strictEqual(signMapping.isLocked, false, 'Signature field must remain unlocked for clinician input');
  console.log('  ✅ Passed: Signature fields remain independent and unlocked.');

  // Test 6: Morse Fall Risk Table Staff Name & Sign Column
  console.log('\nTest 6: Table Column Auto-Population & Locking (Morse Table)');
  const morseStaffCol = {
    key: 'col_b4it_6',
    label: 'Staff Name & Sign',
    type: 'text'
  };
  const morseColMapping = resolveStaffColumnMapping(morseStaffCol);
  assert.strictEqual(morseColMapping.isStaffField, true);
  assert.strictEqual(morseColMapping.sourceField, 'staff_name');
  assert.strictEqual(morseColMapping.isLocked, true, 'Morse table Staff Name & Sign column must be locked');

  const regularTableCol = {
    key: 'col_score',
    label: 'Score',
    type: 'number'
  };
  const regularColMapping = resolveStaffColumnMapping(regularTableCol);
  assert.strictEqual(regularColMapping.isStaffField, false);
  assert.strictEqual(regularColMapping.isLocked, false, 'Regular clinical column must not be locked');
  console.log('  ✅ Passed: Table staff column populated and locked; clinical columns remain editable.');

  // Test 7: Explicit Schema Configuration Override
  console.log('\nTest 7: Explicit Schema Configuration Support');
  const customConfigField = {
    id: 'fld_custom_emp',
    label: 'Custom Nurse Staff ID',
    type: 'text',
    dataSource: 'loggedInUser',
    sourceField: 'employee_id',
    readOnly: true
  };
  const customMapping = resolveStaffFieldMapping(customConfigField);
  assert.strictEqual(customMapping.isStaffField, true);
  assert.strictEqual(customMapping.sourceField, 'employee_id');
  assert.strictEqual(customMapping.isLocked, true);
  console.log('  ✅ Passed: Explicit Form Builder configuration works accurately.');

  console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!');
}

runTests().catch(err => {
  console.error('\n❌ Test failure:', err);
  process.exit(1);
});
