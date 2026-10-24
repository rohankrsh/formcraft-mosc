// scripts/test-rearrangement.js
import assert from 'node:assert';

console.log('--- Starting Drag-and-Drop Rearrangement Test Suite ---');

// Mock a multi-section, multi-row hospital form
const createSampleForm = () => ({
  id: 'hospital_nursing_assessment',
  title: 'Inpatient Nursing Assessment',
  fields: {
    fld_name: { id: 'fld_name', name: 'patient_name', type: 'text', label: 'Patient Name' },
    fld_dob: { id: 'fld_dob', name: 'dob', type: 'date', label: 'Date of Birth' },
    fld_mrno: { id: 'fld_mrno', name: 'mrno', type: 'text', label: 'MRNO' },
    fld_pain: {
      id: 'fld_pain',
      name: 'pain_assessment',
      type: 'pain_assessment',
      label: 'Pain Assessment',
      defaultValue: { painPresent: 'yes', location: 'Lower Back', score: 6 },
    },
    fld_vitals_table: {
      id: 'fld_vitals_table',
      name: 'vitals_table',
      type: 'table',
      label: 'Vitals Log',
      tableConfig: { columns: [{ id: 'time', label: 'Time' }, { id: 'bp', label: 'BP' }] },
    },
    fld_notes: { id: 'fld_notes', name: 'nursing_notes', type: 'textarea', label: 'Notes' },
  },
  layout: [
    {
      id: 'sec_demographics',
      title: 'Section 1: Demographics',
      rows: [
        {
          id: 'row_demo_1',
          columns: [
            { id: 'col_demo_1a', width: 6, fieldIds: ['fld_name', 'fld_mrno'] },
            { id: 'col_demo_1b', width: 6, fieldIds: ['fld_dob'] },
          ],
        },
      ],
    },
    {
      id: 'sec_clinical',
      title: 'Section 2: Clinical Assessment',
      rows: [
        {
          id: 'row_clin_1',
          columns: [{ id: 'col_clin_1', width: 12, fieldIds: ['fld_pain'] }],
        },
        {
          id: 'row_clin_2',
          columns: [{ id: 'col_clin_2', width: 12, fieldIds: ['fld_vitals_table'] }],
        },
      ],
    },
    {
      id: 'sec_discharge',
      title: 'Section 3: Discharge Notes',
      rows: [
        {
          id: 'row_disc_1',
          columns: [{ id: 'col_disc_1', width: 12, fieldIds: ['fld_notes'] }],
        },
      ],
    },
  ],
});

// Replicate store functions to verify algorithm
function moveSection(form, sectionId, targetIndex) {
  const layout = [...form.layout];
  const currentIndex = layout.findIndex((s) => s.id === sectionId);
  if (currentIndex === -1) return form;

  const [movedSection] = layout.splice(currentIndex, 1);
  const clampedIndex = Math.max(0, Math.min(targetIndex, layout.length));
  layout.splice(clampedIndex, 0, movedSection);

  return { ...form, layout };
}

function moveRow(form, sourceSectionId, rowId, targetSectionId, targetIndex) {
  let sourceSecIndex = form.layout.findIndex((s) => s.id === sourceSectionId);
  if (sourceSecIndex === -1) {
    for (let i = 0; i < form.layout.length; i++) {
      if (form.layout[i].rows.some((r) => r.id === rowId)) {
        sourceSecIndex = i;
        break;
      }
    }
  }
  if (sourceSecIndex === -1) return form;

  const sourceSec = form.layout[sourceSecIndex];
  const sourceRowIndex = sourceSec.rows.findIndex((r) => r.id === rowId);
  if (sourceRowIndex === -1) return form;
  const rowToMove = sourceSec.rows[sourceRowIndex];

  const targetSecIndex = form.layout.findIndex((s) => s.id === targetSectionId);
  if (targetSecIndex === -1) return form;

  const newLayout = form.layout.map((sec) => ({
    ...sec,
    rows: [...sec.rows],
  }));

  if (sourceSecIndex === targetSecIndex) {
    const rows = newLayout[sourceSecIndex].rows;
    const [moved] = rows.splice(sourceRowIndex, 1);
    const clampedIndex = Math.max(0, Math.min(targetIndex, rows.length));
    rows.splice(clampedIndex, 0, moved);
  } else {
    newLayout[sourceSecIndex].rows.splice(sourceRowIndex, 1);
    const targetRows = newLayout[targetSecIndex].rows;
    const clampedIndex = Math.max(0, Math.min(targetIndex, targetRows.length));
    targetRows.splice(clampedIndex, 0, rowToMove);
  }

  return { ...form, layout: newLayout };
}

function moveField(form, fieldId, targetColumnId, targetIndex) {
  if (!form.fields[fieldId]) return form;

  let sourceColId = null;
  let sourceFieldIdx = -1;

  for (const sec of form.layout) {
    for (const row of sec.rows) {
      for (const col of row.columns) {
        const idx = col.fieldIds.indexOf(fieldId);
        if (idx !== -1) {
          sourceColId = col.id;
          sourceFieldIdx = idx;
          break;
        }
      }
      if (sourceColId) break;
    }
    if (sourceColId) break;
  }

  const newLayout = form.layout.map((sec) => ({
    ...sec,
    rows: sec.rows.map((row) => ({
      ...row,
      columns: row.columns.map((col) => {
        if (col.id === sourceColId && col.id === targetColumnId) {
          const ids = [...col.fieldIds];
          const [moved] = ids.splice(sourceFieldIdx, 1);
          let insertIdx = typeof targetIndex === 'number' ? targetIndex : ids.length;
          insertIdx = Math.max(0, Math.min(insertIdx, ids.length));
          ids.splice(insertIdx, 0, moved);
          return { ...col, fieldIds: ids };
        } else if (col.id === sourceColId) {
          return { ...col, fieldIds: col.fieldIds.filter((id) => id !== fieldId) };
        } else if (col.id === targetColumnId) {
          const ids = [...col.fieldIds];
          let insertIdx = typeof targetIndex === 'number' ? targetIndex : ids.length;
          insertIdx = Math.max(0, Math.min(insertIdx, ids.length));
          ids.splice(insertIdx, 0, fieldId);
          return { ...col, fieldIds: ids };
        }
        return col;
      }),
    })),
  }));

  return { ...form, layout: newLayout };
}

function moveFieldToNewRow(form, fieldId, targetSectionId, targetRowIndex) {
  if (!form.fields[fieldId]) return form;

  const targetSecIndex = form.layout.findIndex((s) => s.id === targetSectionId);
  if (targetSecIndex === -1) return form;

  const cleanedLayout = form.layout.map((sec) => ({
    ...sec,
    rows: sec.rows.map((row) => ({
      ...row,
      columns: row.columns.map((col) => ({
        ...col,
        fieldIds: col.fieldIds.filter((id) => id !== fieldId),
      })),
    })),
  }));

  const newColId = `col_new_${Date.now()}`;
  const newRow = {
    id: `row_new_${Date.now()}`,
    columns: [{ id: newColId, width: 12, fieldIds: [fieldId] }],
  };

  const finalLayout = cleanedLayout.map((sec, idx) => {
    if (idx !== targetSecIndex) return sec;
    const rows = [...sec.rows];
    const clampedIndex = Math.max(0, Math.min(targetRowIndex, rows.length));
    rows.splice(clampedIndex, 0, newRow);
    return { ...sec, rows };
  });

  return { ...form, layout: finalLayout };
}

// ------------------- TEST 1: Move last section to the beginning -------------------
console.log('Running Test 1: Move last section to the beginning...');
let form = createSampleForm();
form = moveSection(form, 'sec_discharge', 0);
assert.strictEqual(form.layout[0].id, 'sec_discharge');
assert.strictEqual(form.layout[1].id, 'sec_demographics');
assert.strictEqual(form.layout[2].id, 'sec_clinical');
assert.strictEqual(form.layout[0].rows[0].columns[0].fieldIds[0], 'fld_notes');
console.log('✓ Test 1 passed: Last section moved to beginning with all contents intact');

// ------------------- TEST 2: Move a section into the middle of the form -------------------
console.log('Running Test 2: Move section into middle of form...');
form = moveSection(form, 'sec_demographics', 2);
assert.strictEqual(form.layout[0].id, 'sec_discharge');
assert.strictEqual(form.layout[1].id, 'sec_clinical');
assert.strictEqual(form.layout[2].id, 'sec_demographics');
console.log('✓ Test 2 passed: Section moved to middle successfully');

// ------------------- TEST 3: Move a row between two existing rows -------------------
console.log('Running Test 3: Move row within same section...');
form = createSampleForm(); // sec_clinical has row_clin_1 (pain), row_clin_2 (vitals)
form = moveRow(form, 'sec_clinical', 'row_clin_2', 'sec_clinical', 0);
const clinRows = form.layout.find((s) => s.id === 'sec_clinical').rows;
assert.strictEqual(clinRows[0].id, 'row_clin_2');
assert.strictEqual(clinRows[1].id, 'row_clin_1');
console.log('✓ Test 3 passed: Row reordered within section');

// ------------------- TEST 4: Move a row from one section to another -------------------
console.log('Running Test 4: Move row between sections...');
form = createSampleForm();
// Move row_clin_1 (pain assessment) from sec_clinical to sec_demographics at index 1
form = moveRow(form, 'sec_clinical', 'row_clin_1', 'sec_demographics', 1);
const demoSec = form.layout.find((s) => s.id === 'sec_demographics');
const clinSec = form.layout.find((s) => s.id === 'sec_clinical');
assert.strictEqual(demoSec.rows.length, 2);
assert.strictEqual(demoSec.rows[1].id, 'row_clin_1');
assert.strictEqual(clinSec.rows.length, 1);
assert.strictEqual(clinSec.rows[0].id, 'row_clin_2');
console.log('✓ Test 4 passed: Row moved across sections cleanly without duplicates');

// ------------------- TEST 5: Reorder fields within the same column/row -------------------
console.log('Running Test 5: Reorder fields within the same column...');
form = createSampleForm(); // col_demo_1a has ['fld_name', 'fld_mrno']
form = moveField(form, 'fld_mrno', 'col_demo_1a', 0);
const col1a = form.layout[0].rows[0].columns[0];
assert.deepStrictEqual(col1a.fieldIds, ['fld_mrno', 'fld_name']);
console.log('✓ Test 5 passed: Fields reordered inside same column');

// ------------------- TEST 6: Move a field to another column in the same row -------------------
console.log('Running Test 6: Move field to another column in same row...');
form = moveField(form, 'fld_mrno', 'col_demo_1b', 0);
assert.deepStrictEqual(form.layout[0].rows[0].columns[0].fieldIds, ['fld_name']);
assert.deepStrictEqual(form.layout[0].rows[0].columns[1].fieldIds, ['fld_mrno', 'fld_dob']);
console.log('✓ Test 6 passed: Field moved to different column');

// ------------------- TEST 7: Move a field to another row in another section -------------------
console.log('Running Test 7: Move field across rows and sections...');
form = moveField(form, 'fld_name', 'col_disc_1', 1);
assert.deepStrictEqual(form.layout[0].rows[0].columns[0].fieldIds, []);
assert.deepStrictEqual(form.layout[2].rows[0].columns[0].fieldIds, ['fld_notes', 'fld_name']);
console.log('✓ Test 7 passed: Field moved to another section and row');

// ------------------- TEST 8: Drop a field into a new row -------------------
console.log('Running Test 8: Drop field into new row via moveFieldToNewRow...');
form = createSampleForm();
form = moveFieldToNewRow(form, 'fld_pain', 'sec_discharge', 0);
const discSec = form.layout.find((s) => s.id === 'sec_discharge');
assert.strictEqual(discSec.rows.length, 2);
assert.strictEqual(discSec.rows[0].columns[0].fieldIds[0], 'fld_pain');
// Ensure fld_pain was removed from old clinical section
const oldClinSec = form.layout.find((s) => s.id === 'sec_clinical');
assert.strictEqual(oldClinSec.rows[0].columns[0].fieldIds.includes('fld_pain'), false);
console.log('✓ Test 8 passed: Field created a new row in target section');

// ------------------- TEST 9: Specialized elements (Pain Assessment & Table) intact -------------------
console.log('Running Test 9: Verify specialized elements retain data & config...');
assert.strictEqual(form.fields.fld_pain.type, 'pain_assessment');
assert.strictEqual(form.fields.fld_pain.defaultValue.score, 6);
assert.strictEqual(form.fields.fld_vitals_table.type, 'table');
assert.strictEqual(form.fields.fld_vitals_table.tableConfig.columns.length, 2);
console.log('✓ Test 9 passed: Pain Assessment and Table retain all properties');

// ------------------- TEST 10: Invalid drop safety -------------------
console.log('Running Test 10: Invalid move safety...');
const beforeInvalid = JSON.stringify(form);
form = moveSection(form, 'non_existent_section', 0);
assert.strictEqual(JSON.stringify(form), beforeInvalid);
form = moveRow(form, 'sec_demographics', 'non_existent_row', 'sec_demographics', 0);
assert.strictEqual(JSON.stringify(form), beforeInvalid);
console.log('✓ Test 10 passed: Invalid drops do not corrupt layout');

console.log('\n--- ALL 10 UNIT / SCENARIO TESTS PASSED SUCCESSFULLY! ---');
