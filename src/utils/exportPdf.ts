import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import type { FormDefinition, FormField } from '../types/schema';

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
  };
}

/**
 * Generates a clean, professional, sanitized filename derived from the form title.
 * Examples:
 * - "MEDICAL TRUST" -> "Medical_Trust.pdf"
 * - "Doctor Initial Assessment" -> "Doctor_Initial_Assessment.pdf"
 * - "Nurses Initial Assessment - Paediatric" -> "Nurses_Initial_Assessment_Paediatric.pdf"
 */
export function generatePdfFileName(formTitle?: string): string {
  if (!formTitle || !formTitle.trim()) {
    return 'Clinical_Form.pdf';
  }

  // Remove unsafe filesystem characters and split words by spaces/underscores/hyphens
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

function escapeHtml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getFieldValue(field: FormField, formData: Record<string, any>): any {
  if (formData[field.name] !== undefined) return formData[field.name];
  if (formData[field.id] !== undefined) return formData[field.id];
  if (field.name) {
    const lower = field.name.toLowerCase();
    for (const k of Object.keys(formData)) {
      if (k.toLowerCase() === lower) return formData[k];
    }
  }
  if (field.defaultValue !== undefined) return field.defaultValue;
  return undefined;
}

function isFieldEmpty(field: FormField, formData: Record<string, any>): boolean {
  if (field.type === 'heading' || field.type === 'divider') return false;
  const val = getFieldValue(field, formData);
  if (val === undefined || val === null) return true;
  if (field.type === 'checkbox') {
    if (Array.isArray(val)) return val.length === 0;
    return val === false || val === 'false' || val === 0 || val === '0';
  }
  if (field.type === 'table') {
    if (!Array.isArray(val) || val.length === 0) return true;
    const cols = field.tableConfig?.columns || [];
    return !val.some((r) =>
      cols.some((c) => {
        const cellVal = r[c.id] ?? r[c.key ?? ''] ?? '';
        return cellVal !== undefined && cellVal !== null && String(cellVal).trim() !== '';
      })
    );
  }
  return String(val).trim() === '';
}

function resolveDisplayValue(
  field: FormField,
  rawVal: any,
  dynamicOptions?: Record<string, { label: string; value: string }[]>
): { text: string; isChecked?: boolean; isTable?: boolean; isMultiline?: boolean } {
  if (rawVal === undefined || rawVal === null || rawVal === '') {
    return { text: '' };
  }

  if (field.type === 'table') {
    return { text: '', isTable: true };
  }

  const effectiveOptions =
    field.options && field.options.length > 0
      ? field.options
      : dynamicOptions?.[field.name] || dynamicOptions?.[field.id] || [];

  if (field.type === 'checkbox') {
    if (Array.isArray(rawVal)) {
      if (rawVal.length === 0) return { text: '' };
      const labels = rawVal.map((v) => {
        const opt = effectiveOptions.find((o) => o.value === v || o.label === v);
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

  if ((field.type === 'select' || field.type === 'radio') && effectiveOptions.length > 0) {
    const str = String(rawVal).trim().toLowerCase();
    const opt = effectiveOptions.find(
      (o) =>
        o.value.trim().toLowerCase() === str ||
        o.label.trim().toLowerCase() === str ||
        (o.value.length === 1 && str.startsWith(o.value.toLowerCase())) ||
        (o.label.length === 1 && str.startsWith(o.label.toLowerCase()))
    );
    if (opt) {
      return { text: opt.label };
    }
    return { text: String(rawVal) };
  }

  if (field.type === 'textarea') {
    return { text: String(rawVal), isMultiline: true };
  }

  if (field.type === 'date' && typeof rawVal === 'string' && /^\d{4}-\d{2}-\d{2}/.test(rawVal)) {
    try {
      const d = new Date(rawVal);
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
      // Fallback
    }
  }

  return { text: String(rawVal) };
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
  header.style.paddingBottom = '12px';
  header.style.marginBottom = '14px';
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
  titleEl.style.fontSize = '20px';
  titleEl.style.fontWeight = '800';
  titleEl.style.color = '#0f172a';
  titleEl.style.textTransform = 'uppercase';
  titleEl.style.letterSpacing = '-0.01em';
  titleEl.style.lineHeight = '1.2';
  titleEl.innerText = form.title || 'Clinical Form';
  leftCol.appendChild(titleEl);

  if (form.description) {
    const descEl = document.createElement('div');
    descEl.style.fontSize = '10px';
    descEl.style.color = '#475569';
    descEl.style.marginTop = '4px';
    descEl.style.lineHeight = '1.35';
    descEl.innerText = form.description;
    leftCol.appendChild(descEl);
  }

  topRow.appendChild(leftCol);

  // Right: Patient & Encounter Context
  const rightCol = document.createElement('div');
  rightCol.style.textAlign = 'right';
  rightCol.style.fontSize = '10px';
  rightCol.style.color = '#334155';
  rightCol.style.lineHeight = '1.5';
  rightCol.style.flexShrink = '0';

  let rightHtml = '';
  if (metadata?.mrno) {
    rightHtml += `<div style="font-family: monospace; font-size: 11.5px; font-weight: 700; color: #0f172a;">MRNO: ${escapeHtml(
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
    rightHtml += `<div style="font-family: monospace; font-size: 9.5px; color: #64748b;">Record ID: #${escapeHtml(
      String(metadata.recordId)
    )}</div>`;
  }
  const dateStr = new Date().toLocaleDateString('en-GB', {
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
  header.style.marginBottom = '14px';
  header.style.fontSize = '9.5px';
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
  footer.style.paddingTop = '8px';
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
 * Generates a clean, dedicated clinical PDF based strictly on the form definition and entered data.
 * Completely excludes runtime controls, buttons, navigation bars, and submission history cards.
 */
export async function downloadCleanFormPdf(options: ExportPdfOptions): Promise<void> {
  const { form, formData = {}, dynamicOptions, metadata } = options;

  if (!form || !form.layout || form.layout.length === 0) {
    throw new Error('Form definition with layout is required for clean PDF generation.');
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
    // 1. Build all content blocks (Section headings, Rows, Fields, Tables)
    const blocks: HTMLElement[] = [];

    for (const section of form.layout) {
      // Determine which rows in this section should be rendered:
      // Omit rows where all fields are optional and empty.
      const rowsToRender = (section.rows || []).filter((row) => {
        const rowFieldIds = (row.columns || []).flatMap((c) => c.fieldIds || []);
        const rowFields = rowFieldIds.map((id) => form.fields[id]).filter(Boolean);
        if (rowFields.length === 0) return false;

        return rowFields.some(
          (f) =>
            f.type === 'heading' ||
            f.type === 'divider' ||
            Boolean(f.validation?.required) ||
            !isFieldEmpty(f, formData)
        );
      });

      // Section Header Block
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
          secDesc.style.fontSize = '9.5px';
          secDesc.style.color = '#64748b';
          secDesc.style.textTransform = 'none';
          secDesc.style.fontWeight = '400';
          secDesc.style.marginTop = '2px';
          secDesc.innerText = section.description;
          secHeader.appendChild(secDesc);
        }

        // If all rows in this section were empty optional rows, preserve section title with clean note
        if (rowsToRender.length === 0) {
          const emptySecNote = document.createElement('div');
          emptySecNote.style.fontSize = '9px';
          emptySecNote.style.color = '#94a3b8';
          emptySecNote.style.fontStyle = 'italic';
          emptySecNote.style.textTransform = 'none';
          emptySecNote.style.fontWeight = '400';
          emptySecNote.style.marginTop = '3px';
          emptySecNote.style.marginBottom = '6px';
          emptySecNote.innerText = 'No entries recorded';
          secHeader.appendChild(emptySecNote);
        }

        blocks.push(secHeader);
      }

      // Render Rows
      for (const row of rowsToRender) {
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
            const field = form.fields[fieldId];
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
              // Table field rendering
              const tableTitle = document.createElement('div');
              tableTitle.style.fontSize = '9.5px';
              tableTitle.style.fontWeight = '700';
              tableTitle.style.color = '#334155';
              tableTitle.style.textTransform = 'uppercase';
              tableTitle.style.marginBottom = '3px';
              tableTitle.innerText = field.label;
              fieldEl.appendChild(tableTitle);

              const rawRows = getFieldValue(field, formData);
              const rowsData = Array.isArray(rawRows) ? rawRows : [];
              const columns = field.tableConfig?.columns || [];

              // Filter out completely blank table rows (e.g. initial [{}] with no values)
              const populatedRows = rowsData.filter((r) =>
                columns.some((c) => {
                  const cellVal = r[c.id] ?? r[c.key ?? ''] ?? '';
                  return cellVal !== undefined && cellVal !== null && String(cellVal).trim() !== '';
                })
              );

              const tableEl = document.createElement('table');
              tableEl.style.width = '100%';
              tableEl.style.borderCollapse = 'collapse';
              tableEl.style.fontSize = '9px';
              tableEl.style.border = '1px solid #cbd5e1';
              tableEl.style.marginBottom = '6px';

              // Header
              const thead = document.createElement('thead');
              const headRow = document.createElement('tr');
              headRow.style.background = '#f1f5f9';
              columns.forEach((c) => {
                const th = document.createElement('th');
                th.style.padding = '4px 6px';
                th.style.fontWeight = '700';
                th.style.color = '#334155';
                th.style.textAlign = 'left';
                th.style.border = '1px solid #cbd5e1';
                th.innerText = c.label || c.id;
                headRow.appendChild(th);
              });
              thead.appendChild(headRow);
              tableEl.appendChild(thead);

              // Body
              const tbody = document.createElement('tbody');
              if (populatedRows.length === 0) {
                const emptyRow = document.createElement('tr');
                const emptyTd = document.createElement('td');
                emptyTd.colSpan = Math.max(1, columns.length);
                emptyTd.style.padding = '6px';
                emptyTd.style.textAlign = 'center';
                emptyTd.style.color = '#94a3b8';
                emptyTd.style.fontStyle = 'italic';
                emptyTd.innerText = field.validation?.required
                  ? '(Not recorded)'
                  : 'No table entries recorded';
                emptyRow.appendChild(emptyTd);
                tbody.appendChild(emptyRow);
              } else {
                populatedRows.forEach((rowObj, rIdx) => {
                  const tr = document.createElement('tr');
                  if (rIdx % 2 === 1) {
                    tr.style.background = '#f8fafc';
                  }
                  columns.forEach((c) => {
                    const td = document.createElement('td');
                    td.style.padding = '4px 6px';
                    td.style.border = '1px solid #e2e8f0';
                    td.style.color = '#0f172a';
                    const key = c.id || c.key || '';
                    const cellVal = rowObj[key] !== undefined ? String(rowObj[key]) : '';
                    td.innerText = cellVal || '—';
                    tr.appendChild(td);
                  });
                  tbody.appendChild(tr);
                });
              }
              tableEl.appendChild(tbody);
              fieldEl.appendChild(tableEl);
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
                valBox.style.fontSize = '10.5px';
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
                  : '<span style="color: #cbd5e1;">—</span>';
                fieldEl.appendChild(valBox);
              } else if (field.type === 'checkbox') {
                const valBox = document.createElement('div');
                valBox.style.fontSize = '10.5px';
                valBox.style.color = '#0f172a';
                valBox.style.fontWeight = '600';
                valBox.style.padding = '1px 0';
                valBox.innerHTML = displayInfo.isChecked ? '☑ Yes' : '☐ No';
                fieldEl.appendChild(valBox);
              } else {
                const valBox = document.createElement('div');
                valBox.style.fontSize = '10.5px';
                valBox.style.color = '#0f172a';
                valBox.style.fontWeight = '500';
                valBox.style.minHeight = '16px';
                valBox.style.borderBottom = '1px solid #e2e8f0';
                valBox.style.paddingBottom = '1px';
                valBox.style.wordBreak = 'break-word';

                if (displayInfo.text) {
                  valBox.innerText = displayInfo.text;
                } else if (field.validation?.required) {
                  valBox.innerHTML =
                    '<span style="color: #94a3b8; font-style: italic; font-size: 9.5px;">(Not recorded)</span>';
                } else {
                  valBox.innerHTML = '<span style="color: #cbd5e1;">—</span>';
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

    // 2. Measure block heights to perform intelligent page break distribution
    const heights: number[] = [];
    for (const b of blocks) {
      measureBox.appendChild(b);
      heights.push(Math.ceil(b.getBoundingClientRect().height));
      measureBox.removeChild(b);
    }

    // Usable heights per page (A4 total 1123px - padding - header/footer)
    const PAGE_MAX_HEIGHT_FIRST = 875;
    const PAGE_MAX_HEIGHT_SUBSEQUENT = 945;

    const pageBlocks: HTMLElement[][] = [[]];
    let currentPg = 0;
    let currentPgHeight = 0;

    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      const h = heights[i];
      const maxH = currentPg === 0 ? PAGE_MAX_HEIGHT_FIRST : PAGE_MAX_HEIGHT_SUBSEQUENT;

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

    // 3. Assemble complete A4 Page DOM elements
    for (let pIdx = 0; pIdx < totalPages; pIdx++) {
      const pageEl = document.createElement('div');
      pageEl.style.width = '794px';
      pageEl.style.height = '1123px';
      pageEl.style.maxHeight = '1123px';
      pageEl.style.overflow = 'hidden';
      pageEl.style.boxSizing = 'border-box';
      pageEl.style.padding = '42px 48px 36px 48px';
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
      bodyEl.style.overflow = 'hidden';

      for (const blk of pageBlocks[pIdx]) {
        bodyEl.appendChild(blk);
      }
      pageEl.appendChild(bodyEl);

      // Footer
      pageEl.appendChild(createDocumentFooter(form.title, pIdx + 1, totalPages));

      host.appendChild(pageEl);
      pageDivs.push(pageEl);
    }

    // 4. Capture high-resolution page-by-page PDF
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

    // Clean dynamic filename (e.g. Medical_Trust.pdf)
    const cleanFileName = generatePdfFileName(options.formTitle || form.title);
    pdf.save(cleanFileName);
  } finally {
    // Always clean up the off-screen staging host
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
  // If form definition is available, use the dedicated clean export layout
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
    console.warn('[exportPdf] Target element not found, falling back to window.print()');
    window.print();
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
    window.print();
  } finally {
    hiddenElements.forEach((el, i) => {
      el.style.display = originalDisplays[i] || '';
    });
  }
}
