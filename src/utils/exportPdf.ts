import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export interface ExportPdfOptions {
  fileName?: string;
  formTitle?: string;
  recordId?: string | number | null;
}

/**
 * Captures the specified form element and downloads it as a high-resolution PDF file.
 * Preserves all entered data, headings, sections, tables, and styles.
 */
export async function downloadFormAsPdf(
  elementOrId: HTMLElement | string,
  options: ExportPdfOptions = {}
): Promise<void> {
  const element =
    typeof elementOrId === 'string'
      ? document.getElementById(elementOrId)
      : elementOrId;

  if (!element) {
    console.warn('[exportPdf] Target element not found, falling back to window.print()');
    window.print();
    return;
  }

  // Temporarily hide elements with class 'no-print' or 'hide-on-pdf'
  const hiddenElements = element.querySelectorAll<HTMLElement>('.no-print, .hide-on-pdf');
  const originalDisplays: string[] = [];
  hiddenElements.forEach((el, i) => {
    originalDisplays[i] = el.style.display;
    el.style.display = 'none';
  });

  try {
    // High-resolution canvas capture with scale: 2
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      scrollX: 0,
      scrollY: 0,
      windowWidth: document.documentElement.offsetWidth,
      onclone: (clonedDoc) => {
        // Ensure input and textarea values are explicitly reflected in cloned DOM
        const origInputs = element.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
          'input, textarea, select'
        );
        const clonedInputs = clonedDoc.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
          'input, textarea, select'
        );

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

    // Create A4 PDF (210mm x 297mm)
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10; // 10mm margins
    const printableWidth = pageWidth - margin * 2;
    const imgHeight = (canvas.height * printableWidth) / canvas.width;

    const imgData = canvas.toDataURL('image/png');

    let heightLeft = imgHeight;
    let position = margin;

    // First page
    pdf.addImage(imgData, 'PNG', margin, position, printableWidth, imgHeight);
    heightLeft -= (pageHeight - margin * 2);

    // Multi-page handling for long forms
    while (heightLeft > 0) {
      position = heightLeft - imgHeight + margin;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', margin, position, printableWidth, imgHeight);
      heightLeft -= (pageHeight - margin * 2);
    }

    // Determine clean file name
    const rawTitle = options.fileName || options.formTitle || 'form';
    const safeTitle = rawTitle.toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'form';
    const recordSuffix = options.recordId ? `_record_${options.recordId}` : '';
    const dateSuffix = `_${new Date().toISOString().split('T')[0]}`;
    const fullFileName = `${safeTitle}${recordSuffix}${dateSuffix}.pdf`;

    pdf.save(fullFileName);
  } catch (err) {
    console.error('[exportPdf] Failed to generate PDF with html2canvas/jspdf:', err);
    // Graceful fallback to browser print
    window.print();
  } finally {
    // Restore hidden elements display
    hiddenElements.forEach((el, i) => {
      el.style.display = originalDisplays[i] || '';
    });
  }
}
