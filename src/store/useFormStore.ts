import { create } from 'zustand';
import { temporal } from 'zundo';
import type {
  FormDefinition,
  FormField,
  FieldType,
  LayoutSection,
  LayoutRow,
  LayoutColumn,
  FormSettings,
  FormTheme,
  SqlQueryDefinition,
} from '../types/schema';
import { defaultInitialForm, createEmptyForm } from '../utils/initialForm';

export type SelectionType = 'field' | 'section' | 'column' | 'settings' | null;

export interface FormState {
  form: FormDefinition;
  selectedId: string | null;
  selectedType: SelectionType;
  isPreviewMode: boolean;
  builderTheme: 'light' | 'dark';
  isUploadModalOpen: boolean;
  isSidebarCollapsed: boolean;

  // UI state actions (not tracked in undo/redo)
  setSelected: (id: string | null, type?: SelectionType) => void;
  setPreviewMode: (preview: boolean) => void;
  setBuilderTheme: (theme: 'light' | 'dark') => void;
  toggleBuilderTheme: () => void;
  setUploadModalOpen: (open: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebarCollapsed: () => void;



  // Form Definition actions (tracked in undo/redo)
  updateMetadata: (title: string, description?: string) => void;
  updateSettings: (settings: Partial<FormSettings>) => void;
  loadForm: (newForm: FormDefinition) => void;
  resetToEmpty: () => void;
  resetToSample: () => void;

  // Field actions
  addField: (
    type: FieldType,
    sectionId?: string,
    rowId?: string,
    columnId?: string,
    index?: number
  ) => string;
  updateField: (fieldId: string, updates: Partial<FormField>) => void;
  duplicateField: (fieldId: string) => void;
  deleteField: (fieldId: string) => void;
  moveField: (fieldId: string, targetColumnId: string, targetIndex?: number) => void;
  moveFieldToNewRow: (fieldId: string, targetSectionId: string, targetRowIndex: number) => void;
  addFieldToNewRow: (type: FieldType, targetSectionId: string, targetRowIndex: number) => string;

  // Table cell & column actions
  addTableCellField: (
    tableFieldId: string,
    rowIndex: number,
    colKey: string,
    type: FieldType
  ) => string;
  removeTableCellField: (
    tableFieldId: string,
    rowIndex: number,
    colKey: string
  ) => void;
  moveTableCellField: (
    sourceTableId: string,
    sourceRow: number,
    sourceColKey: string,
    targetTableId: string,
    targetRow: number,
    targetColKey: string
  ) => void;
  moveFieldToTableCell: (
    fieldId: string,
    targetTableId: string,
    targetRow: number,
    targetColKey: string
  ) => void;
  moveTableCellToCanvas: (
    sourceTableId: string,
    sourceRow: number,
    sourceColKey: string,
    targetColId: string,
    targetIndex?: number
  ) => void;
  moveTableCellToNewRow: (
    sourceTableId: string,
    sourceRow: number,
    sourceColKey: string,
    targetSecId: string,
    targetRowIndex: number
  ) => void;
  setTableColumnType: (
    tableFieldId: string,
    colKey: string,
    type: FieldType
  ) => void;

  // Section actions
  addSection: (title?: string) => void;
  moveSection: (sectionId: string, targetIndex: number) => void;
  updateSection: (sectionId: string, updates: Partial<LayoutSection>) => void;
  deleteSection: (sectionId: string) => void;

  // Row & Column layout actions
  addRow: (sectionId: string, widths?: number[]) => void;
  moveRow: (
    sourceSectionId: string,
    rowId: string,
    targetSectionId: string,
    targetIndex: number
  ) => void;
  deleteRow: (sectionId: string, rowId: string) => void;
  setRowLayout: (sectionId: string, rowId: string, widths: number[]) => void;
  setColumnWidth: (sectionId: string, rowId: string, columnId: string, width: number) => void;
  autoBalanceRowWidths: (sectionId: string, rowId: string) => void;
  autoFixLayoutWidths: () => void;

  // SQL Query actions (tracked in undo/redo)
  addSqlQuery: (query: SqlQueryDefinition) => void;
  updateSqlQuery: (queryId: string, updates: Partial<SqlQueryDefinition>) => void;
  deleteSqlQuery: (queryId: string) => void;
}

const createDefaultField = (type: FieldType): FormField => {
  const id = `fld_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const baseName = `${type}_${Math.random().toString(36).substring(2, 6)}`;

  switch (type) {
    case 'text':
      return {
        id,
        name: baseName,
        type: 'text',
        label: 'Text Field',
        placeholder: 'Enter text...',
        defaultValue: '',
        validation: { required: false },
        dataBinding: null,
      };
    case 'textarea':
      return {
        id,
        name: baseName,
        type: 'textarea',
        label: 'Long Text Area',
        placeholder: 'Enter long description...',
        defaultValue: '',
        validation: { required: false, max: 1000 },
        dataBinding: null,
      };
    case 'number':
      return {
        id,
        name: baseName,
        type: 'number',
        label: 'Number Input',
        placeholder: '0',
        defaultValue: 0,
        validation: { required: false },
        dataBinding: null,
      };
    case 'date':
      return {
        id,
        name: baseName,
        type: 'date',
        label: 'Date Picker',
        validation: { required: false },
        dataBinding: null,
      };
    case 'time':
      return {
        id,
        name: baseName,
        type: 'time',
        label: 'Time Picker',
        placeholder: 'HH:MM',
        validation: { required: false },
        dataBinding: null,
      };
    case 'select':
      return {
        id,
        name: baseName,
        type: 'select',
        label: 'Select Dropdown',
        defaultValue: 'option_1',
        options: [
          { label: 'Option 1', value: 'option_1' },
          { label: 'Option 2', value: 'option_2' },
          { label: 'Option 3', value: 'option_3' },
        ],
        validation: { required: false },
        dataBinding: null,
      };
    case 'radio':
      return {
        id,
        name: baseName,
        type: 'radio',
        label: 'Radio Options',
        defaultValue: 'option_1',
        options: [
          { label: 'Option 1', value: 'option_1' },
          { label: 'Option 2', value: 'option_2' },
        ],
        validation: { required: false },
        dataBinding: null,
      };
    case 'checkbox':
      return {
        id,
        name: baseName,
        type: 'checkbox',
        label: 'Checkbox Group',
        defaultValue: [],
        options: [
          { label: 'Choice A', value: 'choice_a' },
          { label: 'Choice B', value: 'choice_b' },
        ],
        validation: { required: false },
        dataBinding: null,
      };
    case 'heading':
      return {
        id,
        name: baseName,
        type: 'heading',
        label: 'Section Header',
        helpText: 'Subtitle or instructions description goes here',
      };
    case 'divider':
      return {
        id,
        name: baseName,
        type: 'divider',
        label: '',
      };
    case 'table':
      return {
        id,
        name: baseName,
        type: 'table',
        label: 'Data Table',
        helpText: 'Editable multi-row table grid',
        tableConfig: {
          columns: [
            { id: 'col_1', label: 'Item / Description', type: 'text' },
            { id: 'col_2', label: 'Category', type: 'text' },
            { id: 'col_3', label: 'Quantity / Value', type: 'text' },
          ],
          allowAddRows: true,
          minRows: 1,
          defaultRows: [
            { col_1: 'Sample Entry 1', col_2: 'Standard', col_3: '1' },
            { col_1: 'Sample Entry 2', col_2: 'Priority', col_3: '2' },
          ],
        },
      };
    case 'pain_assessment':
      return {
        id,
        name: baseName,
        type: 'pain_assessment',
        label: 'PAIN ASSESSMENT',
        helpText: 'Record pain presence, location, and severity using a 0–10 facial scale',
        defaultValue: {
          painPresent: '',
          location: '',
          score: null,
        },
        validation: { required: false },
        dataBinding: null,
      };
  }
};

const getStoredTheme = (): 'light' | 'dark' => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('formcraft_builder_theme');
    if (stored === 'dark' || stored === 'light') return stored;
  }
  return 'light';
};

const applyThemeToDOM = (theme: 'light' | 'dark') => {
  if (typeof document !== 'undefined') {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }
};

const initialTheme = getStoredTheme();
applyThemeToDOM(initialTheme);

export const useFormStore = create<FormState>()(
  temporal(
    (set, get) => ({
      form: defaultInitialForm,
      selectedId: null,
      selectedType: null,
      isPreviewMode: false,
      builderTheme: initialTheme,
      isUploadModalOpen: false,
      isSidebarCollapsed: false,

      setSidebarCollapsed: (collapsed) => {
        set({ isSidebarCollapsed: collapsed });
      },

      toggleSidebarCollapsed: () => {
        set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed }));
      },

      setUploadModalOpen: (open) => {
        set({ isUploadModalOpen: open });
      },

      setBuilderTheme: (theme) => {

        applyThemeToDOM(theme);
        if (typeof window !== 'undefined') {
          localStorage.setItem('formcraft_builder_theme', theme);
        }
        set({ builderTheme: theme });
      },

      toggleBuilderTheme: () => {
        const next = get().builderTheme === 'dark' ? 'light' : 'dark';
        applyThemeToDOM(next);
        if (typeof window !== 'undefined') {
          localStorage.setItem('formcraft_builder_theme', next);
        }
        set({ builderTheme: next });
      },

      setSelected: (id, type = 'field') => {
        set({ selectedId: id, selectedType: id ? type : null });
      },

      setPreviewMode: (preview) => {
        set({ isPreviewMode: preview, selectedId: null, selectedType: null });
      },


      updateMetadata: (title, description) => {
        set((state) => ({
          form: {
            ...state.form,
            title,
            description: description !== undefined ? description : state.form.description,
          },
        }));
      },

      updateSettings: (settingsUpdates) => {
        set((state) => {
          const defaultTheme: FormTheme = {
            primaryColor: '#3b82f6',
            borderRadius: 'md',
            fontFamily: 'Inter, system-ui, sans-serif',
          };
          const currentTheme: FormTheme = state.form.settings.theme || defaultTheme;
          const mergedTheme: FormTheme = settingsUpdates.theme
            ? {
              primaryColor: settingsUpdates.theme.primaryColor ?? currentTheme.primaryColor,
              borderRadius: settingsUpdates.theme.borderRadius ?? currentTheme.borderRadius,
              fontFamily: settingsUpdates.theme.fontFamily ?? currentTheme.fontFamily,
            }
            : currentTheme;

          return {
            form: {
              ...state.form,
              settings: {
                ...state.form.settings,
                ...settingsUpdates,
                theme: mergedTheme,
              },
            },
          };
        });
      },


      loadForm: (newForm) => {
        set({
          form: newForm,
          selectedId: null,
          selectedType: null,
        });
      },

      resetToEmpty: () => {
        const empty = createEmptyForm();
        set({
          form: empty,
          selectedId: null,
          selectedType: null,
          isPreviewMode: false,
        });
      },


      resetToSample: () => {
        set({
          form: defaultInitialForm,
          selectedId: null,
          selectedType: null,
        });
      },

      addField: (type, sectionId, rowId, columnId, index) => {
        const newField = createDefaultField(type);
        const { form } = get();

        // If target position not specified, add to the last available column
        let targetSecId = sectionId;
        let targetRId = rowId;
        let targetCId = columnId;

        if (!targetSecId && form.layout.length > 0) {
          const lastSec = form.layout[form.layout.length - 1];
          targetSecId = lastSec.id;
          if (lastSec.rows.length > 0) {
            const lastRow = lastSec.rows[lastSec.rows.length - 1];
            targetRId = lastRow.id;
            if (lastRow.columns.length > 0) {
              targetCId = lastRow.columns[lastRow.columns.length - 1].id;
            }
          }
        }

        // If still no section/row/col, create one
        let newLayout = [...form.layout];
        if (newLayout.length === 0) {
          const freshSec: LayoutSection = {
            id: `sec_${Date.now()}`,
            title: 'Section 1',
            rows: [
              {
                id: `row_${Date.now()}`,
                columns: [{ id: `col_${Date.now()}`, width: 12, fieldIds: [newField.id] }],
              },
            ],
          };
          newLayout = [freshSec];
        } else {
          newLayout = newLayout.map((sec) => {
            if (sec.id !== targetSecId) return sec;
            return {
              ...sec,
              rows: sec.rows.map((row) => {
                if (row.id !== targetRId) return row;
                return {
                  ...row,
                  columns: row.columns.map((col) => {
                    if (col.id !== targetCId) return col;
                    const newFieldIds = [...col.fieldIds];
                    if (typeof index === 'number' && index >= 0) {
                      newFieldIds.splice(index, 0, newField.id);
                    } else {
                      newFieldIds.push(newField.id);
                    }
                    return { ...col, fieldIds: newFieldIds };
                  }),
                };
              }),
            };
          });
        }

        set({
          form: {
            ...form,
            fields: {
              ...form.fields,
              [newField.id]: newField,
            },
            layout: newLayout,
          },
          selectedId: newField.id,
          selectedType: 'field',
        });

        return newField.id;
      },

      updateField: (fieldId, updates) => {
        set((state) => {
          const existing = state.form.fields[fieldId];
          if (!existing) return state;
          return {
            form: {
              ...state.form,
              fields: {
                ...state.form.fields,
                [fieldId]: {
                  ...existing,
                  ...updates,
                  validation: {
                    ...existing.validation,
                    ...(updates.validation || {}),
                  },
                },
              },
            },
          };
        });
      },

      duplicateField: (fieldId) => {
        const { form } = get();
        const existing = form.fields[fieldId];
        if (!existing) return;

        const newId = `fld_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const duplicated: FormField = {
          ...JSON.parse(JSON.stringify(existing)),
          id: newId,
          name: `${existing.name}_copy`,
          label: `${existing.label} (Copy)`,
        };

        const newLayout = form.layout.map((sec) => ({
          ...sec,
          rows: sec.rows.map((row) => ({
            ...row,
            columns: row.columns.map((col) => {
              const idx = col.fieldIds.indexOf(fieldId);
              if (idx === -1) return col;
              const newIds = [...col.fieldIds];
              newIds.splice(idx + 1, 0, newId);
              return { ...col, fieldIds: newIds };
            }),
          })),
        }));

        set({
          form: {
            ...form,
            fields: {
              ...form.fields,
              [newId]: duplicated,
            },
            layout: newLayout,
          },
          selectedId: newId,
          selectedType: 'field',
        });
      },

      deleteField: (fieldId) => {
        set((state) => {
          const newFields = { ...state.form.fields };
          delete newFields[fieldId];

          // Also clean up any table cell reference to this field
          Object.keys(newFields).forEach((key) => {
            const f = newFields[key];
            if (f.type === 'table' && f.tableConfig?.cellFields) {
              const updatedCellFields = { ...f.tableConfig.cellFields };
              let changed = false;
              Object.entries(updatedCellFields).forEach(([cKey, val]) => {
                const id = typeof val === 'string' ? val : (val as FormField)?.id;
                if (id === fieldId) {
                  delete updatedCellFields[cKey];
                  changed = true;
                }
              });
              if (changed) {
                newFields[key] = {
                  ...f,
                  tableConfig: {
                    ...f.tableConfig,
                    cellFields: updatedCellFields,
                  },
                };
              }
            }
          });

          const newLayout = state.form.layout.map((sec) => ({
            ...sec,
            rows: sec.rows.map((row) => ({
              ...row,
              columns: row.columns.map((col) => ({
                ...col,
                fieldIds: col.fieldIds.filter((id) => id !== fieldId),
              })),
            })),
          }));

          return {
            form: {
              ...state.form,
              fields: newFields,
              layout: newLayout,
            },
            selectedId: state.selectedId === fieldId ? null : state.selectedId,
            selectedType: state.selectedId === fieldId ? null : state.selectedType,
          };
        });
      },

      moveField: (fieldId, targetColumnId, targetIndex) => {
        set((state) => {
          if (!state.form.fields[fieldId]) return state;

          // Locate current source column and index
          let sourceColId: string | null = null;
          let sourceFieldIdx = -1;

          for (const sec of state.form.layout) {
            for (const row of sec.rows) {
              for (const col of row.columns) {
                const idx = col.fieldIds.indexOf(fieldId);
                if (idx !== -1) {
                  sourceColId = col.id;
                  sourceFieldIdx = idx;
                  break;
                }
              }
              if (sourceColId) break;
            }
            if (sourceColId) break;
          }

          const newLayout = state.form.layout.map((sec) => ({
            ...sec,
            rows: sec.rows.map((row) => ({
              ...row,
              columns: row.columns.map((col) => {
                if (col.id === sourceColId && col.id === targetColumnId) {
                  // Reordering inside same column
                  const ids = [...col.fieldIds];
                  const [moved] = ids.splice(sourceFieldIdx, 1);
                  let insertIdx = typeof targetIndex === 'number' ? targetIndex : ids.length;
                  insertIdx = Math.max(0, Math.min(insertIdx, ids.length));
                  ids.splice(insertIdx, 0, moved);
                  return { ...col, fieldIds: ids };
                } else if (col.id === sourceColId) {
                  // Remove from source
                  return { ...col, fieldIds: col.fieldIds.filter((id) => id !== fieldId) };
                } else if (col.id === targetColumnId) {
                  // Insert into target column
                  const ids = [...col.fieldIds];
                  let insertIdx = typeof targetIndex === 'number' ? targetIndex : ids.length;
                  insertIdx = Math.max(0, Math.min(insertIdx, ids.length));
                  ids.splice(insertIdx, 0, fieldId);
                  return { ...col, fieldIds: ids };
                }
                return col;
              }),
            })),
          }));

          return {
            form: {
              ...state.form,
              layout: newLayout,
            },
          };
        });
      },

      moveFieldToNewRow: (fieldId, targetSectionId, targetRowIndex) => {
        set((state) => {
          if (!state.form.fields[fieldId]) return state;

          const targetSecIndex = state.form.layout.findIndex((s) => s.id === targetSectionId);
          if (targetSecIndex === -1) return state;

          // Remove field from current location
          const cleanedLayout = state.form.layout.map((sec) => ({
            ...sec,
            rows: sec.rows.map((row) => ({
              ...row,
              columns: row.columns.map((col) => ({
                ...col,
                fieldIds: col.fieldIds.filter((id) => id !== fieldId),
              })),
            })),
          }));

          // Create new row with single 12-span column containing field
          const newColId = `col_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          const newRow: LayoutRow = {
            id: `row_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            columns: [{ id: newColId, width: 12, fieldIds: [fieldId] }],
          };

          const finalLayout = cleanedLayout.map((sec, idx) => {
            if (idx !== targetSecIndex) return sec;
            const rows = [...sec.rows];
            const clampedIndex = Math.max(0, Math.min(targetRowIndex, rows.length));
            rows.splice(clampedIndex, 0, newRow);
            return { ...sec, rows };
          });

          return {
            form: {
              ...state.form,
              layout: finalLayout,
            },
          };
        });
      },

      addFieldToNewRow: (type, targetSectionId, targetRowIndex) => {
        const newField = createDefaultField(type);
        const newColId = `col_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const newRow: LayoutRow = {
          id: `row_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          columns: [{ id: newColId, width: 12, fieldIds: [newField.id] }],
        };

        set((state) => {
          let targetSecIndex = state.form.layout.findIndex((s) => s.id === targetSectionId);
          let newLayout = [...state.form.layout];

          if (newLayout.length === 0) {
            newLayout = [
              {
                id: `sec_${Date.now()}`,
                title: 'Section 1',
                collapsible: false,
                rows: [newRow],
              },
            ];
          } else {
            if (targetSecIndex === -1) targetSecIndex = newLayout.length - 1;
            newLayout = newLayout.map((sec, idx) => {
              if (idx !== targetSecIndex) return sec;
              const rows = [...sec.rows];
              const clampedIndex = Math.max(0, Math.min(targetRowIndex, rows.length));
              rows.splice(clampedIndex, 0, newRow);
              return { ...sec, rows };
            });
          }

          return {
            form: {
              ...state.form,
              fields: {
                ...state.form.fields,
                [newField.id]: newField,
              },
              layout: newLayout,
            },
            selectedId: newField.id,
            selectedType: 'field',
          };
        });

        return newField.id;
      },

      addTableCellField: (tableFieldId, rowIndex, colKey, type) => {
        const newField = createDefaultField(type);
        set((state) => {
          const tableField = state.form.fields[tableFieldId];
          if (!tableField || tableField.type !== 'table') return state;

          const cellKey = `${rowIndex}_${colKey}`;
          const currentTableConfig = tableField.tableConfig || { columns: [], defaultRows: [] };
          const currentCellFields = { ...(currentTableConfig.cellFields || {}) };
          currentCellFields[cellKey] = newField;

          const updatedColumns = (currentTableConfig.columns || []).map((col) => {
            const k = col.key || col.id;
            if (k === colKey && (col.type === 'text' || !col.type)) {
              return { ...col, type };
            }
            return col;
          });

          const updatedTableField: FormField = {
            ...tableField,
            tableConfig: {
              ...currentTableConfig,
              columns: updatedColumns,
              cellFields: currentCellFields,
            },
          };

          return {
            form: {
              ...state.form,
              fields: {
                ...state.form.fields,
                [newField.id]: newField,
                [tableFieldId]: updatedTableField,
              },
            },
            selectedId: newField.id,
            selectedType: 'field',
          };
        });
        return newField.id;
      },

      removeTableCellField: (tableFieldId, rowIndex, colKey) => {
        set((state) => {
          const tableField = state.form.fields[tableFieldId];
          if (!tableField || tableField.type !== 'table' || !tableField.tableConfig?.cellFields) return state;

          const cellKey = `${rowIndex}_${colKey}`;
          const target = tableField.tableConfig.cellFields[cellKey];
          const fieldIdToDelete = typeof target === 'string' ? target : (target as FormField)?.id;

          const updatedCellFields = { ...tableField.tableConfig.cellFields };
          delete updatedCellFields[cellKey];

          const updatedFields = { ...state.form.fields };
          if (fieldIdToDelete) {
            delete updatedFields[fieldIdToDelete];
          }
          updatedFields[tableFieldId] = {
            ...tableField,
            tableConfig: {
              ...tableField.tableConfig,
              cellFields: updatedCellFields,
            },
          };

          return {
            form: {
              ...state.form,
              fields: updatedFields,
            },
            selectedId: state.selectedId === fieldIdToDelete ? null : state.selectedId,
            selectedType: state.selectedId === fieldIdToDelete ? null : state.selectedType,
          };
        });
      },

      moveTableCellField: (sourceTableId, sourceRow, sourceColKey, targetTableId, targetRow, targetColKey) => {
        set((state) => {
          const sourceTable = state.form.fields[sourceTableId];
          const targetTable = state.form.fields[targetTableId];
          if (!sourceTable || !targetTable) return state;

          const sourceCellKey = `${sourceRow}_${sourceColKey}`;
          const targetCellKey = `${targetRow}_${targetColKey}`;
          const cellVal = sourceTable.tableConfig?.cellFields?.[sourceCellKey];
          if (!cellVal) return state;

          const fieldId = typeof cellVal === 'string' ? cellVal : (cellVal as FormField).id;
          const fieldObj = state.form.fields[fieldId] || cellVal;

          const updatedFields = { ...state.form.fields };

          if (sourceTableId === targetTableId) {
            const updatedCellFields = { ...(sourceTable.tableConfig?.cellFields || {}) };
            delete updatedCellFields[sourceCellKey];
            updatedCellFields[targetCellKey] = fieldObj;

            updatedFields[sourceTableId] = {
              ...sourceTable,
              tableConfig: {
                ...(sourceTable.tableConfig || { columns: [] }),
                cellFields: updatedCellFields,
              },
            };
          } else {
            const sourceCellFields = { ...(sourceTable.tableConfig?.cellFields || {}) };
            delete sourceCellFields[sourceCellKey];

            const targetCellFields = { ...(targetTable.tableConfig?.cellFields || {}) };
            targetCellFields[targetCellKey] = fieldObj;

            updatedFields[sourceTableId] = {
              ...sourceTable,
              tableConfig: {
                ...(sourceTable.tableConfig || { columns: [] }),
                cellFields: sourceCellFields,
              },
            };
            updatedFields[targetTableId] = {
              ...targetTable,
              tableConfig: {
                ...(targetTable.tableConfig || { columns: [] }),
                cellFields: targetCellFields,
              },
            };
          }

          return {
            form: {
              ...state.form,
              fields: updatedFields,
            },
            selectedId: fieldId,
            selectedType: 'field',
          };
        });
      },

      moveFieldToTableCell: (fieldId, targetTableId, targetRow, targetColKey) => {
        set((state) => {
          const fieldToMove = state.form.fields[fieldId];
          const targetTable = state.form.fields[targetTableId];
          if (!fieldToMove || !targetTable) return state;

          // Remove field from canvas layout column
          const cleanedLayout = state.form.layout.map((sec) => ({
            ...sec,
            rows: sec.rows.map((row) => ({
              ...row,
              columns: row.columns.map((col) => ({
                ...col,
                fieldIds: col.fieldIds.filter((id) => id !== fieldId),
              })),
            })),
          }));

          const targetCellKey = `${targetRow}_${targetColKey}`;
          const targetTableConfig = targetTable.tableConfig || { columns: [], defaultRows: [] };
          const targetCellFields = { ...(targetTableConfig.cellFields || {}) };
          targetCellFields[targetCellKey] = fieldToMove;

          const updatedColumns = (targetTableConfig.columns || []).map((col) => {
            const k = col.key || col.id;
            if (k === targetColKey && (col.type === 'text' || !col.type)) {
              return { ...col, type: fieldToMove.type };
            }
            return col;
          });

          return {
            form: {
              ...state.form,
              layout: cleanedLayout,
              fields: {
                ...state.form.fields,
                [targetTableId]: {
                  ...targetTable,
                  tableConfig: {
                    ...targetTableConfig,
                    columns: updatedColumns,
                    cellFields: targetCellFields,
                  },
                },
              },
            },
            selectedId: fieldId,
            selectedType: 'field',
          };
        });
      },

      moveTableCellToCanvas: (sourceTableId, sourceRow, sourceColKey, targetColId, targetIndex) => {
        set((state) => {
          const sourceTable = state.form.fields[sourceTableId];
          if (!sourceTable) return state;

          const sourceCellKey = `${sourceRow}_${sourceColKey}`;
          const currentCellFields = sourceTable.tableConfig?.cellFields || {};
          let actualCellKey = sourceCellKey;
          let cellVal = currentCellFields[sourceCellKey];

          if (!cellVal) {
            for (const key of Object.keys(currentCellFields)) {
              if (key === `${sourceRow}_${sourceColKey}` || key.endsWith(`_${sourceColKey}`)) {
                actualCellKey = key;
                cellVal = currentCellFields[key];
                break;
              }
            }
          }

          if (!cellVal) return state;

          let fieldId: string;
          let fieldObj: FormField;

          if (typeof cellVal === 'object' && cellVal !== null) {
            fieldId = (cellVal as FormField).id || `fld_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            const existing = state.form.fields[fieldId];
            fieldObj = existing || {
              ...(cellVal as FormField),
              id: fieldId,
              name: (cellVal as FormField).name || `${(cellVal as FormField).type || 'text'}_${Math.random().toString(36).substring(2, 6)}`,
              type: (cellVal as FormField).type || 'text',
              label: (cellVal as FormField).label || 'Field',
            };
          } else if (typeof cellVal === 'string' && state.form.fields[cellVal]) {
            fieldId = cellVal;
            fieldObj = state.form.fields[cellVal];
          } else {
            const fieldType: FieldType =
              typeof cellVal === 'string' &&
                ['text', 'textarea', 'number', 'date', 'time', 'select', 'radio', 'checkbox', 'heading', 'divider', 'table', 'pain_assessment'].includes(cellVal)
                ? (cellVal as FieldType)
                : 'text';
            fieldObj = createDefaultField(fieldType);
            fieldId = fieldObj.id;
          }

          const sourceCellFields = { ...currentCellFields };
          delete sourceCellFields[actualCellKey];

          // Clean field from any existing layout column to avoid duplication
          const cleanedLayout = state.form.layout.map((sec) => ({
            ...sec,
            rows: sec.rows.map((row) => ({
              ...row,
              columns: row.columns.map((col) => ({
                ...col,
                fieldIds: col.fieldIds.filter((id) => id !== fieldId),
              })),
            })),
          }));

          let foundTarget = false;
          // Insert field into target canvas column
          const updatedLayout = cleanedLayout.map((sec) => ({
            ...sec,
            rows: sec.rows.map((row) => ({
              ...row,
              columns: row.columns.map((col) => {
                if (col.id !== targetColId) return col;
                foundTarget = true;
                const ids = [...col.fieldIds];
                let insertIdx = typeof targetIndex === 'number' ? targetIndex : ids.length;
                insertIdx = Math.max(0, Math.min(insertIdx, ids.length));
                ids.splice(insertIdx, 0, fieldId);
                return { ...col, fieldIds: ids };
              }),
            })),
          }));

          if (!foundTarget) {
            return state;
          }

          return {
            form: {
              ...state.form,
              layout: updatedLayout,
              fields: {
                ...state.form.fields,
                [fieldId]: fieldObj,
                [sourceTableId]: {
                  ...sourceTable,
                  tableConfig: {
                    ...(sourceTable.tableConfig || { columns: [] }),
                    cellFields: sourceCellFields,
                  },
                },
              },
            },
            selectedId: fieldId,
            selectedType: 'field',
          };
        });
      },

      moveTableCellToNewRow: (sourceTableId, sourceRow, sourceColKey, targetSecId, targetRowIndex) => {
        set((state) => {
          const sourceTable = state.form.fields[sourceTableId];
          if (!sourceTable) return state;

          const sourceCellKey = `${sourceRow}_${sourceColKey}`;
          const currentCellFields = sourceTable.tableConfig?.cellFields || {};
          let actualCellKey = sourceCellKey;
          let cellVal = currentCellFields[sourceCellKey];

          if (!cellVal) {
            for (const key of Object.keys(currentCellFields)) {
              if (key === `${sourceRow}_${sourceColKey}` || key.endsWith(`_${sourceColKey}`)) {
                actualCellKey = key;
                cellVal = currentCellFields[key];
                break;
              }
            }
          }

          if (!cellVal) return state;

          let fieldId: string;
          let fieldObj: FormField;

          if (typeof cellVal === 'object' && cellVal !== null) {
            fieldId = (cellVal as FormField).id || `fld_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            const existing = state.form.fields[fieldId];
            fieldObj = existing || {
              ...(cellVal as FormField),
              id: fieldId,
              name: (cellVal as FormField).name || `${(cellVal as FormField).type || 'text'}_${Math.random().toString(36).substring(2, 6)}`,
              type: (cellVal as FormField).type || 'text',
              label: (cellVal as FormField).label || 'Field',
            };
          } else if (typeof cellVal === 'string' && state.form.fields[cellVal]) {
            fieldId = cellVal;
            fieldObj = state.form.fields[cellVal];
          } else {
            const fieldType: FieldType =
              typeof cellVal === 'string' &&
                ['text', 'textarea', 'number', 'date', 'time', 'select', 'radio', 'checkbox', 'heading', 'divider', 'table', 'pain_assessment'].includes(cellVal)
                ? (cellVal as FieldType)
                : 'text';
            fieldObj = createDefaultField(fieldType);
            fieldId = fieldObj.id;
          }

          const sourceCellFields = { ...currentCellFields };
          delete sourceCellFields[actualCellKey];

          // Clean field from any existing layout column to avoid duplication
          const cleanedLayout = state.form.layout.map((sec) => ({
            ...sec,
            rows: sec.rows.map((row) => ({
              ...row,
              columns: row.columns.map((col) => ({
                ...col,
                fieldIds: col.fieldIds.filter((id) => id !== fieldId),
              })),
            })),
          }));

          let targetSecIndex = cleanedLayout.findIndex((s) => s.id === targetSecId);
          if (targetSecIndex === -1 && cleanedLayout.length > 0) {
            targetSecIndex = cleanedLayout.length - 1;
          }
          if (targetSecIndex === -1) return state;

          const newColId = `col_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          const newRow: LayoutRow = {
            id: `row_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            columns: [{ id: newColId, width: 12, fieldIds: [fieldId] }],
          };

          const finalLayout = cleanedLayout.map((sec, idx) => {
            if (idx !== targetSecIndex) return sec;
            const rows = [...sec.rows];
            const insertRowIdx = typeof targetRowIndex === 'number' ? targetRowIndex : rows.length;
            const clampedIndex = Math.max(0, Math.min(insertRowIdx, rows.length));
            rows.splice(clampedIndex, 0, newRow);
            return { ...sec, rows };
          });

          return {
            form: {
              ...state.form,
              layout: finalLayout,
              fields: {
                ...state.form.fields,
                [fieldId]: fieldObj,
                [sourceTableId]: {
                  ...sourceTable,
                  tableConfig: {
                    ...(sourceTable.tableConfig || { columns: [] }),
                    cellFields: sourceCellFields,
                  },
                },
              },
            },
            selectedId: fieldId,
            selectedType: 'field',
          };
        });
      },

      setTableColumnType: (tableFieldId, colKey, type) => {
        set((state) => {
          const tableField = state.form.fields[tableFieldId];
          if (!tableField || tableField.type !== 'table') return state;

          const currentTableConfig = tableField.tableConfig || { columns: [], defaultRows: [] };
          const updatedColumns = (currentTableConfig.columns || []).map((col) => {
            const k = col.key || col.id;
            if (k === colKey) {
              return { ...col, type };
            }
            return col;
          });

          return {
            form: {
              ...state.form,
              fields: {
                ...state.form.fields,
                [tableFieldId]: {
                  ...tableField,
                  tableConfig: {
                    ...currentTableConfig,
                    columns: updatedColumns,
                  },
                },
              },
            },
          };
        });
      },

      addSection: (title) => {
        const newSecId = `sec_${Date.now()}`;
        const newRowId = `row_${Date.now()}`;
        const newColId = `col_${Date.now()}`;

        const newSection: LayoutSection = {
          id: newSecId,
          title: title || `Section ${get().form.layout.length + 1}`,
          collapsible: false,
          rows: [
            {
              id: newRowId,
              columns: [{ id: newColId, width: 12, fieldIds: [] }],
            },
          ],
        };

        set((state) => ({
          form: {
            ...state.form,
            layout: [...state.form.layout, newSection],
          },
          selectedId: newSecId,
          selectedType: 'section',
        }));
      },

      moveSection: (sectionId, targetIndex) => {
        set((state) => {
          const layout = [...state.form.layout];
          const currentIndex = layout.findIndex((s) => s.id === sectionId);
          if (currentIndex === -1) return state;

          const [movedSection] = layout.splice(currentIndex, 1);
          const clampedIndex = Math.max(0, Math.min(targetIndex, layout.length));
          layout.splice(clampedIndex, 0, movedSection);

          return {
            form: {
              ...state.form,
              layout,
            },
          };
        });
      },

      updateSection: (sectionId, updates) => {
        set((state) => ({
          form: {
            ...state.form,
            layout: state.form.layout.map((sec) =>
              sec.id === sectionId ? { ...sec, ...updates } : sec
            ),
          },
        }));
      },

      deleteSection: (sectionId) => {
        set((state) => {
          const secToDelete = state.form.layout.find((s) => s.id === sectionId);
          if (!secToDelete) return state;

          // Collect field IDs to delete
          const fieldIdsToDelete = new Set<string>();
          secToDelete.rows.forEach((r) => {
            r.columns.forEach((c) => {
              c.fieldIds.forEach((fId) => fieldIdsToDelete.add(fId));
            });
          });

          const newFields = { ...state.form.fields };
          fieldIdsToDelete.forEach((fId) => delete newFields[fId]);

          return {
            form: {
              ...state.form,
              fields: newFields,
              layout: state.form.layout.filter((s) => s.id !== sectionId),
            },
            selectedId: state.selectedId === sectionId ? null : state.selectedId,
            selectedType: state.selectedId === sectionId ? null : state.selectedType,
          };
        });
      },

      addRow: (sectionId, widths = [12]) => {
        const newRow: LayoutRow = {
          id: `row_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
          columns: widths.map((w, idx) => ({
            id: `col_${Date.now()}_${idx}`,
            width: w,
            fieldIds: [],
          })),
        };

        set((state) => {
          if (state.form.layout.length === 0) {
            const newSec: LayoutSection = {
              id: `sec_${Date.now()}`,
              title: 'Section 1',
              collapsible: false,
              rows: [newRow],
            };
            return {
              form: {
                ...state.form,
                layout: [newSec],
              },
            };
          }

          const targetSecId = sectionId || state.form.layout[state.form.layout.length - 1].id;
          return {
            form: {
              ...state.form,
              layout: state.form.layout.map((sec) => {
                if (sec.id !== targetSecId) return sec;
                return {
                  ...sec,
                  rows: [...sec.rows, newRow],
                };
              }),
            },
          };
        });
      },

      moveRow: (sourceSectionId, rowId, targetSectionId, targetIndex) => {
        set((state) => {
          let sourceSecIndex = state.form.layout.findIndex((s) => s.id === sourceSectionId);
          let rowToMove: LayoutRow | undefined;

          // Failsafe: search all sections if sourceSecIndex not found
          if (sourceSecIndex === -1) {
            for (let i = 0; i < state.form.layout.length; i++) {
              const found = state.form.layout[i].rows.find((r) => r.id === rowId);
              if (found) {
                sourceSecIndex = i;
                break;
              }
            }
          }
          if (sourceSecIndex === -1) return state;

          const sourceSec = state.form.layout[sourceSecIndex];
          const sourceRowIndex = sourceSec.rows.findIndex((r) => r.id === rowId);
          if (sourceRowIndex === -1) return state;
          rowToMove = sourceSec.rows[sourceRowIndex];

          const targetSecIndex = state.form.layout.findIndex((s) => s.id === targetSectionId);
          if (targetSecIndex === -1) return state;

          const newLayout = state.form.layout.map((sec) => ({
            ...sec,
            rows: [...sec.rows],
          }));

          if (sourceSecIndex === targetSecIndex) {
            const rows = newLayout[sourceSecIndex].rows;
            const [moved] = rows.splice(sourceRowIndex, 1);
            const clampedIndex = Math.max(0, Math.min(targetIndex, rows.length));
            rows.splice(clampedIndex, 0, moved);
          } else {
            newLayout[sourceSecIndex].rows.splice(sourceRowIndex, 1);
            const targetRows = newLayout[targetSecIndex].rows;
            const clampedIndex = Math.max(0, Math.min(targetIndex, targetRows.length));
            targetRows.splice(clampedIndex, 0, rowToMove);
          }

          return {
            form: {
              ...state.form,
              layout: newLayout,
            },
          };
        });
      },


      deleteRow: (sectionId, rowId) => {
        set((state) => {
          let fieldIdsToDelete = new Set<string>();
          state.form.layout.forEach((sec) => {
            if (sec.id === sectionId) {
              sec.rows.forEach((r) => {
                if (r.id === rowId) {
                  r.columns.forEach((c) => c.fieldIds.forEach((id) => fieldIdsToDelete.add(id)));
                }
              });
            }
          });

          const newFields = { ...state.form.fields };
          fieldIdsToDelete.forEach((id) => delete newFields[id]);

          return {
            form: {
              ...state.form,
              fields: newFields,
              layout: state.form.layout.map((sec) => {
                if (sec.id !== sectionId) return sec;
                return {
                  ...sec,
                  rows: sec.rows.filter((r) => r.id !== rowId),
                };
              }),
            },
          };
        });
      },

      setRowLayout: (sectionId, rowId, widths) => {
        set((state) => {
          return {
            form: {
              ...state.form,
              layout: state.form.layout.map((sec) => {
                if (sec.id !== sectionId) return sec;
                return {
                  ...sec,
                  rows: sec.rows.map((row) => {
                    if (row.id !== rowId) return row;

                    // Preserve existing fields across the new columns
                    const allFields = row.columns.flatMap((c) => c.fieldIds);
                    const newColumns: LayoutColumn[] = widths.map((w, idx) => ({
                      id: `col_${Date.now()}_${idx}`,
                      width: w,
                      fieldIds: [],
                    }));

                    // Distribute fields back evenly or into first columns
                    allFields.forEach((fId, idx) => {
                      const targetCol = newColumns[idx % newColumns.length];
                      targetCol.fieldIds.push(fId);
                    });

                    return {
                      ...row,
                      columns: newColumns,
                    };
                  }),
                };
              }),
            },
          };
        });
      },

      setColumnWidth: (sectionId, rowId, columnId, width) => {
        set((state) => ({
          form: {
            ...state.form,
            layout: state.form.layout.map((sec) => {
              if (sec.id !== sectionId) return sec;
              return {
                ...sec,
                rows: sec.rows.map((row) => {
                  if (row.id !== rowId) return row;
                  return {
                    ...row,
                    columns: row.columns.map((col) =>
                      col.id === columnId ? { ...col, width } : col
                    ),
                  };
                }),
              };
            }),
          },
        }));
      },

      autoBalanceRowWidths: (sectionId, rowId) => {
        set((state) => ({
          form: {
            ...state.form,
            layout: state.form.layout.map((sec) => {
              if (sec.id !== sectionId) return sec;
              return {
                ...sec,
                rows: sec.rows.map((row) => {
                  if (row.id !== rowId || !row.columns || row.columns.length === 0) return row;
                  const colSum = row.columns.reduce((acc, c) => acc + (c.width || 0), 0);
                  if (colSum === 12) return row;

                  const rawWidths = row.columns.map((c) =>
                    Math.max(1, Math.min(12, Number(c.width) || 1))
                  );
                  const sum = rawWidths.reduce((a, b) => a + b, 0);
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

                  return {
                    ...row,
                    columns: row.columns.map((c, i) => ({
                      ...c,
                      width: snapped[i],
                    })),
                  };
                }),
              };
            }),
          },
        }));
      },

      autoFixLayoutWidths: () => {
        set((state) => ({
          form: {
            ...state.form,
            layout: state.form.layout.map((sec) => ({
              ...sec,
              rows: sec.rows.map((row) => {
                if (!row.columns || row.columns.length === 0) return row;
                const colSum = row.columns.reduce((acc, c) => acc + (c.width || 0), 0);
                if (colSum === 12) return row;

                const rawWidths = row.columns.map((c) =>
                  Math.max(1, Math.min(12, Number(c.width) || 1))
                );
                const sum = rawWidths.reduce((a, b) => a + b, 0);
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

                return {
                  ...row,
                  columns: row.columns.map((c, i) => ({
                    ...c,
                    width: snapped[i],
                  })),
                };
              }),
            })),
          },
        }));
      },

      addSqlQuery: (query) => {
        set((state) => ({
          form: {
            ...state.form,
            sqlQueries: [...(state.form.sqlQueries || []), query],
          },
        }));
      },

      updateSqlQuery: (queryId, updates) => {
        set((state) => ({
          form: {
            ...state.form,
            sqlQueries: (state.form.sqlQueries || []).map((q) =>
              q.id === queryId ? { ...q, ...updates } : q
            ),
          },
        }));
      },

      deleteSqlQuery: (queryId) => {
        set((state) => ({
          form: {
            ...state.form,
            sqlQueries: (state.form.sqlQueries || []).filter((q) => q.id !== queryId),
          },
        }));
      },
    }),
    {
      limit: 50,
      partialize: (state) => ({ form: state.form } as unknown as FormState),
    }
  )
);
