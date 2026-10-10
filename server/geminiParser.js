import * as XLSX_NS from 'xlsx';
const XLSX = (XLSX_NS && XLSX_NS.default) ? XLSX_NS.default : XLSX_NS;

/**
 * Creates a unique random ID.
 */
function createId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
}

/**
 * Slugifies a label into a clean, deterministic field name.
 */
function slugify(text, fallback) {
  let base = String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!base) base = fallback || 'field';
  return base.substring(0, 40);
}

/**
 * Resolves cell reference or defined name from workbook.
 */
function resolveRangeValues(workbook, refStr, currentSheetName) {
  try {
    let sheetName = currentSheetName;
    let cellRef = String(refStr || '').trim();

    if (cellRef.includes('!')) {
      const parts = cellRef.split('!');
      sheetName = parts[0].replace(/['"]/g, '');
      cellRef = parts[1];
    } else if (!/^\$?[A-Z]+\$?\d+(:\$?[A-Z]+\$?\d+)?$/i.test(cellRef)) {
      const names = (workbook.Workbook && workbook.Workbook.Names) || [];
      const defined = names.find(
        (n) => n.Name && n.Name.toLowerCase() === cellRef.toLowerCase()
      );
      if (defined && defined.Ref) {
        let ref = defined.Ref.replace(/^=/, '');
        if (ref.includes('!')) {
          const parts = ref.split('!');
          sheetName = parts[0].replace(/['"]/g, '');
          cellRef = parts[1];
        } else {
          cellRef = ref;
        }
      } else {
        return [];
      }
    }

    cellRef = cellRef.replace(/\$/g, '');
    const ws = workbook.Sheets[sheetName];
    if (!ws) return [];

    if (cellRef.includes(':')) {
      const range = XLSX.utils.decode_range(cellRef);
      const values = [];
      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
          if (cell && cell.v !== undefined && cell.v !== '') {
            values.push(String(cell.w || cell.v).trim());
          }
        }
      }
      return values;
    } else {
      const cell = ws[cellRef];
      if (cell && cell.v !== undefined && cell.v !== '') {
        return [String(cell.w || cell.v).trim()];
      }
    }
  } catch (e) {
    console.warn('[geminiParser] Range resolution error:', refStr, e);
  }
  return [];
}

/**
 * Extracts comprehensive structural and spatial representation of the worksheet
 * to provide maximum context to Gemini.
 */
export function extractSheetContext(workbook, sheetName) {
  const ws = workbook.Sheets[sheetName];
  if (!ws || !ws['!ref']) {
    throw new Error(`Worksheet "${sheetName}" is empty or has no cells.`);
  }

  const range = XLSX.utils.decode_range(ws['!ref']);
  const merges = ws['!merges'] || [];
  const validations = ws['!dataValidation'] || ws['!validations'] || [];

  // Helper for merge at (r, c)
  const getMerge = (r, c) => {
    return merges.find(
      (m) => r >= m.s.r && r <= m.e.r && c >= m.s.c && c <= m.e.c
    );
  };

  // Helper for data validation
  const getValidation = (r, c) => {
    for (const dv of validations) {
      if (!dv.sqref) continue;
      const ranges = dv.sqref.split(/\s+/);
      for (const rangeStr of ranges) {
        try {
          const decoded = XLSX.utils.decode_range(rangeStr);
          if (
            r >= decoded.s.r &&
            r <= decoded.e.r &&
            c >= decoded.s.c &&
            c <= decoded.e.c
          ) {
            return dv;
          }
        } catch {
          try {
            const cell = XLSX.utils.decode_cell(rangeStr);
            if (cell.r === r && cell.c === c) return dv;
          } catch { }
        }
      }
    }
    return null;
  };

  const rows = [];
  const asciiLines = [];

  for (let r = range.s.r; r <= range.e.r; r++) {
    const rowCells = [];
    const asciiCells = [];
    let hasAnyData = false;

    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      const merge = getMerge(r, c);
      const isMergeOrigin = merge ? merge.s.r === r && merge.s.c === c : false;
      const isInsideMerge = merge && !isMergeOrigin;

      if (isInsideMerge) {
        // Skip interior merged cell in ASCII
        continue;
      }

      const text = cell ? String(cell.w || cell.v || '').trim() : '';
      const val = cell ? cell.v : undefined;
      const type = cell ? cell.t : 'blank';
      const dv = getValidation(r, c);

      let validationInfo = null;
      if (dv) {
        let opts = [];
        if (dv.type === 'list' && dv.formula1) {
          let f = String(dv.formula1).trim();
          if (f.startsWith('"') && f.endsWith('"')) {
            opts = f.slice(1, -1).split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
          } else {
            opts = resolveRangeValues(workbook, f, sheetName);
          }
        }
        validationInfo = {
          type: dv.type,
          formula1: dv.formula1,
          formula2: dv.formula2,
          resolvedOptions: opts.length > 0 ? opts : undefined,
        };
      }

      if (text || dv || merge) {
        hasAnyData = true;
      }

      const cellData = {
        address: addr,
        r,
        c,
        text,
        value: val,
        type,
        isMerged: !!merge,
        mergeSpan: merge
          ? {
            colSpan: merge.e.c - merge.s.c + 1,
            rowSpan: merge.e.r - merge.s.r + 1,
          }
          : null,
        validation: validationInfo,
      };

      rowCells.push(cellData);

      // Construct visual ASCII cell
      let cellDesc = `[${addr}`;
      if (merge) {
        cellDesc += ` (Span: ${merge.e.c - merge.s.c + 1} cols)`;
      }
      if (text) {
        cellDesc += `: "${text}"`;
      } else {
        cellDesc += `: <BLANK/INPUT>`;
      }
      if (validationInfo) {
        if (validationInfo.resolvedOptions) {
          cellDesc += ` (Dropdown: ${validationInfo.resolvedOptions.join(', ')})`;
        } else if (validationInfo.type === 'whole' || validationInfo.type === 'decimal') {
          cellDesc += ` (Number: ${validationInfo.formula1 || 0}-${validationInfo.formula2 || 'max'})`;
        }
      }
      cellDesc += `]`;
      asciiCells.push(cellDesc);
    }

    if (hasAnyData) {
      rows.push({ rowIndex: r + 1, cells: rowCells });
      asciiLines.push(`Row ${r + 1}: ` + asciiCells.join('  '));
    }
  }

  return {
    sheetName,
    usedRange: ws['!ref'],
    totalCols: range.e.c - range.s.c + 1,
    mergesCount: merges.length,
    validationsCount: validations.length,
    asciiLayout: asciiLines.join('\n'),
    rows,
  };
}

/**
 * Normalizes and validates the FormDefinition returned by Gemini to guarantee
 * 100% schema compliance and 12-column grid row math.
 */
export function validateAndNormalizeForm(rawJson, sheetName) {
  let form = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;

  // Handle case where Gemini wraps response inside { form: ... } or { formDefinition: ... }
  if (form.formDefinition && typeof form.formDefinition === 'object') {
    form = form.formDefinition;
  } else if (form.form && typeof form.form === 'object' && !form.fields) {
    form = form.form;
  }

  // Ensure top-level fields
  form.version = '1.0.0';
  form.id = form.id || createId('form');
  form.title = form.title || `${sheetName} Form`;
  form.description = form.description || `Generated from ${sheetName}`;

  if (!form.settings || typeof form.settings !== 'object') {
    form.settings = {
      submitButtonText: 'Submit Form',
      submitAction: 'download_json',
      showResetButton: true,
      resetButtonText: 'Clear Form',
      theme: {
        primaryColor: '#2563eb',
        borderRadius: 'md',
        fontFamily: 'Inter, system-ui, sans-serif',
      },
    };
  }

  if (!form.fields || typeof form.fields !== 'object') {
    form.fields = {};
  }

  if (!Array.isArray(form.layout) || form.layout.length === 0) {
    // If layout is missing, construct default section from fields
    form.layout = [
      {
        id: createId('sec'),
        title: form.title,
        collapsible: false,
        rows: [],
      },
    ];
  }

  const validFieldTypes = new Set([
    'text',
    'textarea',
    'number',
    'date',
    'select',
    'radio',
    'checkbox',
    'heading',
    'divider',
    'table',
  ]);

  const existingFieldIds = new Set(Object.keys(form.fields));

  // Normalize fields dictionary
  for (const [fId, field] of Object.entries(form.fields)) {
    if (!field.id) field.id = fId;
    if (!field.name) field.name = slugify(field.label, 'field');
    if (!validFieldTypes.has(field.type)) {
      // Map unknown type to text
      field.type = 'text';
    }
    if (!field.label) field.label = 'Field';
    if (field.type === 'select' || field.type === 'radio') {
      if (!Array.isArray(field.options) || field.options.length === 0) {
        field.options = [
          { label: 'Option 1', value: 'option_1' },
          { label: 'Option 2', value: 'option_2' },
        ];
        field._needsReview = true;
        field._reviewReason = 'Dropdown options could not be fully identified; verify choices.';
      }
    }
    if (field.type === 'table') {
      if (!field.tableConfig || typeof field.tableConfig !== 'object') {
        field.tableConfig = {
          columns: [
            { id: 'col_1', label: 'Item / Description', type: 'text' },
            { id: 'col_2', label: 'Category', type: 'text' },
            { id: 'col_3', label: 'Quantity / Value', type: 'text' },
          ],
          allowAddRows: true,
          minRows: 1,
          defaultRows: [],
        };
      }
      if (!Array.isArray(field.tableConfig.columns) || field.tableConfig.columns.length === 0) {
        field.tableConfig.columns = [
          { id: 'col_1', label: 'Column 1', type: 'text' },
          { id: 'col_2', label: 'Column 2', type: 'text' },
        ];
      }
      field.tableConfig.columns.forEach((col, cIdx) => {
        if (!col.id) col.id = `col_${cIdx + 1}`;
        if (!col.label) col.label = `Column ${cIdx + 1}`;
      });
      if (!Array.isArray(field.tableConfig.defaultRows)) {
        field.tableConfig.defaultRows = [];
      }
      if (field.tableConfig.allowAddRows === undefined) {
        field.tableConfig.allowAddRows = true;
      }
    }
    if (field.validation && typeof field.validation !== 'object') {
      field.validation = {};
    }
  }

  // Normalize sections and enforce 12-column grid rule in every row
  form.layout.forEach((section, sIdx) => {
    if (!section.id) section.id = createId('sec');
    if (!section.title) section.title = `Section ${sIdx + 1}`;
    if (!Array.isArray(section.rows)) section.rows = [];

    section.rows.forEach((row) => {
      if (!row.id) row.id = createId('row');
      if (!Array.isArray(row.columns)) row.columns = [];

      // Filter out invalid columns or ensure fieldIds exists
      row.columns = row.columns.filter((col) => col && typeof col === 'object');

      if (row.columns.length === 0) return;

      row.columns.forEach((col) => {
        if (!col.id) col.id = createId('col');
        if (!Array.isArray(col.fieldIds)) col.fieldIds = [];

        // Verify referenced fields exist, create fallback if missing
        col.fieldIds.forEach((fid) => {
          if (!form.fields[fid]) {
            form.fields[fid] = {
              id: fid,
              name: `field_${fid.substring(0, 6)}`,
              type: 'text',
              label: 'Input Field',
              placeholder: 'Enter text...',
              defaultValue: '',
              validation: { required: false },
              dataBinding: null,
            };
            existingFieldIds.add(fid);
          }
        });
      });

      // Enforce 12-column math: sum of column widths in each row must be exactly 12
      const rawWidths = row.columns.map((col) => Math.max(1, Math.min(12, Number(col.width) || 1)));
      const sum = rawWidths.reduce((a, b) => a + b, 0);

      if (sum !== 12) {
        // Proportional snapping to exactly 12
        let snapped = rawWidths.map((w) => Math.max(1, Math.round((w / sum) * 12)));
        let currentSum = snapped.reduce((a, b) => a + b, 0);

        while (currentSum !== 12) {
          if (currentSum > 12) {
            let maxIdx = 0;
            for (let i = 1; i < snapped.length; i++) {
              if (snapped[i] > snapped[maxIdx]) maxIdx = i;
            }
            if (snapped[maxIdx] > 1) {
              snapped[maxIdx]--;
              currentSum--;
            } else {
              break;
            }
          } else {
            let minIdx = 0;
            for (let i = 1; i < snapped.length; i++) {
              if (snapped[i] < snapped[minIdx]) minIdx = i;
            }
            snapped[minIdx]++;
            currentSum++;
          }
        }

        row.columns.forEach((col, idx) => {
          col.width = snapped[idx];
        });
      }
    });

    // Remove empty rows
    section.rows = section.rows.filter((r) => r.columns.length > 0);
  });

  return form;
}

/**
 * Calls Gemini 2.5 Flash API with structured JSON output to analyze the Excel sheet
 * and generate a precision FormDefinition.
 */
export async function generateFormWithGemini(workbook, sheetName, apiKey) {
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in .env file.');
  }

  // 1. Extract high-fidelity sheet context
  const context = extractSheetContext(workbook, sheetName);

  // 2. Build the system instruction and prompt
  const systemInstruction = `
You are an expert Enterprise Form Designer and Data Modeling Architect.
Your task is to analyze the provided Excel worksheet's 2D layout and convert it into a precision "FormDefinition" JSON object that matches the exact platform schema.

TARGET TYPESCRIPT SCHEMA:
\`\`\`typescript
type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'radio' | 'checkbox' | 'heading' | 'divider' | 'table';

interface FieldOption { label: string; value: string; }

interface TableColumn {
  id: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'select';
  placeholder?: string;
  options?: FieldOption[];
}

interface TableConfig {
  columns: TableColumn[];
  minRows?: number;
  maxRows?: number;
  allowAddRows?: boolean;
  defaultRows?: Record<string, any>[];
}

interface ValidationRules {
  required?: boolean;
  min?: number; max?: number;
  minLength?: number; maxLength?: number;
}

interface FormField {
  id: string; // e.g. "fld_1", "fld_fullname"
  name: string; // alphanumeric identifier e.g. "full_name"
  type: FieldType;
  label: string;
  placeholder?: string;
  defaultValue?: string | number | boolean | string[];
  options?: FieldOption[]; // Required for select/radio
  tableConfig?: TableConfig; // Required for type: 'table'
  validation?: ValidationRules;
  _needsReview?: boolean; // Set true if field is ambiguous
  _reviewReason?: string; // Explain why manual review is suggested
}

interface LayoutColumn {
  id: string;
  width: number; // Integer 1-12. In each row, the SUM OF ALL column widths MUST equal 12.
  fieldIds: string[]; // Field IDs inside this column
}

interface LayoutRow {
  id: string;
  columns: LayoutColumn[];
}

interface LayoutSection {
  id: string;
  title: string;
  description?: string;
  collapsible?: boolean;
  rows: LayoutRow[];
  _needsReview?: boolean;
  _reviewReason?: string;
}

interface FormDefinition {
  version: '1.0.0';
  id: string;
  title: string;
  description?: string;
  settings: {
    submitButtonText: string;
    submitAction: 'download_json' | 'print';
    showResetButton: boolean;
    resetButtonText?: string;
    theme: {
      primaryColor: string;
      borderRadius: 'none' | 'sm' | 'md' | 'lg' | 'full';
      fontFamily: string;
    };
  };
  fields: Record<string, FormField>; // Keyed by field id
  layout: LayoutSection[];
}
\`\`\`

CRITICAL DESIGN RULES:
1. SECTIONS:
   - Identify section headers (e.g. "Personal Details", "Medical History", "Consent & Acknowledgement") from merged header banners or title rows.
   - Group related fields under their corresponding section.

2. FIELDS & LABELS:
   - Identify label cells and their corresponding adjacent or stacked input cells.
   - Strip asterisks and trailing colons from labels, setting \`validation.required: true\` if asterisk (*) is present.
   - Classify types accurately:
     - 'date': labels like "Date of Birth", "Hire Date", date formats.
     - 'number': ages, phone numbers, zip codes, quantities, prices, weights, heights, scores. Include min/max if specified.
     - 'select': native dropdown lists or options like gender. Populate \`options: [{ label, value }]\`.
     - 'checkbox': Yes/No, agree/confirm, or checkbox-like glyphs (☐/☑).
     - 'textarea': multi-line notes, remarks, comments, physical address, reason.
     - 'text': standard single-line text fallback.

3. 12-COLUMN RESPONSIVE LAYOUT (MANDATORY):
   - In every \`LayoutRow\`, the sum of \`column.width\` across all columns in that row MUST EQUAL 12.
     - Single field across full width: 1 column with width 12.
     - Two side-by-side fields (e.g. First Name + Last Name): 2 columns, each with width 6.
     - Three side-by-side fields (e.g. City + State + Zip): 3 columns, each with width 4.
     - Four fields: 4 columns, each with width 3.

4. TABLES & DATA GRIDS (CRITICAL):
   - When you detect a table or grid structure (e.g., Medication Name / Dosage / Frequency / Prescriber, Line Items, Expenses, Family Members, Diagnosis history):
     DO NOT generate multiple separate input fields across rows!
     Instead, create a SINGLE FormField of type 'table' with:
     - 'label': Title of the table
     - 'tableConfig': {
         'columns': [
           { 'id': 'col_1', 'label': 'Column Header 1', 'type': 'text' },
           { 'id': 'col_2', 'label': 'Column Header 2', 'type': 'text' | 'number' | 'date' | 'select' },
           ...
         ],
         'defaultRows': [
           // Pre-filled row objects from the spreadsheet
           { 'col_1': 'Value 1', 'col_2': 'Value 2' }
         ],
         'allowAddRows': true
       }
     - Place this single table field in a row with width 12 so it spans the full container.

5. OUTPUT:
   - Return ONLY the valid JSON object conforming to \`FormDefinition\`. No markdown, no explanations outside JSON.
`;

  const userPrompt = `
Here is the extracted worksheet structure for sheet "${sheetName}":
Total Columns Used: ${context.totalCols}
Merges: ${context.mergesCount}
Validations: ${context.validationsCount}

=== VISUAL 2D SPATIAL LAYOUT ===
${context.asciiLayout}

=== DETAILED ROW-BY-ROW CELL DATA ===
${JSON.stringify(context.rows, null, 2)}

Please analyze this layout and generate the complete, accurate FormDefinition JSON.
`;

  // 3. Call Google Gemini API with candidate model cascade prioritized by stability
  const candidateModels = [
    'gemini-flash-latest',
    'gemini-3.5-flash',
    'gemini-3.6-flash',
    'gemini-3.8-flash',
    'gemini-3.7-flash',
  ];

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [{ text: userPrompt }],
      },
    ],
    systemInstruction: {
      parts: [{ text: systemInstruction }],
    },
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
    },
  };

  let textOutput = '';
  let successfulModel = '';
  let lastError = null;

  for (const model of candidateModels) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[geminiParser] Calling ${model} (attempt ${attempt}/2) for sheet "${sheetName}"...`);
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errText = await response.text();
          console.warn(`[geminiParser] ${model} attempt ${attempt} returned HTTP ${response.status}: ${errText.substring(0, 150)}`);
          lastError = new Error(`HTTP ${response.status}: ${errText}`);
          if (response.status === 503 && attempt < 2) {
            console.log(`[geminiParser] ${model} is experiencing a temporary spike. Waiting 1.5s before retry...`);
            await new Promise((resolve) => setTimeout(resolve, 1500));
            continue;
          }
          break; // Try next candidate model
        }

        const result = await response.json();
        textOutput = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (textOutput) {
          successfulModel = model;
          break;
        }
      } catch (netErr) {
        console.warn(`[geminiParser] Network error with ${model}:`, netErr.message);
        lastError = netErr;
        break;
      }
    }
    if (textOutput) break;
  }

  if (!textOutput) {
    const errorMsg = lastError?.message || '';
    if (errorMsg.includes('503')) {
      throw new Error(
        'Google Gemini AI servers are currently experiencing high demand. Automatic retries across candidate models were attempted. Please try clicking "Convert" again in a few moments.'
      );
    }
    throw lastError || new Error('All Gemini candidate models failed to return a response.');
  }

  console.log(`[geminiParser] Response successfully received from ${successfulModel}. Normalizing schema...`);

  console.log('[geminiParser] Gemini response received. Validating & normalizing schema...');
  const normalizedForm = validateAndNormalizeForm(textOutput, sheetName);
  console.log(
    `[geminiParser] Successfully generated form: "${normalizedForm.title}" with ${Object.keys(normalizedForm.fields).length
    } fields across ${normalizedForm.layout.length} sections.`
  );

  return normalizedForm;
}
