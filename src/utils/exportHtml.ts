import type { FormDefinition } from '../types/schema';

/**
 * Generates a zero-dependency, standalone offline HTML file with embedded styling
 * and client-side validation for static forms.
 */
export function generateOfflineHtml(form: FormDefinition): string {
  const fieldsHtml = form.layout
    .map((section) => {
      const rowsHtml = section.rows
        .map((row) => {
          const colsHtml = row.columns
            .map((col) => {
              const colFields = col.fieldIds
                .map((fId) => form.fields[fId])
                .filter(Boolean)
                .map((f) => {
                  if (f.type === 'heading') {
                    return `
                      <div class="field-group py-2">
                        <h3 class="text-lg font-bold text-gray-900">${escapeHtml(f.label)}</h3>
                        ${f.helpText ? `<p class="text-xs text-gray-500">${escapeHtml(f.helpText)}</p>` : ''}
                      </div>`;
                  }
                  if (f.type === 'divider') {
                    return `<hr class="my-3 border-gray-200" />`;
                  }

                  let inputHtml = '';
                  if (f.type === 'text' || f.type === 'number' || f.type === 'date' || f.type === 'time') {
                    inputHtml = `<input type="${f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : f.type === 'time' ? 'time' : 'text'}" name="${f.name}" id="${f.id}" placeholder="${escapeHtml(f.placeholder || '')}" class="input-field" ${f.validation?.required ? 'required' : ''} />`;
                  } else if (f.type === 'textarea') {
                    inputHtml = `<textarea name="${f.name}" id="${f.id}" rows="3" placeholder="${escapeHtml(f.placeholder || '')}" class="input-field" ${f.validation?.required ? 'required' : ''}></textarea>`;
                  } else if (f.type === 'select') {
                    const opts = (f.options || [])
                      .map((o) => `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`)
                      .join('');
                    inputHtml = `<select name="${f.name}" id="${f.id}" class="input-field" ${f.validation?.required ? 'required' : ''}><option value="">Choose...</option>${opts}</select>`;
                  } else if (f.type === 'radio') {
                    inputHtml = `<div class="space-y-1.5 pt-1">${(f.options || [])
                      .map(
                        (o, i) =>
                          `<label class="flex items-center gap-2 text-xs text-gray-700 cursor-pointer"><input type="radio" name="${f.name}" value="${escapeHtml(o.value)}" ${i === 0 && f.validation?.required ? 'required' : ''} /><span>${escapeHtml(o.label)}</span></label>`
                      )
                      .join('')}</div>`;
                  } else if (f.type === 'checkbox') {
                    inputHtml = `<div class="space-y-1.5 pt-1">${(f.options || [])
                      .map(
                        (o) =>
                          `<label class="flex items-center gap-2 text-xs text-gray-700 cursor-pointer"><input type="checkbox" name="${f.name}[]" value="${escapeHtml(o.value)}" /><span>${escapeHtml(o.label)}</span></label>`
                      )
                      .join('')}</div>`;
                  }

                  return `
                    <div class="field-item space-y-1">
                      <label for="${f.id}" class="block text-xs font-semibold text-gray-700">
                        ${escapeHtml(f.label)} ${f.validation?.required ? '<span class="text-red-500">*</span>' : ''}
                      </label>
                      ${inputHtml}
                      ${f.helpText ? `<p class="text-[11px] text-gray-400">${escapeHtml(f.helpText)}</p>` : ''}
                    </div>`;
                })
                .join('');

              return `<div style="grid-column: span ${col.width} / span ${col.width};">${colFields}</div>`;
            })
            .join('');

          return `<div class="grid grid-cols-12 gap-4 my-2">${colsHtml}</div>`;
        })
        .join('');

      return `
        <div class="section-card border-b border-gray-200 pb-6 mb-6">
          ${section.title ? `<h2 class="text-base font-bold text-gray-800 mb-1">${escapeHtml(section.title)}</h2>` : ''}
          ${section.description ? `<p class="text-xs text-gray-500 mb-3">${escapeHtml(section.description)}</p>` : ''}
          ${rowsHtml}
        </div>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(form.title)} - FormCraft Export</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #f8fafc; color: #1e293b; padding: 2rem 1rem; }
    .container { max-width: 48rem; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 1.5rem; padding: 2.5rem; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); }
    .grid { display: grid; }
    .grid-cols-12 { grid-template-columns: repeat(12, minmax(0, 1fr)); }
    .gap-4 { gap: 1rem; }
    .input-field { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #cbd5e1; border-radius: 0.75rem; font-size: 0.8125rem; outline: none; transition: border-color 0.15s; background-color: #f8fafc; }
    .input-field:focus { border-color: #3b82f6; background-color: #ffffff; }
    .btn { display: inline-flex; align-items: center; justify-content: center; padding: 0.625rem 1.5rem; font-size: 0.8125rem; font-weight: 600; border-radius: 0.75rem; border: none; cursor: pointer; background: #2563eb; color: #ffffff; box-shadow: 0 4px 6px -1px rgba(37,99,235,0.2); }
    .btn:hover { background: #1d4ed8; }
    .text-red-500 { color: #ef4444; }
    .modal { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); align-items: center; justify-content: center; z-index: 50; }
    .modal-content { background: white; border-radius: 1.5rem; padding: 1.5rem; max-width: 32rem; width: 100%; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); }
  </style>
</head>
<body>
  <div class="container">
    <div style="border-bottom: 1px solid #e2e8f0; padding-bottom: 1.5rem; margin-bottom: 2rem;">
      <h1 style="font-size: 1.75rem; font-weight: 800; color: #0f172a;">${escapeHtml(form.title)}</h1>
      ${form.description ? `<p style="font-size: 0.875rem; color: #64748b; margin-top: 0.5rem;">${escapeHtml(form.description)}</p>` : ''}
    </div>

    <form id="standaloneForm" onsubmit="handleFormSubmit(event)">
      ${fieldsHtml}
      <div style="margin-top: 1.5rem; display: flex; justify-content: flex-end;">
        <button type="submit" class="btn">${escapeHtml(form.settings?.submitButtonText || 'Submit Form')}</button>
      </div>
    </form>
  </div>

  <div id="resultModal" class="modal">
    <div class="modal-content">
      <h3 style="font-size: 1rem; font-weight: bold; margin-bottom: 0.75rem; color: #059669;">Form Submitted Successfully!</h3>
      <p style="font-size: 0.75rem; color: #64748b; margin-bottom: 1rem;">Offline standalone submission payload compiled directly in browser:</p>
      <pre id="jsonResult" style="background: #f1f5f9; padding: 0.75rem; border-radius: 0.5rem; font-size: 0.7rem; overflow-x: auto; max-height: 12rem; margin-bottom: 1rem;"></pre>
      <div style="display: flex; justify-content: flex-end; gap: 0.5rem;">
        <button onclick="document.getElementById('resultModal').style.display='none'" class="btn" style="background: #64748b;">Close</button>
      </div>
    </div>
  </div>

  <script>
    function handleFormSubmit(e) {
      e.preventDefault();
      const form = e.target;
      const data = {};
      const formData = new FormData(form);
      for (const [key, val] of formData.entries()) {
        if (data[key]) {
          if (!Array.isArray(data[key])) data[key] = [data[key]];
          data[key].push(val);
        } else {
          data[key] = val;
        }
      }
      document.getElementById('jsonResult').textContent = JSON.stringify(data, null, 2);
      document.getElementById('resultModal').style.display = 'flex';
    }
  </script>
</body>
</html>`;
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
