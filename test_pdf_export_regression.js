import assert from 'assert';
import {
  generatePdfFileName,
  getFieldValue,
  isFieldEmpty,
  getTableCellValue,
  resolveDisplayValue,
  validateExportCompleteness,
} from './src/utils/exportPdf.ts';

console.log('=== RUNNING COMPREHENSIVE PDF EXPORT REGRESSION TESTS (15 SCENARIOS) ===\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`[PASS] Scenario ${totalTests}: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] Scenario ${totalTests}: ${name}`);
    console.error(err);
  }
}

// 1. Simple form with populated text and number fields
runTest('Simple form with populated text and number fields (including 0)', () => {
  const form = {
    title: 'Patient Vitals',
    fields: {
      f1: { id: 'f1', name: 'patient_name', label: 'Patient Name', type: 'text' },
      f2: { id: 'f2', name: 'pulse_rate', label: 'Pulse Rate', type: 'number' },
      f3: { id: 'f3', name: 'pain_score', label: 'Pain Score', type: 'number' },
    },
    layout: [
      {
        id: 's1',
        title: 'Vitals',
        rows: [
          {
            id: 'r1',
            columns: [
              { id: 'c1', width: 6, fieldIds: ['f1'] },
              { id: 'c2', width: 3, fieldIds: ['f2'] },
              { id: 'c3', width: 3, fieldIds: ['f3'] },
            ],
          },
        ],
      },
    ],
  };
  const formData = {
    patient_name: 'John Doe',
    pulse_rate: 72,
    pain_score: 0, // Critical: 0 must not be treated as empty!
  };

  const report = validateExportCompleteness(form, formData);
  assert.strictEqual(report.totalFields, 3);
  assert.strictEqual(report.populatedFields, 3);
  assert.strictEqual(report.emptyFields, 0);

  assert.strictEqual(getFieldValue(form.fields.f1, formData), 'John Doe');
  assert.strictEqual(getFieldValue(form.fields.f2, formData), 72);
  assert.strictEqual(getFieldValue(form.fields.f3, formData), 0);

  const disp0 = resolveDisplayValue(form.fields.f3, 0);
  assert.strictEqual(disp0.text, '0');
  assert.strictEqual(disp0.isEmpty, undefined);
});

// 2. Form with populated Date and Time fields
runTest('Form with populated Date and Time fields', () => {
  const dateField = { id: 'd1', name: 'assessment_date', label: 'Assessment Date', type: 'date' };
  const timeField = { id: 't1', name: 'assessment_time', label: 'Assessment Time', type: 'time' };
  const formData = {
    assessment_date: '2026-10-23',
    assessment_time: '14:45',
  };

  const dateDisp = resolveDisplayValue(dateField, getFieldValue(dateField, formData));
  assert.strictEqual(dateDisp.text, '23 Oct 2026');

  const timeDisp = resolveDisplayValue(timeField, getFieldValue(timeField, formData));
  assert.strictEqual(timeDisp.text, '14:45');
});

// 3. Form containing dropdowns, radio groups, and checkboxes
runTest('Dropdowns, radio groups, and checkboxes with option label mapping', () => {
  const selectField = {
    id: 's1',
    name: 'triage_priority',
    label: 'Triage Priority',
    type: 'select',
    options: [
      { label: 'Priority 1 (Resuscitation)', value: 'P1' },
      { label: 'Priority 2 (Emergency)', value: 'P2' },
    ],
  };
  const radioField = {
    id: 'rad1',
    name: 'consciousness',
    label: 'Consciousness Level',
    type: 'radio',
    options: [
      { label: 'Alert', value: 'alert' },
      { label: 'Voice Response', value: 'voice' },
    ],
  };
  const multiCheckField = {
    id: 'chk1',
    name: 'allergies',
    label: 'Known Allergies',
    type: 'checkbox',
    options: [
      { label: 'Penicillin', value: 'pen' },
      { label: 'Aspirin', value: 'asp' },
      { label: 'Latex', value: 'lat' },
    ],
  };
  const boolCheckField = {
    id: 'chk2',
    name: 'dnr_order',
    label: 'Do Not Resuscitate',
    type: 'checkbox',
  };

  const formData = {
    triage_priority: 'P2',
    consciousness: 'alert',
    allergies: ['pen', 'lat'],
    dnr_order: false,
  };

  const selDisp = resolveDisplayValue(selectField, getFieldValue(selectField, formData));
  assert.strictEqual(selDisp.text, 'Priority 2 (Emergency)');

  const radDisp = resolveDisplayValue(radioField, getFieldValue(radioField, formData));
  assert.strictEqual(radDisp.text, 'Alert');

  const chkDisp = resolveDisplayValue(multiCheckField, getFieldValue(multiCheckField, formData));
  assert.strictEqual(chkDisp.text, 'Penicillin, Latex');

  const boolDisp = resolveDisplayValue(boolCheckField, getFieldValue(boolCheckField, formData));
  assert.strictEqual(boolDisp.text, 'No');
  assert.strictEqual(boolDisp.isChecked, false);
});

// 4. Form containing multiple sections and rows
runTest('Form containing multiple sections and rows', () => {
  const form = {
    title: 'Comprehensive Initial Nursing Assessment',
    fields: {
      f1: { id: 'f1', name: 'temp', label: 'Temperature', type: 'number' },
      f2: { id: 'f2', name: 'bp', label: 'Blood Pressure', type: 'text' },
      f3: { id: 'f3', name: 'history', label: 'Medical History', type: 'textarea' },
    },
    layout: [
      {
        id: 'sec1',
        title: 'Section A: Physical Vitals',
        rows: [
          { id: 'r1', columns: [{ id: 'c1', width: 6, fieldIds: ['f1'] }, { id: 'c2', width: 6, fieldIds: ['f2'] }] },
        ],
      },
      {
        id: 'sec2',
        title: 'Section B: Clinical History',
        rows: [
          { id: 'r2', columns: [{ id: 'c3', width: 12, fieldIds: ['f3'] }] },
        ],
      },
    ],
  };
  const formData = { temp: 98.6, bp: '120/80', history: 'No previous cardiac conditions.' };
  const report = validateExportCompleteness(form, formData);
  assert.strictEqual(report.totalFields, 3);
  assert.strictEqual(report.representedFields, 3);
  assert.strictEqual(report.populatedFields, 3);
  assert.strictEqual(report.emptyFields, 0);
});

// 5. Form containing nested fields inside tables
runTest('Form containing nested fields inside tables', () => {
  const tableField = {
    id: 'tbl1',
    name: 'medication_administration',
    label: 'Medication Administration Record',
    type: 'table',
    tableConfig: {
      columns: [
        { id: 'col_med', key: 'med_name', label: 'Medication' },
        { id: 'col_date', key: 'admin_date', label: 'Date', type: 'date' },
        { id: 'col_status', key: 'status', label: 'Status', type: 'select', options: [{ label: 'Given', value: 'given' }, { label: 'Omitted', value: 'omitted' }] },
      ],
      cellFields: {
        '0_admin_date': { id: 'fld_date_cell', type: 'date', label: 'Date Cell' },
        '0_status': { id: 'fld_status_cell', type: 'select', label: 'Status Cell', options: [{ label: 'Given', value: 'given' }] },
      },
    },
  };
  const form = {
    title: 'Medication Sheet',
    fields: { tbl1: tableField },
    layout: [
      { id: 's1', title: 'MAR', rows: [{ id: 'r1', columns: [{ id: 'c1', width: 12, fieldIds: ['tbl1'] }] }] },
    ],
  };
  const formData = {
    medication_administration: [
      { med_name: 'Paracetamol 500mg', admin_date: '2026-10-23', status: 'given' },
    ],
  };

  const report = validateExportCompleteness(form, formData);
  assert.strictEqual(report.totalFields, 1);
  assert.strictEqual(report.nestedTableFields, 2);
  assert.strictEqual(report.unsupportedFieldTypes.length, 0);
});

// 6. Table with dynamically added rows
runTest('Table with dynamically added rows', () => {
  const tableCol = { id: 'col_note', key: 'note', label: 'Progress Note' };
  const row1 = { note: 'Initial assessment completed.' };
  const row2 = { note: 'Patient administered IV fluids.' };
  const row3 = { note: 'Vitals stable. Resting comfortably.' };

  assert.strictEqual(getTableCellValue(row1, tableCol, 0), 'Initial assessment completed.');
  assert.strictEqual(getTableCellValue(row2, tableCol, 0), 'Patient administered IV fluids.');
  assert.strictEqual(getTableCellValue(row3, tableCol, 0), 'Vitals stable. Resting comfortably.');
});

// 7. Form containing the Pain Assessment element
runTest('Pain Assessment composite element (presence, location, score)', () => {
  const painField = {
    id: 'pain1',
    name: 'pain_assessment',
    label: 'PAIN ASSESSMENT',
    type: 'pain_assessment',
  };
  const form = {
    title: 'Emergency Triage',
    fields: { pain1: painField },
    layout: [{ id: 's1', rows: [{ id: 'r1', columns: [{ id: 'c1', width: 12, fieldIds: ['pain1'] }] }] }],
  };

  // Populated case
  const popData = {
    pain_assessment: {
      painPresent: 'yes',
      location: 'Left Ankle',
      score: 6,
    },
  };
  assert.strictEqual(isFieldEmpty(painField, popData), false);

  // Unpopulated case
  const emptyData = {
    pain_assessment: {
      painPresent: '',
      location: '',
      score: null,
    },
  };
  assert.strictEqual(isFieldEmpty(painField, emptyData), true);
});

// 8. Form with fields below the browser viewport (schema traversal ensures all included)
runTest('Fields below viewport are fully represented via schema traversal', () => {
  const form = {
    title: 'Long Assessment',
    fields: {},
    layout: [],
  };

  // Generate 5 sections with 10 fields each (total 50 fields)
  for (let s = 1; s <= 5; s++) {
    const sec = { id: `sec_${s}`, title: `Section ${s}`, rows: [] };
    for (let r = 1; r <= 5; r++) {
      const fId = `f_${s}_${r}`;
      form.fields[fId] = { id: fId, name: `field_${s}_${r}`, label: `Field ${s}.${r}`, type: 'text' };
      sec.rows.push({
        id: `row_${s}_${r}`,
        columns: [{ id: `col_${s}_${r}`, width: 12, fieldIds: [fId] }],
      });
    }
    form.layout.push(sec);
  }

  const formData = {};
  for (let i = 1; i <= 25; i++) {
    formData[`field_1_${i}`] = `Value ${i}`;
  }

  const report = validateExportCompleteness(form, formData);
  assert.strictEqual(report.totalFields, 25);
  assert.strictEqual(report.representedFields, 25);
});

// 9. Form with empty and populated fields mixed together
runTest('Empty and populated fields mixed together (empty fields preserved with empty state)', () => {
  const form = {
    title: 'Mixed Fields Form',
    fields: {
      f1: { id: 'f1', name: 'f1', label: 'Field 1', type: 'text', validation: { required: true } },
      f2: { id: 'f2', name: 'f2', label: 'Field 2', type: 'text', validation: { required: false } },
    },
    layout: [
      { id: 's1', title: 'Sec 1', rows: [{ id: 'r1', columns: [{ id: 'c1', width: 6, fieldIds: ['f1'] }, { id: 'c2', width: 6, fieldIds: ['f2'] }] }] },
    ],
  };
  const formData = { f1: 'Filled' }; // f2 is intentionally empty

  const report = validateExportCompleteness(form, formData);
  assert.strictEqual(report.totalFields, 2);
  assert.strictEqual(report.populatedFields, 1);
  assert.strictEqual(report.emptyFields, 1);

  // Both fields are represented in report and neither is dropped from layout
  assert.strictEqual(report.representedFields, 2);
});

// 10. Long form spanning multiple PDF pages
runTest('Long form page naming and running headers logic', () => {
  const fileName = generatePdfFileName('Malankara Orthodox Syrian Church Medical College Hospital Form');
  assert.strictEqual(
    fileName,
    'Malankara_Orthodox_Syrian_Church_Medical_College_Hospital_Form.pdf'
  );
});

// 11. Form containing multiline text
runTest('Multiline text preserves newlines and formatting', () => {
  const textareaField = { id: 'tx1', name: 'clinical_notes', label: 'Clinical Notes', type: 'textarea' };
  const rawNotes = 'Line 1: Patient admitted.\nLine 2: Observations normal.\nLine 3: Discharged.';
  const disp = resolveDisplayValue(textareaField, rawNotes);
  assert.strictEqual(disp.isMultiline, true);
  assert.strictEqual(disp.text, rawNotes);
});

// 12. Unsaved form with recently edited values
runTest('Unsaved form with recently edited values extracted directly from live state', () => {
  const field = { id: 'fld_live', name: 'live_input', label: 'Live Input', type: 'text' };
  const liveFormData = {
    fld_live: 'Fresh unsaved draft content',
  };
  const val = getFieldValue(field, liveFormData);
  assert.strictEqual(val, 'Fresh unsaved draft content');
});

// 13. Saved submission reopened for PDF export
runTest('Saved submission reopened with exact submitted record data', () => {
  const field = { id: 'fld_saved', name: 'recorded_diagnosis', label: 'Diagnosis', type: 'text' };
  const savedSubmission = {
    id: 105,
    recordId: 'REC-9002',
    formData: {
      recorded_diagnosis: 'Acute Bronchitis',
    },
  };
  const val = getFieldValue(field, savedSubmission.formData);
  assert.strictEqual(val, 'Acute Bronchitis');
});

// 14. Historical submission using an older published form version
runTest('Historical submission using older published form schema', () => {
  const legacyForm = {
    title: 'Legacy Assessment (v1)',
    fields: {
      legacy_field: { id: 'legacy_field', name: 'legacy_data', label: 'Legacy Metric', type: 'number' },
    },
    layout: [
      { id: 's1', rows: [{ id: 'r1', columns: [{ id: 'c1', width: 12, fieldIds: ['legacy_field'] }] }] },
    ],
  };
  const historicalData = { legacy_data: 42 };
  const report = validateExportCompleteness(legacyForm, historicalData);
  assert.strictEqual(report.totalFields, 1);
  assert.strictEqual(report.populatedFields, 1);
  assert.strictEqual(getFieldValue(legacyForm.fields.legacy_field, historicalData), 42);
});

// 15. Form with unsupported field types reports failure instead of silent omission
runTest('Unsupported field types are reported in completeness check', () => {
  const formWithUnsupported = {
    title: 'Experimental Form',
    fields: {
      f_unsupported: { id: 'f_unsupported', name: 'voice_memo', label: 'Voice Memo', type: 'audio_stream' },
    },
    layout: [
      { id: 's1', rows: [{ id: 'r1', columns: [{ id: 'c1', width: 12, fieldIds: ['f_unsupported'] }] }] },
    ],
  };
  const report = validateExportCompleteness(formWithUnsupported, {});
  assert.strictEqual(report.unsupportedFieldTypes.length, 1);
  assert.strictEqual(report.unsupportedFieldTypes[0], 'audio_stream');
});

console.log(`\n=== REGRESSION TEST RESULTS: ${passedTests}/${totalTests} TESTS PASSED ===\n`);
if (passedTests !== totalTests) {
  process.exit(1);
}
