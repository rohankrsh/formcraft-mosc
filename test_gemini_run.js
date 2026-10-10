import 'dotenv/config';
import * as XLSX_NS from 'xlsx';
const XLSX = (XLSX_NS && XLSX_NS.default) ? XLSX_NS.default : XLSX_NS;
import { generateFormWithGemini } from './server/geminiParser.js';

async function test() {
  const apiKey = process.env.GEMINI_API_KEY;
  console.log('Testing with GEMINI_API_KEY:', apiKey ? apiKey.substring(0, 10) + '...' : 'MISSING');

  const wb = XLSX.readFile('sample_intake_form.xlsx');
  console.log('Workbook sheets:', wb.SheetNames);

  const start = Date.now();
  const form = await generateFormWithGemini(wb, 'Patient Intake', apiKey);
  const elapsed = Date.now() - start;

  console.log(`\n=== GEMINI FORM GENERATION SUCCESSFUL (${elapsed}ms) ===`);
  console.log('Form Title:', form.title);
  console.log('Sections Count:', form.layout.length);
  console.log('Fields Count:', Object.keys(form.fields).length);

  form.layout.forEach((s, idx) => {
    console.log(`\nSection ${idx + 1}: "${s.title}" (_needsReview: ${!!s._needsReview})`);
    s.rows.forEach((r, rIdx) => {
      const colDetails = r.columns.map((c) => {
        const fields = c.fieldIds.map((fid) => {
          const f = form.fields[fid];
          return `${f.label} [${f.type}${f.options ? `, ${f.options.length} options` : ''}${f.validation?.required ? ', required' : ''}${f._needsReview ? ', reviewNeeded' : ''}]`;
        }).join(', ');
        return `Col(width ${c.width}): ${fields}`;
      }).join(' | ');
      const totalWidth = r.columns.reduce((sum, c) => sum + c.width, 0);
      console.log(`  Row ${rIdx + 1} (Sum=${totalWidth}): ${colDetails}`);
    });
  });
}

test().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
