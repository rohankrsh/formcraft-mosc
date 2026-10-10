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
You are an expert Enterprise Form Designer and Document Layout Analyst.
Your task is to visually inspect the provided PDF document and convert it into a precision "FormDefinition" JSON object that matches the exact platform schema.

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
  _needsReview?: boolean; // Set true if field is ambiguous or inferred
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
   - Identify main section banners, headers, or groupings (e.g. "Patient Information", "Medical History", "Insurance", "Signature & Consent").
   - Group related fields under their corresponding section.

2. FIELDS & LABELS:
   - Identify labels and their associated input controls, lines, boxes, or fill-in areas.
   - Detect required fields (* or "required" text) and set \`validation.required: true\`.
   - Accurately categorize field types:
     - 'date': Date of Birth, Today's Date, Appointment Date.
     - 'number': Age, Phone, SSN/ID numbers, Postal codes, Quantities.
     - 'select' / 'radio': Choices where user selects one option.
     - 'checkbox': Checkbox squares (☐/☑), Yes/No, or confirmation statements.
     - 'textarea': Multi-line paragraphs, comments, explanation boxes, address.
     - 'text': Standard single-line text inputs.

3. 12-COLUMN RESPONSIVE LAYOUT (MANDATORY):
   - In every \`LayoutRow\`, the sum of \`column.width\` across all columns in that row MUST EQUAL 12.
     - Full-width field: 1 column with width 12.
     - Two side-by-side fields (e.g. First Name + Last Name): 2 columns, each with width 6.
     - Three side-by-side fields (e.g. City + State + Zip): 3 columns, each with width 4.
     - Four side-by-side fields: 4 columns, each with width 3.

4. TABLES & DATA GRIDS (CRITICAL):
   - Whenever you see any table structure (rows & columns with headers, e.g., "Medication | Dosage | Frequency", "Item | Qty | Price | Total", "Dependent Name | Relation | DOB"):
     DO NOT generate separate individual input fields!
     INSTEAD, create a SINGLE FormField of type 'table' with:
     - 'label': Table Title
     - 'tableConfig': {
         'columns': [
           { 'id': 'col_1', 'label': 'Column 1 Header', 'type': 'text' },
           { 'id': 'col_2', 'label': 'Column 2 Header', 'type': 'text' | 'number' | 'date' | 'select' },
           ...
         ],
         'defaultRows': [
           // Any populated rows or sample entries seen in the PDF table
         ],
         'allowAddRows': true
       }
     - Place this table in a row with width 12.

5. OUTPUT:
   - Return ONLY the valid JSON object conforming to \`FormDefinition\`. No markdown formatting outside JSON.
`;

  const userPrompt = `
Please inspect this attached PDF document ("${fileName}") thoroughly.
Analyze its visual layout, section headers, form fields, checkboxes, and any table/data-grid structures.
Generate the complete and accurate FormDefinition JSON according to the platform schema.
`;

  // Candidate model cascade prioritized by stability, capacity, and current availability
  const candidateModels = [
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3.7-flash',
    'gemini-3.8-flash',
    'gemini-3.1-flash-lite-preview',
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
        const timeoutId = setTimeout(() => controller.abort(), 35000);

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
            console.log(`[pdfParser] ${model} is experiencing a temporary spike. Waiting 1.5s before retry...`);
            await new Promise((resolve) => setTimeout(resolve, 1500));
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
