import * as XLSX_NS from 'xlsx';
const XLSX = (XLSX_NS && XLSX_NS.default) ? XLSX_NS.default : XLSX_NS;

/**
 * Reads a workbook from a buffer with the options this parser actually
 * depends on. Without these, two whole detection paths silently break:
 *  - cellDates: without it, date cells come through as raw serials with
 *    t:'n' and get misclassified as number fields.
 *  - cellNF: needed for reliable cell.z format-string access (date/number
 *    format detection).
 *  - cellStyles: needed for the bold/font-size header signal below.
 *
 * If you're reading the file in a browser (e.g. from a File/ArrayBuffer)
 * rather than a Node Buffer, change `type: 'buffer'` to `type: 'array'`.
 */
export function readWorkbookFromBuffer(buffer) {
  return XLSX.read(buffer, {
    type: 'buffer',
    cellDates: true,
    cellNF: true,
    cellStyles: true,
  });
}

/**
 * Diagnostic utility — call this on a known test file that has dropdowns
 * in it to confirm your installed xlsx version actually surfaces data
 * validation on read. The free/Community edition of SheetJS has
 * well-documented, inconsistent support for this; if this returns false
 * on a file you know has dropdowns, switch to `exceljs` for the
 * validation-reading step (it can coexist with xlsx for everything else).
 */
export function checkDataValidationSupport(workbook) {
  for (const sheetName of workbook.SheetNames) {
    const ws = workbook.Sheets[sheetName];
    const dv = (ws && (ws['!dataValidation'] || ws['!validations'])) || [];
    if (Array.isArray(dv) && dv.length > 0) return true;
  }
  return false;
}

/**
 * Normalizes label strings by stripping trailing colons, asterisks, and whitespace.
 * Also detects if label indicates a required field (e.g., ending with *).
 */
export function cleanLabel(rawText) {
  if (!rawText) return { label: '', isRequired: false };
  let str = String(rawText).trim();
  let isRequired = false;

  if (str.endsWith('*') || str.includes('*')) {
    isRequired = true;
    str = str.replace(/\*/g, '').trim();
  }

  // Remove trailing colons, dashes
  str = str.replace(/[:：\-_]+$/, '').trim();

  return { label: str, isRequired };
}

/**
 * Creates a unique random ID for fields, sections, rows, columns.
 */
export function createId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
}

/**
 * Slugifies a label into a stable field name. Callers should dedupe via
 * a shared name registry (see makeFieldNameFactory) rather than relying
 * on randomness — a deterministic name means re-importing the same sheet
 * twice produces the same field names, which matters for debugging and
 * any future re-import/diffing workflow.
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
 * Returns a naming function backed by a shared registry, so fields
 * produced anywhere in a single parse (including table-group fields)
 * dedupe against each other consistently: "first_name", then
 * "first_name_2" on a genuine collision, rather than a random suffix
 * on every field regardless of collision.
 */
function makeFieldNameFactory() {
  const usedNames = new Map();
  return function makeFieldName(label, fieldType) {
    const base = slugify(label, fieldType);
    const count = usedNames.get(base) || 0;
    usedNames.set(base, count + 1);
    return count === 0 ? base : `${base}_${count + 1}`;
  };
}

/**
 * Checks whether refStr looks like a plain cell/range address
 * (e.g. "A1", "$B$2:$B$10") as opposed to a defined-name reference
 * like "Countries".
 */
function looksLikeCellRange(refStr) {
  return /^\$?[A-Z]+\$?\d+(:\$?[A-Z]+\$?\d+)?$/i.test(refStr.trim());
}

/**
 * Resolves cell reference like "A1" or range "A1:A5" or "Sheet1!$B$2:$B$6",
 * or a workbook-level defined name (Formulas > Name Manager) such as
 * "Countries" — a very common real-world source for dropdown lists that
 * the previous version silently failed to resolve.
 */
function resolveRangeValues(workbook, refStr, currentSheetName) {
  try {
    let sheetName = currentSheetName;
    let cellRef = String(refStr || '').trim();

    if (cellRef.includes('!')) {
      const parts = cellRef.split('!');
      sheetName = parts[0].replace(/['"]/g, '');
      cellRef = parts[1];
    } else if (!looksLikeCellRange(cellRef)) {
      // Not a same-sheet range and no sheet prefix -> likely a defined name
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
        return []; // genuinely unresolvable
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
    console.warn('Error resolving range reference:', refStr, e);
  }
  return [];
}

/**
 * Extracts data validation rule for a specific cell from worksheet validations if present.
 */
function findDataValidation(worksheet, r, c) {
  const validations = worksheet['!dataValidation'] || worksheet['!validations'] || [];
  if (!Array.isArray(validations) || validations.length === 0) return null;

  for (const dv of validations) {
    if (!dv.sqref) continue;
    // sqref can be multiple ranges separated by spaces, e.g. "B2:B10 C2:C10"
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
      } catch (e) {
        // Single cell address like "B5"
        try {
          const cell = XLSX.utils.decode_cell(rangeStr);
          if (cell.r === r && cell.c === c) return dv;
        } catch (err) {
          // ignore
        }
      }
    }
  }
  return null;
}

/**
 * Snap column widths to 12-column grid.
 */
export function snapTo12Columns(rawSpans) {
  if (!rawSpans || rawSpans.length === 0) return [];
  if (rawSpans.length === 1) return [12];

  const totalRaw = rawSpans.reduce((a, b) => a + b, 0);
  if (totalRaw === 0) {
    const equal = Math.floor(12 / rawSpans.length);
    const res = rawSpans.map(() => equal);
    const remainder = 12 - equal * rawSpans.length;
    res[res.length - 1] += remainder;
    return res;
  }

  // Calculate proportional 1-12
  let rounded = rawSpans.map((s) => Math.max(1, Math.round((s / totalRaw) * 12)));
  let currentSum = rounded.reduce((a, b) => a + b, 0);

  // Adjust to exactly 12
  while (currentSum !== 12) {
    if (currentSum > 12) {
      // reduce largest element > 1
      let maxIdx = 0;
      for (let i = 1; i < rounded.length; i++) {
        if (rounded[i] > rounded[maxIdx]) maxIdx = i;
      }
      if (rounded[maxIdx] > 1) {
        rounded[maxIdx]--;
        currentSum--;
      } else {
        break;
      }
    } else {
      // increase smallest element
      let minIdx = 0;
      for (let i = 1; i < rounded.length; i++) {
        if (rounded[i] < rounded[minIdx]) minIdx = i;
      }
      rounded[minIdx]++;
      currentSum++;
    }
  }

  return rounded;
}

/**
 * Main parser: Excel Sheet -> FormDefinition
 */
export function parseExcelSheetToForm(workbook, targetSheetName) {
  const sheetName = targetSheetName || workbook.SheetNames[0];
  const ws = workbook.Sheets[sheetName];

  if (!ws) {
    throw new Error(`Worksheet "${sheetName}" not found in workbook.`);
  }

  if (!ws['!ref']) {
    throw new Error(`Worksheet "${sheetName}" is completely empty or contains no cell range.`);
  }

  // Soft diagnostic: doesn't block parsing, just surfaces a likely root
  // cause early if dropdown/number-bound fields keep coming out wrong.
  const validationsOnSheet = ws['!dataValidation'] || ws['!validations'] || [];
  if (!Array.isArray(validationsOnSheet) || validationsOnSheet.length === 0) {
    console.warn(
      `[excelParser] No data validation entries found on "${sheetName}". ` +
      `If this sheet has dropdowns, your xlsx read may not be surfacing them — ` +
      `see checkDataValidationSupport() / consider exceljs for this step.`
    );
  }

  const range = XLSX.utils.decode_range(ws['!ref']);
  const merges = ws['!merges'] || [];

  const totalRows = range.e.r - range.s.r + 1;
  const totalCols = range.e.c - range.s.c + 1;

  if (totalRows <= 0 || totalCols <= 0) {
    throw new Error(`Worksheet "${sheetName}" contains zero usable cells.`);
  }

  // Shared name registry so normal fields and table-group fields dedupe
  // against each other deterministically instead of using random suffixes.
  const makeFieldName = makeFieldNameFactory();

  // Helper to get merge starting at (r, c)
  const getMergeAt = (r, c) => {
    return merges.find((m) => m.s.r === r && m.s.c === c) || null;
  };

  // Helper to check if (r, c) is an interior non-origin merged cell
  const isInsideMergeNotOrigin = (r, c) => {
    return merges.some(
      (m) =>
        r >= m.s.r &&
        r <= m.e.r &&
        c >= m.s.c &&
        c <= m.e.c &&
        !(m.s.r === r && m.s.c === c)
    );
  };

  // Helper to fetch cell
  const getCell = (r, c) => {
    const addr = XLSX.utils.encode_cell({ r, c });
    return ws[addr] || null;
  };

  const getCellText = (r, c) => {
    const cell = getCell(r, c);
    if (!cell) return '';
    if (cell.w !== undefined) return String(cell.w).trim();
    if (cell.v !== undefined) return String(cell.v).trim();
    return '';
  };

  // Distinguishes "a cell object exists" (true even for empty-but-bordered
  // input placeholders) from "a cell actually has a value" — the latter
  // is what a genuine repeating-table data row looks like.
  const hasRealValue = (r, c) => {
    const cell = getCell(r, c);
    return !!(cell && cell.v !== undefined && cell.v !== '');
  };

  // Best-effort bold/font-size signal for header detection. SheetJS's
  // free-tier style parsing is inconsistent across versions, so this is
  // treated as a bonus signal, never a requirement — keyword/ALL-CAPS
  // detection below still works even if this always returns false.
  const looksBoldOrLarge = (r, c) => {
    const cell = getCell(r, c);
    const s = cell && cell.s;
    if (!s) return false;
    if (s.bold === true) return true;
    if (s.font && (s.font.bold === true || (typeof s.font.sz === 'number' && s.font.sz >= 12))) {
      return true;
    }
    return false;
  };

  // Sections and Fields registry
  const fields = {};
  const sections = [];

  let currentSection = {
    id: createId('sec'),
    title: sheetName.replace(/[_-]/g, ' '),
    description: '',
    collapsible: false,
    rows: [],
  };

  // Track processed cells to avoid duplicate handling
  const processedCells = new Set();
  const markProcessed = (r, c) => processedCells.add(`${r},${c}`);
  const isProcessed = (r, c) => processedCells.has(`${r},${c}`);

  // Heuristic Helpers
  const isDatePattern = (cell, label) => {
    if (!cell && !label) return false;
    if (cell) {
      if (cell.t === 'd') return true;
      if (cell.z && /(yy|yyyy|mm|dd|mmm|date)/i.test(cell.z) && !/[#$%,]/.test(cell.z)) {
        return true;
      }
      const text = cell.w || String(cell.v || '');
      if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(text) || /^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}$/.test(text)) {
        return true;
      }
    }
    if (label) {
      const lower = label.toLowerCase();
      if (
        /\b(date|dob|birth|deadline|expiry|effective date|due date|appointment date)\b/.test(
          lower
        )
      ) {
        return true;
      }
    }
    return false;
  };

  const isNumericPattern = (cell, label, validation) => {
    if (validation && (validation.type === 'whole' || validation.type === 'decimal')) {
      return true;
    }
    if (cell && cell.t === 'n' && !isDatePattern(cell, label)) {
      return true;
    }
    if (label) {
      const lower = label.toLowerCase();
      if (
        /\b(age|phone|mobile|telephone|fax|zip|postal|quantity|qty|amount|price|cost|total|count|hours|rate|weight|height|score|salary|income)\b/.test(
          lower
        )
      ) {
        return true;
      }
    }
    return false;
  };

  const isCheckboxPattern = (text, label) => {
    const combined = `${text} ${label}`.trim();
    if (/[☐☑✓✔]/.test(combined)) return true;
    if (/\[\s*\]|\[\s*x\s*\]/i.test(combined)) return true;
    if (/\byes\s*[\/\\]\s*no\b/i.test(combined)) return true;
    if (/\btrue\s*[\/\\]\s*false\b/i.test(combined)) return true;
    return false;
  };

  const isTextareaPattern = (label, spanRows) => {
    if (spanRows > 1) return true;
    if (label) {
      const lower = label.toLowerCase();
      if (/\b(email|ip|web|url|mac)\s*address\b/i.test(lower)) return false;
      if (
        /\b(comments?|notes?|description|remarks?|message|street\s*address|mailing\s*address|summary|feedback|details?|reason|instructions?)\b/.test(
          lower
        ) ||
        /^address$/i.test(lower.trim())
      ) {
        return true;
      }
    }
    return false;
  };

  // Check for repeating table in row R. Fixed to require actual populated
  // values (not just styled/bordered empty cells) in at least 2 subsequent
  // rows across most of the same columns — otherwise an ordinary row of
  // 3+ side-by-side fields (City/State/Zip, First/Middle/Last Name) with
  // its own blank input row below it would false-positive as a "table".
  const checkRepeatingTable = (R) => {
    const headerCols = [];
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const text = getCellText(R, C);
      if (text) {
        headerCols.push({ c: C, text });
      }
    }

    if (headerCols.length >= 3) {
      let matchingRows = 0;
      for (let nextR = R + 1; nextR <= Math.min(R + 5, range.e.r); ++nextR) {
        let matchCount = 0;
        for (const col of headerCols) {
          if (hasRealValue(nextR, col.c)) matchCount++;
        }
        // Require most of the header's columns to have real content in
        // this row, not just any styled cell, before counting it.
        if (matchCount >= headerCols.length - 1) matchingRows++;
      }

      // Require at least 2 genuine data rows, not 1 — a single matching
      // row is far too easy to trigger on ordinary form layouts.
      if (matchingRows >= 2) {
        return headerCols;
      }
    }
    return null;
  };

  // Iterate row by row
  let R = range.s.r;
  while (R <= range.e.r) {
    // 1. Check if row is a Section Header
    const firstText = getCellText(R, range.s.c);
    const rowMerge = getMergeAt(R, range.s.c);

    // Count non-empty cells in this row
    let nonEmptyCount = 0;
    let singleCellText = '';
    let singleCellCol = range.s.c;
    for (let c = range.s.c; c <= range.e.c; ++c) {
      const txt = getCellText(R, c);
      if (txt) {
        nonEmptyCount++;
        singleCellText = txt;
        singleCellCol = c;
      }
    }
    // Strip trailing colon before running keyword/case checks, so a
    // header literally written "General Information:" still matches —
    // previously the raw (unstripped) text was checked, which missed this.
    const strippedSingleText = singleCellText.replace(/[:：]+$/, '').trim();

    const isMergedHeader =
      rowMerge &&
      rowMerge.e.c - rowMerge.s.c + 1 >= Math.max(2, Math.floor(totalCols * 0.4)) &&
      firstText.length > 0;

    const isSectionHeaderKeyword =
      /^(section|part|step|schedule|form|details|information|info|profile|demographics|history|vitals|summary|contact|billing|payment|shipping|insurance|assessment|checklist)\b/i.test(
        strippedSingleText
      ) ||
      /\b(information|details|demographics|profile|history|checklist|section|form)$/i.test(
        strippedSingleText
      );

    const isAllUpperCaseHeader =
      strippedSingleText.length > 3 &&
      strippedSingleText === strippedSingleText.toUpperCase() &&
      /[A-Z]/.test(strippedSingleText) &&
      !strippedSingleText.includes(':');

    // Bonus signal: bold/larger font on an otherwise-plain single cell.
    // Best-effort — see looksBoldOrLarge comment above.
    const isStyledHeader =
      nonEmptyCount === 1 && looksBoldOrLarge(R, singleCellCol);

    const isSingleCellHeader =
      nonEmptyCount === 1 &&
      (isSectionHeaderKeyword || isAllUpperCaseHeader || isStyledHeader) &&
      strippedSingleText.length > 2 &&
      strippedSingleText.length < 80 &&
      !/^\d+$/.test(strippedSingleText);

    if (isMergedHeader || isSingleCellHeader) {
      const { label: cleanedTitle } = cleanLabel(isMergedHeader ? firstText : singleCellText);
      const headerTitle = cleanedTitle || (isMergedHeader ? firstText : singleCellText).trim();

      // If current section already has fields/rows, start a new section
      if (currentSection.rows.length > 0) {
        sections.push(currentSection);
      }

      currentSection = {
        id: createId('sec'),
        title: headerTitle,
        description: '',
        collapsible: false,
        rows: [],
      };

      // Mark cells in header as processed
      if (rowMerge) {
        for (let mr = rowMerge.s.r; mr <= rowMerge.e.r; mr++) {
          for (let mc = rowMerge.s.c; mc <= rowMerge.e.c; mc++) {
            markProcessed(mr, mc);
          }
        }
      } else {
        for (let c = range.s.c; c <= range.e.c; ++c) {
          markProcessed(R, c);
        }
      }

      R++;
      continue;
    }

    // 2. Check for repeating table structure
    const tableHeaders = checkRepeatingTable(R);
    if (tableHeaders && tableHeaders.length >= 3) {
      const tableTitle = `Table: ${tableHeaders.map((h) => cleanLabel(h.text).label).filter(Boolean).slice(0, 3).join(' / ')}`;
      const tableSection = {
        id: createId('sec_tbl'),
        title: tableTitle,
        description: 'Auto-detected data table grid.',
        collapsible: false,
        rows: [],
      };

      const tableRow = {
        id: createId('row'),
        columns: [],
      };

      const tableFieldId = createId('fld_tbl');
      const tableColumns = tableHeaders.map((col, idx) => {
        const { label } = cleanLabel(col.text);
        return {
          id: `col_${idx + 1}`,
          label: label || `Column ${idx + 1}`,
          type: 'text',
          placeholder: `Enter ${label || 'value'}...`,
        };
      });

      const tableField = {
        id: tableFieldId,
        name: makeFieldName(tableTitle, 'table'),
        type: 'table',
        label: tableTitle,
        tableConfig: {
          columns: tableColumns,
          minRows: 1,
          allowAddRows: true,
          defaultRows: [],
        },
        validation: { required: false },
        dataBinding: null,
      };

      fields[tableFieldId] = tableField;

      tableRow.columns.push({
        id: createId('col'),
        width: 12,
        fieldIds: [tableFieldId],
      });

      tableSection.rows.push(tableRow);

      if (currentSection.rows.length > 0) {
        sections.push(currentSection);
      }
      sections.push(tableSection);
      currentSection = {
        id: createId('sec'),
        title: 'Additional Information',
        description: '',
        collapsible: false,
        rows: [],
      };

      // Skip the header row and only the matching data rows of this table
      let tableEndR = R;
      for (let nextR = R + 1; nextR <= range.e.r; nextR++) {
        const nextMerge = getMergeAt(nextR, range.s.c);
        if (nextMerge && nextMerge.e.c - nextMerge.s.c + 1 >= Math.max(2, Math.floor(totalCols * 0.4))) {
          break; // Next row is a section header
        }
        let hasTableData = false;
        for (const col of tableHeaders) {
          if (hasRealValue(nextR, col.c)) {
            hasTableData = true;
            break;
          }
        }
        if (hasTableData) {
          tableEndR = nextR;
        } else {
          break;
        }
      }

      for (let skipR = R; skipR <= tableEndR; skipR++) {
        for (let skipC = range.s.c; skipC <= range.e.c; skipC++) {
          markProcessed(skipR, skipC);
        }
      }
      R = tableEndR + 1;
      continue;
    }

    // 3. Scan Row for Fields (Horizontal Pairs & Vertical Pairs)
    const rowFields = [];
    const rawColumnWidths = [];

    let C = range.s.c;
    while (C <= range.e.c) {
      if (isProcessed(R, C) || isInsideMergeNotOrigin(R, C)) {
        C++;
        continue;
      }

      const cell = getCell(R, C);
      const text = getCellText(R, C);
      const cellMerge = getMergeAt(R, C);

      if (!text) {
        C++;
        continue;
      }

      // Check if this text cell is a label for an input
      let inputCol = C + (cellMerge ? cellMerge.e.c - cellMerge.s.c + 1 : 1);
      let inputMerge = inputCol <= range.e.c ? getMergeAt(R, inputCol) : null;
      let inputCell = inputCol <= range.e.c ? getCell(R, inputCol) : null;
      let isHorizontalPair = false;

      if (inputCol <= range.e.c) {
        const inputText = getCellText(R, inputCol);
        if (!inputText || inputText.length === 0 || inputText === '[]' || inputText === '[ ]') {
          isHorizontalPair = true;
        }
      }

      let isVerticalPair = false;
      let verticalInputMerge = null;
      let verticalInputCell = null;
      if (!isHorizontalPair && R + 1 <= range.e.r) {
        const belowText = getCellText(R + 1, C);
        if (!belowText || belowText.length === 0) {
          isVerticalPair = true;
          verticalInputMerge = getMergeAt(R + 1, C);
          verticalInputCell = getCell(R + 1, C);
        }
      }

      const { label, isRequired } = cleanLabel(text);
      if (!label) {
        C++;
        continue;
      }

      let targetInputCell = isHorizontalPair
        ? inputCell
        : isVerticalPair
          ? verticalInputCell
          : cell;
      let targetMerge = isHorizontalPair
        ? inputMerge
        : isVerticalPair
          ? verticalInputMerge
          : cellMerge;
      let targetR = isVerticalPair ? R + 1 : R;
      let targetC = isHorizontalPair ? inputCol : C;

      const dv = findDataValidation(ws, targetR, targetC);

      let fieldType = 'text';
      let options = undefined;
      let validationRules = { required: isRequired };
      let defaultValue = '';
      let needsReview = false;
      let reviewReason = undefined;

      // Rule 1: Data validation of type "List" -> select
      if (dv && dv.type === 'list') {
        fieldType = 'select';
        let rawOpts = [];
        if (dv.formula1) {
          let formula = String(dv.formula1).trim();
          if (formula.startsWith('"') && formula.endsWith('"')) {
            formula = formula.substring(1, formula.length - 1);
            rawOpts = formula.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
          } else {
            rawOpts = resolveRangeValues(workbook, formula, sheetName);
          }
        }
        if (rawOpts.length > 0) {
          options = rawOpts.map((opt) => ({ label: opt, value: opt.toLowerCase().replace(/\s+/g, '_') }));
        } else {
          options = [
            { label: 'Option 1', value: 'option_1' },
            { label: 'Option 2', value: 'option_2' },
          ];
          needsReview = true;
          reviewReason = 'Excel dropdown list source could not be fully resolved; please verify options.';
        }
      }
      // Rule 2: Numeric constraint fields
      else if (isNumericPattern(targetInputCell, label, dv)) {
        fieldType = 'number';
        defaultValue = 0;
        if (dv && (dv.type === 'whole' || dv.type === 'decimal')) {
          if (dv.formula1 && !isNaN(Number(dv.formula1))) {
            validationRules.min = Number(dv.formula1);
          }
          if (dv.formula2 && !isNaN(Number(dv.formula2))) {
            validationRules.max = Number(dv.formula2);
          }
        }
      }
      // Rule 3: Date fields
      else if (isDatePattern(targetInputCell, label)) {
        fieldType = 'date';
        defaultValue = '';
      }
      // Rule 4: Checkbox fields (best effort)
      else if (isCheckboxPattern(getCellText(targetR, targetC), label)) {
        fieldType = 'checkbox';
        defaultValue = false;
        if (getCellText(targetR, targetC).includes('?')) {
          needsReview = true;
          reviewReason = 'Checkbox detected from glyph/pattern; please verify default value and behavior.';
        }
      }
      // Rule 5: Textarea (multi-row span or notes/address/comments)
      else if (
        isTextareaPattern(label, targetMerge ? targetMerge.e.r - targetMerge.s.r + 1 : 1)
      ) {
        fieldType = 'textarea';
        defaultValue = '';
      }
      // Rule 6: Plain text fallback
      else {
        fieldType = 'text';
        defaultValue = '';
      }

      const fieldId = createId('fld');
      const safeName = makeFieldName(label, fieldType);

      const newField = {
        id: fieldId,
        name: safeName,
        type: fieldType,
        label,
        placeholder: fieldType === 'select' ? 'Select an option...' : `Enter ${label}...`,
        defaultValue,
        validation: validationRules,
        dataBinding: null,
      };

      if (options) {
        newField.options = options;
      }
      if (needsReview) {
        newField._needsReview = true;
        newField._reviewReason = reviewReason;
      }

      fields[fieldId] = newField;
      rowFields.push(fieldId);

      let spanCols = 1;
      if (targetMerge) {
        spanCols = Math.max(1, targetMerge.e.c - targetMerge.s.c + 1);
      } else if (isHorizontalPair && cellMerge) {
        spanCols = Math.max(1, cellMerge.e.c - cellMerge.s.c + 2);
      }
      rawColumnWidths.push(spanCols);

      markProcessed(R, C);
      if (cellMerge) {
        for (let mr = cellMerge.s.r; mr <= cellMerge.e.r; mr++) {
          for (let mc = cellMerge.s.c; mc <= cellMerge.e.c; mc++) {
            markProcessed(mr, mc);
          }
        }
      }
      if (isHorizontalPair) {
        markProcessed(R, inputCol);
        if (inputMerge) {
          for (let mr = inputMerge.s.r; mr <= inputMerge.e.r; mr++) {
            for (let mc = inputMerge.s.c; mc <= inputMerge.e.c; mc++) {
              markProcessed(mr, mc);
            }
          }
        }
        C = inputMerge ? inputMerge.e.c + 1 : inputCol + 1;
      } else if (isVerticalPair) {
        markProcessed(R + 1, C);
        if (verticalInputMerge) {
          for (let mr = verticalInputMerge.s.r; mr <= verticalInputMerge.e.r; mr++) {
            for (let mc = verticalInputMerge.s.c; mc <= verticalInputMerge.e.c; mc++) {
              markProcessed(mr, mc);
            }
          }
        }
        C++;
      } else {
        C++;
      }
    }

    if (rowFields.length > 0) {
      const snapped = snapTo12Columns(rawColumnWidths);
      const layoutRow = {
        id: createId('row'),
        columns: rowFields.map((fId, idx) => ({
          id: createId('col'),
          width: snapped[idx] || Math.floor(12 / rowFields.length),
          fieldIds: [fId],
        })),
      };
      currentSection.rows.push(layoutRow);
    }

    R++;
  }

  if (currentSection.rows.length > 0) {
    sections.push(currentSection);
  }

  const fieldCount = Object.keys(fields).length;
  if (fieldCount === 0) {
    throw new Error(
      `No parseable form fields or sections were found in worksheet "${sheetName}". Please check that the sheet contains labeled input cells or form headers.`
    );
  }

  const formDefinition = {
    version: '1.0.0',
    id: createId('form'),
    title: sheetName ? `${sheetName} Form` : 'Imported Excel Form',
    description: `Auto-generated from worksheet "${sheetName}".`,
    settings: {
      submitButtonText: 'Submit Form',
      submitAction: 'download_json',
      showResetButton: true,
      resetButtonText: 'Clear Form',
      theme: {
        primaryColor: '#2563eb',
        borderRadius: 'md',
        fontFamily: 'Inter, system-ui, sans-serif',
      },
    },
    fields,
    layout: sections,
  };

  return formDefinition;
}