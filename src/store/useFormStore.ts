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

  // Section actions
  addSection: (title?: string) => void;
  updateSection: (sectionId: string, updates: Partial<LayoutSection>) => void;
  deleteSection: (sectionId: string) => void;

  // Row & Column layout actions
  addRow: (sectionId: string, widths?: number[]) => void;
  deleteRow: (sectionId: string, rowId: string) => void;
  setRowLayout: (sectionId: string, rowId: string, widths: number[]) => void;
  setColumnWidth: (sectionId: string, rowId: string, columnId: string, width: number) => void;

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
          // Remove field from its current column
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

          // Insert into target column at targetIndex
          const finalLayout = cleanedLayout.map((sec) => ({
            ...sec,
            rows: sec.rows.map((row) => ({
              ...row,
              columns: row.columns.map((col) => {
                if (col.id !== targetColumnId) return col;
                const newIds = [...col.fieldIds];
                if (typeof targetIndex === 'number' && targetIndex >= 0) {
                  newIds.splice(targetIndex, 0, fieldId);
                } else {
                  newIds.push(fieldId);
                }
                return { ...col, fieldIds: newIds };
              }),
            })),
          }));

          return {
            form: {
              ...state.form,
              layout: finalLayout,
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
