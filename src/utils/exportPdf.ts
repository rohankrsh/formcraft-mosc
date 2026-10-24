import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import type { FormDefinition, FormField, FieldType, TableColumn } from '../types/schema';
import { getPainScaleItem } from '../components/painAssessment/PainScaleData';

export interface ExportPdfOptions {
  fileName?: string;
  formTitle?: string;
  recordId?: string | number | null;
  form?: FormDefinition;
  formData?: Record<string, any>;
  dynamicOptions?: Record<string, { label: string; value: string }[]>;
  metadata?: {
    mrno?: string;
    department?: string;
    serviceCenter?: string;
    recordId?: string | number | null;
    submittedAt?: string;
    submittedBy?: string;
  };
}

export interface ExportCoverageReport {
  totalFields: number;
  representedFields: number;
  populatedFields: number;
  emptyFields: number;
  nestedTableFields: number;
  unsupportedFieldTypes: string[];
  renderingFailures: string[];
}

const SUPPORTED_FIELD_TYPES: FieldType[] = [
  'text',
  'textarea',
  'number',
  'date',
  'time',
  'select',
  'radio',
  'checkbox',
  'heading',
  'divider',
  'table',
  'pain_assessment',
];

/**
 * Generates a clean, professional, sanitized filename derived from the form title.
 * Examples:
 * - "MEDICAL TRUST" -> "Medical_Trust.pdf"
 * - "Doctor Initial Assessment" -> "Doctor_Initial_Assessment.pdf"
 */
export function generatePdfFileName(formTitle?: string): string {
  if (!formTitle || !formTitle.trim()) {
    return 'Clinical_Form.pdf';
  }

  const words = formTitle
    .trim()
    .replace(/[^\w-]/g, ' ')
    .split(/[\s_-]+/)
    .filter(Boolean);

  if (words.length === 0) {
    return 'Clinical_Form.pdf';
  }

  const formattedWords = words.map((w) => {
    if (w.length <= 1) return w.toUpperCase();
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  });

  return `${formattedWords.join('_')}.pdf`;
}

export function escapeHtml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Robustly retrieves the latest entered or configured value for a field.
 * Avoids empty strings overriding actual values stored under alternate keys.
 */
export function getFieldValue(field: FormField, formData: Record<string, any> = {}): any {
  if (!formData || typeof formData !== 'object') {
    return field.defaultValue !== undefined ? field.defaultValue : undefined;
  }

  const candidateKeys = [
    field.name,
    field.id,
    field.name ? field.name.toLowerCase() : '',
    field.label,
    field.dataBinding?.column,
  ].filter(Boolean) as string[];

  // 1. First pass: look for an explicit, non-empty, non-null value (including 0 and false)
  for (const k of candidateKeys) {
    const val = formData[k];
    if (val !== undefined && val !== null && val !== '') {
      return val;
    }
  }

  // 2. Second pass: case-insensitive match for non-empty value
  for (const cand of candidateKeys) {
    const lower = cand.toLowerCase();
    for (const [k, v] of Object.entries(formData)) {
      if (k.toLowerCase() === lower && v !== undefined && v !== null && v !== '') {
        return v;
      }
    }
  }

  // 3. Third pass: check if any key exists explicitly (even if empty string)
  for (const k of candidateKeys) {
    if (formData[k] !== undefined && formData[k] !== null) {
      return formData[k];
    }
  }

  // 4. Default value fallback
  if (field.defaultValue !== undefined && field.defaultValue !== null) {
    return field.defaultValue;
  }

  return undefined;
}

/**
 * Robustly checks whether a field has no entered or recorded value.
 * Valid numbers (like 0) and boolean false are NOT considered empty.
 */
export function isFieldEmpty(field: FormField, formData: Record<string, any> = {}): boolean {
  if (field.type === 'heading' || field.type === 'divider') return false;

  const val = getFieldValue(field, formData);
  if (val === undefined || val === null) return true;

  if (field.type === 'checkbox') {
    if (Array.isArray(val)) return val.length === 0;
    return val === false || val === 'false' || val === 0 || val === '0' || val === '';
  }

  if (field.type === 'table') {
    if (!Array.isArray(val) || val.length === 0) return true;
    const cols = field.tableConfig?.columns || [];
    return !val.some((r) =>
      cols.some((c) => {
        const cellVal = getTableCellValue(r, c, 0);
        return cellVal !== undefined && cellVal !== null && String(cellVal).trim() !== '';
      })
    );
  }

  if (field.type === 'pain_assessment') {
    if (!val || typeof val !== 'object') return true;
    const hasPresence = Boolean(val.painPresent && val.painPresent !== '');
    const hasLoc = Boolean(val.location && String(val.location).trim());
    const hasScore = val.score !== null && val.score !== undefined && val.score !== '';
    return !hasPresence && !hasLoc && !hasScore;
  }

  return String(val).trim() === '';
}

/**
 * Extracts a cell's value from a table row object using multiple key candidates.
 */
export function getTableCellValue(rowObj: Record<string, any>, col: TableColumn, colIdx: number): any {
  if (!rowObj || typeof rowObj !== 'object') return '';

  const colKey = col.key || col.id || `col_${colIdx}`;
  const candidates = [
    col.key,
    col.id,
    colKey,
    `col_${colIdx}`,
    col.label,
  ].filter(Boolean) as string[];

  // 1. Non-empty match first
  for (const k of candidates) {
    const val = rowObj[k];
    if (val !== undefined && val !== null && val !== '') {
      return val;
    }
  }

  // 2. Case-insensitive non-empty match
  for (const cand of candidates) {
    const lower = cand.toLowerCase();
    for (const [k, v] of Object.entries(rowObj)) {
      if (k.toLowerCase() === lower && v !== undefined && v !== null && v !== '') {
        return v;
      }
    }
  }

  // 3. Explicitly defined (including 0, false, '')
  for (const k of candidates) {
    if (rowObj[k] !== undefined && rowObj[k] !== null) {
      return rowObj[k];
    }
  }

  return '';
}

/**
 * Resolves a field's display value, mapping dropdowns, radios, dates, and checkboxes to readable labels.
 */
export function resolveDisplayValue(
  field: FormField,
  rawVal: any,
  dynamicOptions?: Record<string, { label: string; value: string }[]>
): { text: string; isChecked?: boolean; isTable?: boolean; isMultiline?: boolean; isEmpty?: boolean } {
  if (rawVal === undefined || rawVal === null || (typeof rawVal === 'string' && rawVal.trim() === '')) {
    return { text: '', isEmpty: true };
  }

  if (field.type === 'table') {
    return { text: '', isTable: true };
  }

  const effectiveOptions =
    field.options && field.options.length > 0
      ? field.options
      : dynamicOptions?.[field.name] || dynamicOptions?.[field.id] || [];

  // Checkbox field
  if (field.type === 'checkbox') {
    if (Array.isArray(rawVal)) {
      if (rawVal.length === 0) return { text: '', isEmpty: true };
      const labels = rawVal.map((v) => {
        const opt = effectiveOptions.find((o) => String(o.value) === String(v) || o.label === String(v));
        return opt ? opt.label : String(v);
      });
      return { text: labels.join(', ') };
    }
    const isChecked =
      rawVal === true ||
      rawVal === 'true' ||
      rawVal === 'yes' ||
      rawVal === 1 ||
      rawVal === '1';
    return { text: isChecked ? 'Yes' : 'No', isChecked };
  }

  // Select / Radio dropdown options
  if ((field.type === 'select' || field.type === 'radio') && effectiveOptions.length > 0) {
    const str = String(rawVal).trim().toLowerCase();
    const opt = effectiveOptions.find(
      (o) =>
        String(o.value).trim().toLowerCase() === str ||
        String(o.label).trim().toLowerCase() === str
    );
    if (opt) {
      return { text: opt.label };
    }
    return { text: String(rawVal) };
  }

  // Multiline Textarea
  if (field.type === 'textarea') {
    return { text: String(rawVal), isMultiline: true };
  }

  // Date field
  if (field.type === 'date') {
    const strVal = String(rawVal).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(strVal)) {
      try {
        const d = new Date(strVal);
        if (!isNaN(d.getTime())) {
          return {
            text: d.toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            }),
          };
        }
      } catch {
        // Fallback to raw string
      }
    }
    return { text: strVal };
  }

  // Number field (Preserves 0 as a valid entered value!)
  if (field.type === 'number') {
    return { text: String(rawVal) };
  }

  return { text: String(rawVal) };
}

/**
 * Validates export completeness against the entire form definition schema and data.
 * Reports diagnostic coverage without omitting unsupported field types silently.
 */
export function validateExportCompleteness(
  form: FormDefinition,
  formData: Record<string, any> = {}
): ExportCoverageReport {
  const report: ExportCoverageReport = {
    totalFields: 0,
    representedFields: 0,
    populatedFields: 0,
    emptyFields: 0,
    nestedTableFields: 0,
    unsupportedFieldTypes: [],
    renderingFailures: [],
  };

  if (!form || !form.layout) {
    report.renderingFailures.push('Form definition or layout is missing');
    return report;
  }

  const fieldsDict = form.fields || {};

  for (const section of form.layout) {
    for (const row of section.rows || []) {
      for (const col of row.columns || []) {
        for (const fieldId of col.fieldIds || []) {
          report.totalFields++;
          const field = fieldsDict[fieldId];
          if (!field) {
            report.renderingFailures.push(`Field ID "${fieldId}" not found in form.fields dictionary.`);
            continue;
          }

          if (!SUPPORTED_FIELD_TYPES.includes(field.type)) {
            if (!report.unsupportedFieldTypes.includes(field.type)) {
              report.unsupportedFieldTypes.push(field.type);
            }
          }

          report.representedFields++;

          if (isFieldEmpty(field, formData)) {
            report.emptyFields++;
          } else {
            report.populatedFields++;
          }

          // Count nested table fields
          if (field.type === 'table' && field.tableConfig?.cellFields) {
            for (const [cellKey, cellVal] of Object.entries(field.tableConfig.cellFields)) {
              report.nestedTableFields++;
              const nestedType =
                typeof cellVal === 'object' && cellVal !== null
                  ? cellVal.type
                  : typeof cellVal === 'string' && fieldsDict[cellVal]
                  ? fieldsDict[cellVal].type
                  : 'text';
              if (nestedType && !SUPPORTED_FIELD_TYPES.includes(nestedType)) {
                if (!report.unsupportedFieldTypes.includes(nestedType)) {
                  report.unsupportedFieldTypes.push(`${nestedType} (nested in ${cellKey})`);
                }
              }
            }
          }
        }
      }
    }
  }

  return report;
}

/**
 * Creates the Document Header for Page 1.
 */
function createDocumentHeader(
  form: FormDefinition,
  metadata?: ExportPdfOptions['metadata']
): HTMLElement {
  const header = document.createElement('div');
  header.style.borderBottom = '2px solid #0f172a';
  header.style.paddingBottom = '10px';
  header.style.marginBottom = '12px';
  header.style.boxSizing = 'border-box';
  header.style.width = '100%';

  const topRow = document.createElement('div');
  topRow.style.display = 'flex';
  topRow.style.justifyContent = 'space-between';
  topRow.style.alignItems = 'flex-start';
  topRow.style.gap = '16px';

  // Left: Form Title and Description
  const leftCol = document.createElement('div');
  leftCol.style.flex = '1';

  const titleEl = document.createElement('div');
  titleEl.style.fontSize = '18px';
  titleEl.style.fontWeight = '800';
  titleEl.style.color = '#0f172a';
  titleEl.style.textTransform = 'uppercase';
  titleEl.style.letterSpacing = '-0.01em';
  titleEl.style.lineHeight = '1.2';
  titleEl.innerText = form.title || 'Clinical Form';
  leftCol.appendChild(titleEl);

  if (form.description) {
    const descEl = document.createElement('div');
    descEl.style.fontSize = '9.5px';
    descEl.style.color = '#475569';
    descEl.style.marginTop = '3px';
    descEl.style.lineHeight = '1.35';
    descEl.innerText = form.description;
    leftCol.appendChild(descEl);
  }

  topRow.appendChild(leftCol);

  // Right: Patient & Encounter Context
  const rightCol = document.createElement('div');
  rightCol.style.textAlign = 'right';
  rightCol.style.fontSize = '9.5px';
  rightCol.style.color = '#334155';
  rightCol.style.lineHeight = '1.45';
  rightCol.style.flexShrink = '0';

  let rightHtml = '';
  if (metadata?.mrno) {
    rightHtml += `<div style="font-family: monospace; font-size: 11px; font-weight: 700; color: #0f172a;">MRNO: ${escapeHtml(
      metadata.mrno
    )}</div>`;
  }
  const deptName =
    metadata?.department ||
    form.settings?.departmentName ||
    (form.settings?.departmentNames && form.settings.departmentNames.length > 0
      ? form.settings.departmentNames.join(', ')
      : undefined);
  if (deptName) {
    rightHtml += `<div>Dept: <strong>${escapeHtml(deptName)}</strong></div>`;
  }
  const serviceCenter = metadata?.serviceCenter || form.settings?.serviceCenterName;
  if (serviceCenter) {
    rightHtml += `<div>Service Center: <strong>${escapeHtml(serviceCenter)}</strong></div>`;
  }
  if (metadata?.recordId) {
    rightHtml += `<div style="font-family: monospace; font-size: 9px; color: #64748b;">Record ID: #${escapeHtml(
      String(metadata.recordId)
    )}</div>`;
  }
  if (metadata?.submittedBy) {
    rightHtml += `<div>Clinician: <strong>${escapeHtml(metadata.submittedBy)}</strong></div>`;
  }

  const dateStr = metadata?.submittedAt
    ? new Date(metadata.submittedAt).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
  rightHtml += `<div>Generated: <strong>${dateStr}</strong></div>`;

  rightCol.innerHTML = rightHtml;
  topRow.appendChild(rightCol);

  header.appendChild(topRow);
  return header;
}

/**
 * Creates the Running Header for Subsequent Pages (Page 2+).
 */
function createRunningHeader(
  form: FormDefinition,
  metadata?: ExportPdfOptions['metadata']
): HTMLElement {
  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'center';
  header.style.borderBottom = '1px solid #cbd5e1';
  header.style.paddingBottom = '6px';
  header.style.marginBottom = '12px';
  header.style.fontSize = '9px';
  header.style.color = '#64748b';
  header.style.fontWeight = '600';
  header.style.boxSizing = 'border-box';
  header.style.width = '100%';

  header.innerHTML = `
    <span>${escapeHtml(form.title || 'Clinical Form')} &bull; Continued</span>
    ${metadata?.mrno ? `<span style="font-family: monospace;">MRNO: ${escapeHtml(metadata.mrno)}</span>` : ''}
  `;
  return header;
}

/**
 * Creates the Clean Document Footer.
 */
function createDocumentFooter(
  formTitle: string,
  pageNum: number,
  totalPages: number
): HTMLElement {
  const footer = document.createElement('div');
  footer.style.display = 'flex';
  footer.style.justifyContent = 'space-between';
  footer.style.alignItems = 'center';
  footer.style.borderTop = '1px solid #e2e8f0';
  footer.style.paddingTop = '6px';
  footer.style.marginTop = 'auto';
  footer.style.fontSize = '8.5px';
  footer.style.color = '#64748b';
  footer.style.boxSizing = 'border-box';
  footer.style.width = '100%';

  footer.innerHTML = `
    <span>FormCraft Clinical Document &bull; ${escapeHtml(formTitle)}</span>
    <span>Page ${pageNum} of ${totalPages}</span>
  `;
  return footer;
}

/**
 * Renders a complete table, splitting rows across multiple PDF pages if the table exceeds page capacity.
 */
function renderTableChunks(
  field: FormField,
  formData: Record<string, any>,
  dynamicOptions: Record<string, { label: string; value: string }[]> | undefined,
  measureBox: HTMLElement,
  maxAvailableFirstPage: number,
  maxPageHeight: number
): HTMLElement[] {
  const tableConfig = field.tableConfig || { columns: [], defaultRows: [] };
  const columns: TableColumn[] = tableConfig.columns || [];

  const rawRows = getFieldValue(field, formData);
  let rowsData: any[] = [];
  if (Array.isArray(rawRows)) {
    rowsData = rawRows;
  } else if (tableConfig.defaultRows && Array.isArray(tableConfig.defaultRows)) {
    rowsData = tableConfig.defaultRows;
  }

  // Helper to build a table DOM element for a slice of rows
  const buildTableElement = (sliceRows: any[], isContinuation: boolean): HTMLElement => {
    const container = document.createElement('div');
    container.style.width = '100%';
    container.style.marginBottom = '8px';
    container.style.boxSizing = 'border-box';

    // Table Title
    const titleEl = document.createElement('div');
    titleEl.style.fontSize = '9.5px';
    titleEl.style.fontWeight = '700';
    titleEl.style.color = '#1e3a8a';
    titleEl.style.textTransform = 'uppercase';
    titleEl.style.letterSpacing = '0.02em';
    titleEl.style.marginBottom = '3px';
    titleEl.innerText = isContinuation
      ? `${field.label || 'TABLE'} (Continued)`
      : field.label || 'TABLE';
    container.appendChild(titleEl);

    const tableEl = document.createElement('table');
    tableEl.style.width = '100%';
    tableEl.style.borderCollapse = 'collapse';
    tableEl.style.fontSize = '9px';
    tableEl.style.border = '1px solid #cbd5e1';

    // Head
    const thead = document.createElement('thead');
    const trHead = document.createElement('tr');
    trHead.style.background = '#f1f5f9';
    columns.forEach((c) => {
      const th = document.createElement('th');
      th.style.padding = '4px 6px';
      th.style.fontWeight = '700';
      th.style.color = '#334155';
      th.style.textAlign = 'left';
      th.style.border = '1px solid #cbd5e1';
      th.innerText = c.label || c.key || c.id;
      trHead.appendChild(th);
    });
    thead.appendChild(trHead);
    tableEl.appendChild(thead);

    // Body
    const tbody = document.createElement('tbody');
    if (sliceRows.length === 0) {
      const emptyTr = document.createElement('tr');
      const emptyTd = document.createElement('td');
      emptyTd.colSpan = Math.max(1, columns.length);
      emptyTd.style.padding = '8px';
      emptyTd.style.textAlign = 'center';
      emptyTd.style.color = '#94a3b8';
      emptyTd.style.fontStyle = 'italic';
      emptyTd.innerText = 'No entries recorded';
      emptyTr.appendChild(emptyTd);
      tbody.appendChild(emptyTr);
    } else {
      sliceRows.forEach((rowObj, rIdx) => {
        if (rowObj._isHeader || rowObj._rowType === 'heading') {
          const headerTr = document.createElement('tr');
          headerTr.style.background = '#e2e8f0';
          headerTr.style.fontWeight = '700';
          const headerTd = document.createElement('td');
          headerTd.colSpan = Math.max(1, columns.length);
          headerTd.style.padding = '4px 6px';
          headerTd.style.border = '1px solid #cbd5e1';
          headerTd.style.color = '#1e293b';
          headerTd.style.textTransform = 'uppercase';
          const headerText =
            rowObj._headerText ||
            rowObj[columns[0]?.key || columns[0]?.id || ''] ||
            'Section Header';
          headerTd.innerText = headerText;
          headerTr.appendChild(headerTd);
          tbody.appendChild(headerTr);
          return;
        }

        const tr = document.createElement('tr');
        if (rIdx % 2 === 1) {
          tr.style.background = '#f8fafc';
        }

        columns.forEach((c, cIdx) => {
          const td = document.createElement('td');
          td.style.padding = '4px 6px';
          td.style.border = '1px solid #e2e8f0';
          td.style.color = '#0f172a';
          td.style.verticalAlign = 'top';

          const colKey = c.key || c.id || `col_${cIdx}`;
          const cellKey = `${rIdx}_${colKey}`;
          const rawVal = getTableCellValue(rowObj, c, cIdx);

          // Resolve nested cell field configuration if present
          const cellFieldRef =
            tableConfig.cellFields?.[cellKey] ||
            tableConfig.cellFields?.[`${rIdx}_${c.id}`] ||
            tableConfig.cellFields?.[`${rIdx}_${c.key}`];

          const cellField: FormField | null =
            cellFieldRef && typeof cellFieldRef === 'object' && 'type' in cellFieldRef
              ? (cellFieldRef as FormField)
              : null;

          const effType = cellField?.type || c.type || 'text';
          const effOptions =
            cellField?.options ||
            c.options ||
            dynamicOptions?.[colKey] ||
            dynamicOptions?.[c.id] ||
            [];

          const isCellHeader =
            (Array.isArray(rowObj._headerCols) && rowObj._headerCols.includes(colKey)) ||
            effType === 'heading';

          if (isCellHeader) {
            td.style.fontWeight = '700';
            td.style.background = '#f1f5f9';
            td.innerText = rawVal ? String(rawVal) : c.label;
            tr.appendChild(td);
            return;
          }

          if (rawVal === undefined || rawVal === null || (typeof rawVal === 'string' && rawVal.trim() === '')) {
            td.innerHTML = '<span style="color: #94a3b8; font-style: italic;">Not entered</span>';
            tr.appendChild(td);
            return;
          }

          if (effType === 'checkbox') {
            const isChecked =
              rawVal === true || rawVal === 'true' || rawVal === 'yes' || rawVal === 1 || rawVal === '1';
            td.innerText = isChecked ? '☑ Yes' : '☐ No';
          } else if ((effType === 'select' || effType === 'radio') && effOptions.length > 0) {
            const str = String(rawVal).trim().toLowerCase();
            const matchedOpt = effOptions.find(
              (o) => String(o.value).trim().toLowerCase() === str || String(o.label).trim().toLowerCase() === str
            );
            td.innerText = matchedOpt ? matchedOpt.label : String(rawVal);
          } else if (effType === 'date' && typeof rawVal === 'string' && /^\d{4}-\d{2}-\d{2}/.test(rawVal)) {
            try {
              const d = new Date(rawVal);
              td.innerText = !isNaN(d.getTime())
                ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                : rawVal;
            } catch {
              td.innerText = String(rawVal);
            }
          } else {
            td.innerText = String(rawVal);
          }

          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
    }

    tableEl.appendChild(tbody);
    container.appendChild(tableEl);
    return container;
  };

  // If table has 0 or 1 row, simple render
  if (rowsData.length <= 1) {
    return [buildTableElement(rowsData, false)];
  }

  // Pre-measure to split large tables across pages
  const chunks: HTMLElement[] = [];
  let currentRowSlice: any[] = [];
  let isContinued = false;

  for (let r = 0; r < rowsData.length; r++) {
    currentRowSlice.push(rowsData[r]);
    const testEl = buildTableElement(currentRowSlice, isContinued);
    measureBox.appendChild(testEl);
    const measuredHeight = Math.ceil(testEl.getBoundingClientRect().height);
    measureBox.removeChild(testEl);

    const limit = chunks.length === 0 ? maxAvailableFirstPage : maxPageHeight;
    if (measuredHeight > limit && currentRowSlice.length > 1) {
      // Pop last row and finalize chunk
      currentRowSlice.pop();
      chunks.push(buildTableElement(currentRowSlice, isContinued));

      // Start new chunk with the row that didn't fit
      currentRowSlice = [rowsData[r]];
      isContinued = true;
    }
  }

  if (currentRowSlice.length > 0) {
    chunks.push(buildTableElement(currentRowSlice, isContinued));
  }

  return chunks;
}

/**
 * Generates a clean, complete clinical PDF including every form field and entered value.
 */
export async function downloadCleanFormPdf(options: ExportPdfOptions): Promise<ExportCoverageReport> {
  const { form, formData = {}, dynamicOptions, metadata } = options;

  if (!form || !form.layout || form.layout.length === 0) {
    throw new Error('Form definition with layout is required for clean PDF generation.');
  }

  // Run completeness check
  const completenessReport = validateExportCompleteness(form, formData);
  console.log('[exportPdf] Completeness Report:', completenessReport);

  if (completenessReport.unsupportedFieldTypes.length > 0) {
    console.error(
      '[exportPdf] Unsupported field types encountered:',
      completenessReport.unsupportedFieldTypes
    );
  }

  // Create isolated off-screen staging host
  const host = document.createElement('div');
  host.id = 'formcraft-pdf-staging-host';
  host.style.position = 'fixed';
  host.style.left = '-9999px';
  host.style.top = '0';
  host.style.width = '794px';
  host.style.background = '#ffffff';
  host.style.color = '#0f172a';
  host.style.zIndex = '-9999';
  document.body.appendChild(host);

  // Hidden measurement box to calculate exact heights
  const measureBox = document.createElement('div');
  measureBox.style.width = '698px'; // 794px - 48*2 padding
  measureBox.style.boxSizing = 'border-box';
  measureBox.style.fontFamily =
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
  host.appendChild(measureBox);

  try {
    const blocks: HTMLElement[] = [];
    const PAGE_USABLE_FIRST = 930;
    const PAGE_USABLE_SUBSEQUENT = 980;

    // Traverse all sections and fields defined in the form schema
    for (const section of form.layout) {
      // Section Header Block (Always preserved)
      if (section.title) {
        const secHeader = document.createElement('div');
        secHeader.setAttribute('data-is-section-header', 'true');
        secHeader.style.fontSize = '12px';
        secHeader.style.fontWeight = '700';
        secHeader.style.textTransform = 'uppercase';
        secHeader.style.color = '#1e3a8a';
        secHeader.style.letterSpacing = '0.04em';
        secHeader.style.borderBottom = '1.5px solid #cbd5e1';
        secHeader.style.paddingBottom = '3px';
        secHeader.style.marginTop = '12px';
        secHeader.style.marginBottom = '8px';
        secHeader.innerText = section.title;

        if (section.description) {
          const secDesc = document.createElement('div');
          secDesc.style.fontSize = '9px';
          secDesc.style.color = '#64748b';
          secDesc.style.textTransform = 'none';
          secDesc.style.fontWeight = '400';
          secDesc.style.marginTop = '2px';
          secDesc.innerText = section.description;
          secHeader.appendChild(secDesc);
        }

        blocks.push(secHeader);
      }

      // Render EVERY row defined in this section without dropping empty optional fields
      for (const row of section.rows || []) {
        // Check if row has any table field that needs independent multi-page splitting
        const rowFieldIds = (row.columns || []).flatMap((c) => c.fieldIds || []);
        const hasTable = rowFieldIds.some((fId) => form.fields?.[fId]?.type === 'table');

        if (hasTable && row.columns.length === 1 && rowFieldIds.length === 1) {
          // Table gets dedicated multi-page chunking to guarantee zero cutoffs
          const tableField = form.fields[rowFieldIds[0]];
          const tableChunks = renderTableChunks(
            tableField,
            formData,
            dynamicOptions,
            measureBox,
            PAGE_USABLE_FIRST,
            PAGE_USABLE_SUBSEQUENT
          );
          blocks.push(...tableChunks);
          continue;
        }

        // Standard Row
        const rowEl = document.createElement('div');
        rowEl.style.display = 'flex';
        rowEl.style.width = '100%';
        rowEl.style.gap = '12px';
        rowEl.style.marginBottom = '8px';
        rowEl.style.boxSizing = 'border-box';

        for (const col of row.columns || []) {
          const colEl = document.createElement('div');
          const widthPct = Math.max(1, Math.min(12, col.width || 12)) * (100 / 12);
          colEl.style.flex = `0 0 calc(${widthPct}% - 12px)`;
          colEl.style.width = `calc(${widthPct}% - 12px)`;
          colEl.style.boxSizing = 'border-box';
          colEl.style.display = 'flex';
          colEl.style.flexDirection = 'column';
          colEl.style.gap = '6px';

          for (const fieldId of col.fieldIds || []) {
            const field = form.fields?.[fieldId];
            if (!field) continue;

            const fieldEl = document.createElement('div');
            fieldEl.style.display = 'flex';
            fieldEl.style.flexDirection = 'column';
            fieldEl.style.width = '100%';

            if (field.type === 'heading') {
              const h = document.createElement('div');
              h.style.fontSize = '11px';
              h.style.fontWeight = '700';
              h.style.color = '#334155';
              h.style.marginTop = '4px';
              h.style.marginBottom = '2px';
              h.innerText = field.label || '';
              fieldEl.appendChild(h);
            } else if (field.type === 'divider') {
              const hr = document.createElement('hr');
              hr.style.border = 'none';
              hr.style.borderTop = '1px solid #e2e8f0';
              hr.style.margin = '6px 0';
              fieldEl.appendChild(hr);
            } else if (field.type === 'table') {
              const tableChunks = renderTableChunks(
                field,
                formData,
                dynamicOptions,
                measureBox,
                PAGE_USABLE_FIRST,
                PAGE_USABLE_SUBSEQUENT
              );
              for (const chk of tableChunks) {
                fieldEl.appendChild(chk);
              }
            } else if (field.type === 'pain_assessment') {
              // Dedicated Pain Assessment Representation
              const val = getFieldValue(field, formData);
              const pVal = typeof val === 'object' && val !== null ? val : {};
              const score = typeof pVal.score === 'number' ? pVal.score : null;
              const painPresent =
                pVal.painPresent === 'yes' ? 'Yes' : pVal.painPresent === 'no' ? 'No' : 'Not recorded';
              const location = pVal.location ? String(pVal.location).trim() : '—';

              const card = document.createElement('div');
              card.style.width = '100%';
              card.style.border = '1px solid #cbd5e1';
              card.style.borderRadius = '6px';
              card.style.padding = '8px 10px';
              card.style.background = '#f8fafc';
              card.style.boxSizing = 'border-box';
              card.style.marginBottom = '6px';

              const cardTitle = document.createElement('div');
              cardTitle.style.fontSize = '9.5px';
              cardTitle.style.fontWeight = '700';
              cardTitle.style.color = '#1e3a8a';
              cardTitle.style.textTransform = 'uppercase';
              cardTitle.style.letterSpacing = '0.02em';
              cardTitle.style.marginBottom = '6px';
              cardTitle.innerHTML = `${escapeHtml(field.label || 'PAIN ASSESSMENT')}${
                field.validation?.required ? ' <span style="color: #e11d48;">*</span>' : ''
              }`;
              card.appendChild(cardTitle);

              const metricRow = document.createElement('div');
              metricRow.style.display = 'flex';
              metricRow.style.gap = '8px';
              metricRow.style.marginBottom = '6px';

              // Pain Present
              const b1 = document.createElement('div');
              b1.style.flex = '1';
              b1.style.background = '#ffffff';
              b1.style.border = '1px solid #e2e8f0';
              b1.style.borderRadius = '4px';
              b1.style.padding = '5px 8px';
              b1.innerHTML = `<div style="font-size: 8px; font-weight: 700; color: #64748b; text-transform: uppercase;">PAIN PRESENT?</div>
                <div style="font-size: 10px; font-weight: 700; color: ${
                  painPresent === 'Yes' ? '#e11d48' : painPresent === 'No' ? '#059669' : '#64748b'
                }; margin-top: 2px;">${painPresent}</div>`;
              metricRow.appendChild(b1);

              // Location
              const b2 = document.createElement('div');
              b2.style.flex = '2';
              b2.style.background = '#ffffff';
              b2.style.border = '1px solid #e2e8f0';
              b2.style.borderRadius = '4px';
              b2.style.padding = '5px 8px';
              b2.innerHTML = `<div style="font-size: 8px; font-weight: 700; color: #64748b; text-transform: uppercase;">LOCATION</div>
                <div style="font-size: 10px; font-weight: 600; color: #0f172a; margin-top: 2px;">${escapeHtml(
                  location
                )}</div>`;
              metricRow.appendChild(b2);

              // Score
              const b3 = document.createElement('div');
              b3.style.flex = '2';
              b3.style.background = '#ffffff';
              b3.style.border = '1px solid #e2e8f0';
              b3.style.borderRadius = '4px';
              b3.style.padding = '5px 8px';
              const scaleItem = score !== null ? getPainScaleItem(score) : null;
              const scoreText =
                score !== null
                  ? `${score} / 10 &bull; ${escapeHtml(scaleItem?.label || '')}`
                  : '<span style="color: #94a3b8; font-style: italic;">Not recorded</span>';
              b3.innerHTML = `<div style="font-size: 8px; font-weight: 700; color: #64748b; text-transform: uppercase;">SCORE (0–10 SCALE)</div>
                <div style="font-size: 10px; font-weight: 700; color: ${
                  score !== null ? '#1e3a8a' : '#94a3b8'
                }; margin-top: 2px;">${scoreText}</div>`;
              metricRow.appendChild(b3);

              card.appendChild(metricRow);

              // Visual legend
              const scaleLegend = document.createElement('div');
              scaleLegend.style.fontSize = '7.5px';
              scaleLegend.style.color = '#64748b';
              scaleLegend.style.padding = '3px 6px';
              scaleLegend.style.background = '#f1f5f9';
              scaleLegend.style.borderRadius = '3px';
              scaleLegend.style.display = 'flex';
              scaleLegend.style.justifyContent = 'space-between';
              scaleLegend.innerHTML = `<span>0: No Pain</span><span>1–3: Slight</span><span>4–5: Mild</span><span>6: Moderate</span><span>7–9: Severe</span><span>10: Worst Pain</span>`;
              card.appendChild(scaleLegend);

              fieldEl.appendChild(card);
            } else {
              // Standard field rendering
              const labelEl = document.createElement('div');
              labelEl.style.fontSize = '9px';
              labelEl.style.fontWeight = '700';
              labelEl.style.color = '#475569';
              labelEl.style.textTransform = 'uppercase';
              labelEl.style.letterSpacing = '0.02em';
              labelEl.style.marginBottom = '2px';
              labelEl.innerHTML = `${escapeHtml(field.label || field.name)}${
                field.validation?.required ? ' <span style="color: #e11d48;">*</span>' : ''
              }`;
              fieldEl.appendChild(labelEl);

              const rawVal = getFieldValue(field, formData);
              const displayInfo = resolveDisplayValue(field, rawVal, dynamicOptions);

              if (displayInfo.isMultiline) {
                const valBox = document.createElement('div');
                valBox.style.fontSize = '10px';
                valBox.style.color = '#0f172a';
                valBox.style.minHeight = '24px';
                valBox.style.padding = '4px 6px';
                valBox.style.background = '#f8fafc';
                valBox.style.border = '1px solid #e2e8f0';
                valBox.style.borderRadius = '3px';
                valBox.style.whiteSpace = 'pre-wrap';
                valBox.style.wordBreak = 'break-word';
                valBox.style.lineHeight = '1.35';
                valBox.innerHTML = displayInfo.text
                  ? escapeHtml(displayInfo.text)
                  : '<span style="color: #94a3b8; font-style: italic;">Not entered</span>';
                fieldEl.appendChild(valBox);
              } else if (field.type === 'checkbox') {
                const valBox = document.createElement('div');
                valBox.style.fontSize = '10px';
                valBox.style.color = '#0f172a';
                valBox.style.fontWeight = '600';
                valBox.style.padding = '1px 0';
                if (displayInfo.isEmpty) {
                  valBox.innerHTML = '<span style="color: #94a3b8; font-style: italic;">Not entered</span>';
                } else if (field.options && field.options.length > 0) {
                  valBox.innerText = displayInfo.text;
                } else {
                  valBox.innerHTML = displayInfo.isChecked ? '☑ Yes' : '☐ No';
                }
                fieldEl.appendChild(valBox);
              } else {
                const valBox = document.createElement('div');
                valBox.style.fontSize = '10px';
                valBox.style.color = '#0f172a';
                valBox.style.fontWeight = '500';
                valBox.style.minHeight = '16px';
                valBox.style.borderBottom = '1px solid #e2e8f0';
                valBox.style.paddingBottom = '1px';
                valBox.style.wordBreak = 'break-word';

                if (displayInfo.text !== '' && !displayInfo.isEmpty) {
                  valBox.innerText = displayInfo.text;
                } else {
                  valBox.innerHTML =
                    '<span style="color: #94a3b8; font-style: italic;">Not entered</span>';
                }
                fieldEl.appendChild(valBox);
              }
            }

            colEl.appendChild(fieldEl);
          }
          rowEl.appendChild(colEl);
        }
        blocks.push(rowEl);
      }
    }

    // Measure block heights to distribute cleanly into pages
    const heights: number[] = [];
    for (const b of blocks) {
      measureBox.appendChild(b);
      heights.push(Math.ceil(b.getBoundingClientRect().height));
      measureBox.removeChild(b);
    }

    const pageBlocks: HTMLElement[][] = [[]];
    let currentPg = 0;
    let currentPgHeight = 0;

    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      const h = heights[i];
      const maxH = currentPg === 0 ? PAGE_USABLE_FIRST : PAGE_USABLE_SUBSEQUENT;

      const isSecHeader = b.getAttribute('data-is-section-header') === 'true';
      const nextH = i + 1 < blocks.length ? heights[i + 1] : 0;
      const wouldOrphanHeader = isSecHeader && currentPgHeight + h + nextH > maxH;

      if ((currentPgHeight + h > maxH || wouldOrphanHeader) && pageBlocks[currentPg].length > 0) {
        currentPg++;
        pageBlocks[currentPg] = [];
        currentPgHeight = 0;
      }

      pageBlocks[currentPg].push(b);
      currentPgHeight += h;
    }

    const totalPages = pageBlocks.length;
    const pageDivs: HTMLElement[] = [];

    // Assemble complete A4 Page DOM elements
    for (let pIdx = 0; pIdx < totalPages; pIdx++) {
      const pageEl = document.createElement('div');
      pageEl.style.width = '794px';
      pageEl.style.minHeight = '1123px';
      pageEl.style.boxSizing = 'border-box';
      pageEl.style.padding = '36px 44px 30px 44px';
      pageEl.style.background = '#ffffff';
      pageEl.style.color = '#0f172a';
      pageEl.style.display = 'flex';
      pageEl.style.flexDirection = 'column';
      pageEl.style.justifyContent = 'space-between';
      pageEl.style.fontFamily =
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';

      // Header
      if (pIdx === 0) {
        pageEl.appendChild(createDocumentHeader(form, metadata));
      } else {
        pageEl.appendChild(createRunningHeader(form, metadata));
      }

      // Body container
      const bodyEl = document.createElement('div');
      bodyEl.style.flex = '1';
      bodyEl.style.display = 'flex';
      bodyEl.style.flexDirection = 'column';
      bodyEl.style.gap = '6px';

      for (const blk of pageBlocks[pIdx]) {
        bodyEl.appendChild(blk);
      }
      pageEl.appendChild(bodyEl);

      // Footer
      pageEl.appendChild(createDocumentFooter(form.title, pIdx + 1, totalPages));

      host.appendChild(pageEl);
      pageDivs.push(pageEl);
    }

    // Capture high-resolution page-by-page PDF
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    for (let i = 0; i < pageDivs.length; i++) {
      if (i > 0) {
        pdf.addPage('a4', 'portrait');
      }

      const canvas = await html2canvas(pageDivs[i], {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', 0, 0, 210, 297, undefined, 'FAST');
    }

    const cleanFileName = generatePdfFileName(options.formTitle || form.title);
    pdf.save(cleanFileName);

    return completenessReport;
  } finally {
    if (document.body.contains(host)) {
      document.body.removeChild(host);
    }
  }
}

/**
 * Universal Form PDF Exporter.
 * Automatically delegates to dedicated clean schema PDF generation when form definition is provided,
 * or safely captures scoped DOM content with all runtime controls, navigation buttons, and banners excluded.
 */
export async function downloadFormAsPdf(
  elementOrId: HTMLElement | string,
  options: ExportPdfOptions = {}
): Promise<void> {
  // Primary: Dedicated schema-driven clinical PDF generation
  if (options.form) {
    try {
      await downloadCleanFormPdf(options);
      return;
    } catch (cleanErr) {
      console.warn('[exportPdf] Clean PDF generation failed, attempting scoped DOM export:', cleanErr);
    }
  }

  // Scoped DOM fallback
  const element =
    typeof elementOrId === 'string'
      ? document.getElementById(elementOrId)
      : elementOrId;

  if (!element) {
    console.error('[exportPdf] Target element not found for PDF export:', elementOrId);
    return;
  }

  // Temporarily hide elements with class 'no-print', 'hide-on-pdf', navigation bars, and buttons
  const hiddenElements = element.querySelectorAll<HTMLElement>(
    '.no-print, .hide-on-pdf, nav, button, [role="alert"], input[type="submit"]'
  );
  const originalDisplays: string[] = [];
  hiddenElements.forEach((el, i) => {
    originalDisplays[i] = el.style.display;
    el.style.display = 'none';
  });

  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      scrollX: 0,
      scrollY: 0,
      backgroundColor: '#ffffff',
      windowWidth: document.documentElement.offsetWidth,
      onclone: (clonedDoc) => {
        const origInputs = element.querySelectorAll<
          HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
        >('input, textarea, select');
        const clonedInputs = clonedDoc.querySelectorAll<
          HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
        >('input, textarea, select');

        origInputs.forEach((orig, idx) => {
          const cloned = clonedInputs[idx];
          if (!cloned) return;

          if (orig.tagName === 'INPUT') {
            const input = orig as HTMLInputElement;
            if (input.type === 'checkbox' || input.type === 'radio') {
              (cloned as HTMLInputElement).checked = input.checked;
            } else {
              (cloned as HTMLInputElement).value = input.value;
            }
          } else if (orig.tagName === 'TEXTAREA') {
            (cloned as HTMLTextAreaElement).value = (orig as HTMLTextAreaElement).value;
          } else if (orig.tagName === 'SELECT') {
            (cloned as HTMLSelectElement).value = (orig as HTMLSelectElement).value;
          }
        });
      },
    });

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const printableWidth = pageWidth - margin * 2;
    const imgHeight = (canvas.height * printableWidth) / canvas.width;

    const imgData = canvas.toDataURL('image/png');

    let heightLeft = imgHeight;
    let position = margin;

    pdf.addImage(imgData, 'PNG', margin, position, printableWidth, imgHeight);
    heightLeft -= pageHeight - margin * 2;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight + margin;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', margin, position, printableWidth, imgHeight);
      heightLeft -= pageHeight - margin * 2;
    }

    const fullFileName = generatePdfFileName(options.formTitle || options.fileName);
    pdf.save(fullFileName);
  } catch (err) {
    console.error('[exportPdf] Failed to generate PDF:', err);
    throw err;
  } finally {
    hiddenElements.forEach((el, i) => {
      el.style.display = originalDisplays[i] || '';
    });
  }
}
