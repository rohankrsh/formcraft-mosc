import { validateAndNormalizeForm } from './geminiParser.js';

/**
 * Calls Google Gemini API with native multimodal PDF inline data to analyze
 * visual layout, typography, fields, and tables, returning a FormDefinition.
 */
export async function generateFormFromPdf(pdfBuffer, apiKey, options = {}) {
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in .env file.');
  }

  if (!pdfBuffer || pdfBuffer.length < 5) {
    throw new Error('PDF file buffer is empty or corrupted.');
  }

  const magicHeader = pdfBuffer.slice(0, 5).toString('ascii');
  if (!magicHeader.startsWith('%PDF-')) {
    throw new Error('The uploaded file is not a valid PDF document (missing standard "%PDF-" header). Please ensure the file is a genuine PDF.');
  }

  const base64Data = Buffer.from(pdfBuffer).toString('base64');
  const fileName = options.fileName || 'Uploaded Document';

  const systemInstruction = `
You are an expert Enterprise Clinical Form Designer and Document Layout Analyst for FormCraft.
Your task is to visually inspect the provided PDF document and convert it into a precision "FormDefinition" JSON object that matches the exact platform schema.

CRITICAL MULTI-PAGE COMPLETENESS MANDATE:
1. The uploaded PDF may contain MULTIPLE PAGES (Pages 1, 2, 3, 4, etc.).
2. You MUST convert EVERY SINGLE PAGE, EVERY SECTION, EVERY CHECKLIST, EVERY VITAL SIGN, and EVERY ASSESSMENT TABLE from the PDF.
3. DO NOT summarize. DO NOT omit or stop halfway. DO NOT skip any sections between the top and the bottom!
4. Process each page sequentially: Page 1, Page 2, Page 3, Page 4. Every section in the document must be represented in the "layout" array and all input fields in the "fields" object.

CRITICAL FIDELITY AND ZERO-HALLUCINATION MANDATE:
1. Extract ONLY what is VISIBLY PRINTED on the provided PDF document.
2. DO NOT invent, assume, or inject sections, clinical tools, or fields that are not in the document!
   - NEVER add a "Pain Assessment", "Morse Fall Risk", "Braden Scale", or any other specialized section or assessment widget unless that exact section title and content is visibly printed on the document.
   - If the document contains a rating scale, VAS score, score checklist item, or severity scale (e.g. "VAS score", "Score 0-10", pain rating faces), model it as a standard 'select', 'radio', 'number', or 'checkbox' field matching the exact words on the page.
   - The field type 'pain_assessment' is a specialized compound component (with Pain Present? Yes/No, anatomical location, and 0-10 faces) and MUST ONLY be used if the document explicitly contains a dedicated section specifically titled "PAIN ASSESSMENT" that has both "Pain Present" and "Location" fields. DO NOT use 'pain_assessment' for simple VAS scores, discharge criteria, or general pain ratings!

TARGET TYPESCRIPT SCHEMA:
\`\`\`typescript
type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'radio' | 'checkbox' | 'heading' | 'divider' | 'table' | 'pain_assessment';

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
  helpText?: string;
  defaultValue?: any;
  options?: FieldOption[]; // Required for select/radio
  tableConfig?: TableConfig; // Required for type: 'table'
  validation?: ValidationRules;
  _needsReview?: boolean;
  _reviewReason?: string;
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
   - Identify every main section banner, header, or clinical grouping across all pages using the EXACT title text visibly printed on the document (e.g. based strictly on the headings printed in the uploaded PDF).
   - DO NOT invent generic section names. DO NOT copy or assume sections from other clinical forms.
   - Group related fields under their corresponding visible section.

2. FIELDS & LABELS:
   - Identify labels and their associated input controls, lines, boxes, or fill-in areas exactly as written.
   - Detect required fields (* or "required" text) and set \`validation.required: true\`.
   - Accurately categorize field types:
     - 'pain_assessment': STRICTLY RESERVED ONLY for an explicit dedicated "PAIN ASSESSMENT" section that specifically includes "Pain Present" and "Location" questions. For all other rating scales, VAS scores, or facial score indicators, use 'select', 'radio', 'number', or 'checkbox' with appropriate options.
     - 'date': Dates of arrival, assessment, procedure, LMP, etc.
     - 'number': Age, Pulse, BP, SPO2, R.R., GRBS, Ht, Wt, scores.
     - 'select' / 'radio': Choices where user selects one option (e.g. Yes/No, Normal/Abnormal, Score choices).
     - 'checkbox': Checkbox lists, multiple selections, conditions, symptom checklists.
     - 'textarea': Multi-line paragraphs, comments, provisional diagnosis, remarks, orders.
     - 'text': Standard single-line text inputs (e.g. Patient Name, Consultant, Hosp No).

3. 12-COLUMN RESPONSIVE LAYOUT (MANDATORY):
   - In every \`LayoutRow\`, the sum of \`column.width\` across all columns in that row MUST EQUAL 12.
     - Full-width field: 1 column with width 12.
     - Two side-by-side fields: 2 columns, each with width 6.
     - Three side-by-side fields: 3 columns, each with width 4.
     - Four side-by-side fields: 4 columns, each with width 3.

4. TABLES & DATA GRIDS (CRITICAL):
   - Whenever you see any recurring row table structure (e.g. "Criteria | Points | Recovery Log | At Discharge" or monitoring logs):
     Create a FormField of type 'table' with appropriate 'columns' and 'allowAddRows: true'.
     Place this table in a row with width 12.

5. OUTPUT:
   - Return ONLY the valid JSON object conforming to \`FormDefinition\`. No markdown formatting outside JSON.
`;

  const userPrompt = `
Please inspect this attached PDF document ("${fileName}") thoroughly across ALL pages (Page 1 to final page).
Analyze its visual layout, section headers, form fields, checkboxes, vital signs, clinical scales, and any table structures strictly based on the content visibly printed on the document.
Generate the complete and accurate FormDefinition JSON according to the platform schema covering ALL elements from EVERY page without omissions and without inventing any unprinted sections.
`;

  // Candidate model cascade prioritized by stability, visual fidelity, and multi-page capacity
  const candidateModels = [
    'gemini-2.5-flash',
    'gemini-flash-latest',
    'gemini-2.5-pro',
    'gemini-3.5-flash',
    'gemini-3-flash-preview',
  ];

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: 'application/pdf',
              data: base64Data,
            },
          },
          {
            text: userPrompt,
          },
        ],
      },
    ],
    systemInstruction: {
      parts: [{ text: systemInstruction }],
    },
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
      maxOutputTokens: 65536,
    },
  };

  let textOutput = '';
  let successfulModel = '';
  let lastError = null;

  for (const model of candidateModels) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[pdfParser] Calling ${model} (attempt ${attempt}/2) for PDF "${fileName}" (${(pdfBuffer.length / 1024).toFixed(1)} KB)...`);
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 240000); // 4 minutes for comprehensive multi-page clinical analysis

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify(requestBody),
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errText = await response.text();
          console.warn(`[pdfParser] ${model} attempt ${attempt} returned HTTP ${response.status}: ${errText.substring(0, 150)}`);
          lastError = new Error(`HTTP ${response.status}: ${errText}`);
          if (response.status === 503 && attempt < 2) {
            console.log(`[pdfParser] ${model} is experiencing a temporary spike. Waiting 2s before retry...`);
            await new Promise((resolve) => setTimeout(resolve, 2000));
            continue;
          }
          break; // Move to next candidate model
        }

        const result = await response.json();
        textOutput = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (textOutput) {
          successfulModel = model;
          break;
        }
      } catch (netErr) {
        console.warn(`[pdfParser] Network/timeout error with ${model}:`, netErr.message);
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
        'Google Gemini AI servers are currently experiencing high demand. Automatic retries across all candidate models were attempted. Please try clicking "Convert" again in a few moments.'
      );
    }
    throw lastError || new Error('All Gemini candidate models failed to return a response for the PDF document.');
  }

  console.log(`[pdfParser] Response successfully received from ${successfulModel}. Normalizing schema...`);
  const normalizedForm = validateAndNormalizeForm(textOutput, fileName.replace(/\.[^/.]+$/, ''));
  console.log(
    `[pdfParser] Successfully generated form: "${normalizedForm.title}" with ${
      Object.keys(normalizedForm.fields).length
    } fields across ${normalizedForm.layout.length} sections.`
  );

  return normalizedForm;
}
