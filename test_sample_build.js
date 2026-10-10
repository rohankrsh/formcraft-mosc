import * as XLSX_NS from 'xlsx';
const XLSX = (XLSX_NS && XLSX_NS.default) ? XLSX_NS.default : XLSX_NS;
import { parseExcelSheetToForm } from './server/excelParser.js';

const wb = XLSX.utils.book_new();

// Sheet 1: Comprehensive Medical Intake Form
const wsData = [
  ['Patient Intake & Clinical Assessment Form', '', '', ''], // Row 0 (main title)
  ['Personal Details', '', '', ''],                          // Row 1 (section header)
  ['Full Name*', '', 'Date of Birth', ''],                   // Row 2 (text + date)
  ['Age', '', 'Gender', ''],                                 // Row 3 (number + dropdown)
  ['Primary Phone', '', 'Email Address', ''],                // Row 4 (number + text)
  ['Medical History', '', '', ''],                           // Row 5 (section header)
  ['Known Allergies Notes', '', '', ''],                     // Row 6 (textarea)
  ['Current Medications Table', '', '', ''],                 // Row 7 (table header section)
  ['Medication Name', 'Dosage', 'Frequency', 'Prescriber'],  // Row 8 (repeated table headers)
  ['Amoxicillin', '500mg', 'TID', 'Dr. Smith'],              // Row 9 (table row 1)
  ['Lisinopril', '10mg', 'Daily', 'Dr. Jones'],              // Row 10 (table row 2)
  ['Consent & Confirmation', '', '', ''],                    // Row 11 (section header)
  ['Agree to terms and conditions (Yes / No)', '']           // Row 12 (checkbox)
];

const ws = XLSX.utils.aoa_to_sheet(wsData);

// Set merges
ws['!merges'] = [
  { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }, // Row 0 merged A1:D1
  { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } }, // Row 1 merged A2:D2
  { s: { r: 5, c: 0 }, e: { r: 5, c: 3 } }, // Row 5 merged A6:D6
  { s: { r: 6, c: 0 }, e: { r: 6, c: 3 } }, // Row 6 merged A7:D7
  { s: { r: 7, c: 0 }, e: { r: 7, c: 3 } }, // Row 7 merged A8:D8
  { s: { r: 11, c: 0 }, e: { r: 11, c: 3 } } // Row 11 merged A12:D12
];

// Add data validations
ws['!dataValidation'] = [
  {
    sqref: 'D4',
    type: 'list',
    formula1: '"Male,Female,Other,Prefer not to say"'
  },
  {
    sqref: 'B4',
    type: 'whole',
    formula1: '0',
    formula2: '120'
  }
];

XLSX.utils.book_append_sheet(wb, ws, 'Patient Intake');
XLSX.writeFile(wb, 'sample_intake_form.xlsx');

console.log('Sample comprehensive workbook created: sample_intake_form.xlsx');

const parsed = parseExcelSheetToForm(wb, 'Patient Intake');
console.log('=== PARSED FORM SUMMARY ===');
console.log('Form Title:', parsed.title);
console.log('Total Sections:', parsed.layout.length);
parsed.layout.forEach((s, i) => {
  console.log(`\nSection ${i + 1}: "${s.title}" (_needsReview: ${!!s._needsReview})`);
  s.rows.forEach((r, ri) => {
    const fNames = r.columns.flatMap(c => c.fieldIds.map(fid => {
      const f = parsed.fields[fid];
      return `"${f.label}" [${f.type}, colWidth: ${c.width}, req: ${!!f.validation?.required}, rev: ${!!f._needsReview}${f.options ? `, opts: ${f.options.length}` : ''}]`;
    }));
    console.log(`  Row ${ri + 1} (${r.columns.length} cols, totalWidth: ${r.columns.reduce((a, b) => a + b.width, 0)}): ${fNames.join(' | ')}`);
  });
});
