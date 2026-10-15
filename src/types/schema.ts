export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'time'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'heading'
  | 'divider'
  | 'table';

export interface FieldOption {
  label: string;
  value: string;
}

export interface TableColumn {
  id: string;
  key?: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'select' | 'heading';
  required?: boolean;
  placeholder?: string;
  options?: FieldOption[];
}

export interface TableConfig {
  columns: TableColumn[];
  minRows?: number;
  maxRows?: number;
  allowAddRows?: boolean;
  defaultRows?: Record<string, any>[];
}

export interface ValidationRules {
  required?: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  customErrorMessage?: string;
}

export type OracleBindType = 'STRING' | 'NUMBER' | 'DATE';
export type DataBindingMode = 'read' | 'write' | 'read-write';

export interface DataBindingConfig {
  source: 'oracle' | 'none';
  table?: string;
  column: string;
  mode?: DataBindingMode;
  oracleType?: OracleBindType;
  dataType?: 'string' | 'number' | 'date' | 'boolean';
  queryKey?: string;
}

export interface OptionsBindingConfig {
  table: string;
  valueColumn: string;
  labelColumn: string;
}

export interface FormField {
  id: string;
  name: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  helpText?: string;
  defaultValue?: string | number | boolean | string[];
  options?: FieldOption[];
  tableConfig?: TableConfig;
  validation?: ValidationRules;
  dataBinding?: DataBindingConfig | null;
  optionsBinding?: OptionsBindingConfig | null;
  visibleIf?: { fieldId: string; equals: string | number | boolean };
  _needsReview?: boolean;
  _reviewReason?: string;
}

export interface LayoutColumn {
  id: string;
  width: number; // 1-12
  fieldIds: string[];
}

export interface LayoutRow {
  id: string;
  columns: LayoutColumn[];
}

export interface LayoutSection {
  id: string;
  title?: string;
  description?: string;
  collapsible?: boolean;
  rows: LayoutRow[];
  enableFetchRecord?: boolean;
  fetchEntity?: string;
  fetchPrimaryKey?: string;
  _needsReview?: boolean;
  _reviewReason?: string;
}


export interface FormTheme {
  primaryColor: string;
  borderRadius: 'none' | 'sm' | 'md' | 'lg' | 'full';
  fontFamily: string;
}

export type PatientFormMode = 'NEW_RECORD' | 'CONTINUE_EXISTING';

export interface FormSettings {
  submitButtonText: string;
  submitAction: 'download_json' | 'print';
  showResetButton: boolean;
  resetButtonText?: string;
  theme?: FormTheme;
  primaryEntity?: string;
  primaryKeyColumn?: string;
  enableFetchRecord?: boolean;
  patientFormMode?: PatientFormMode;
  departmentIds?: string[];
  departmentNames?: string[];
  departmentId?: string;
  departmentName?: string;
  serviceCenterId?: string;
  serviceCenterName?: string;
}

export interface SqlQueryParameterMapping {
  source: 'form' | 'context' | 'static';
  fieldKey?: string;
  value?: unknown;
}

export interface SqlQueryDefinition {
  id: string;
  name: string;
  operation: 'select';
  sql: string;
  enabled: boolean;
  parameterMappings: Record<string, SqlQueryParameterMapping>;
  resultMappings: Record<string, string>;
  executeOn: 'formLoad' | 'fieldChange' | 'buttonClick';
  triggerFieldKey?: string;
  buttonLabel?: string;
}

export interface FormDefinition {
  version: '1.0.0';
  id: string;
  title: string;
  description?: string;
  settings: FormSettings;
  fields: Record<string, FormField>;
  layout: LayoutSection[];
  sqlQueries?: SqlQueryDefinition[];
}

export type FormStatus = 'draft' | 'published' | 'unpublished' | 'archived';

export interface FormPermissions {
  canView?: string[];
  canCreate?: string[];
  canEdit?: string[];
  canDesign?: string[];
  canPublish?: string[];
  anonymousAccess?: boolean;
}

export interface FormMetadata {
  id: string;
  name: string;
  title?: string;
  slug: string;
  status: FormStatus;
  currentDraftVersion: number;
  publishedVersion: number | null;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
  primaryEntity?: string | null;
  permissions?: FormPermissions;
  runtimeUrl?: string | null;
  isPublished?: boolean;
  hasDraft?: boolean;
  departmentIds?: string[];
  departmentNames?: string[];
  departmentId?: string | null;
  departmentName?: string | null;
  serviceCenterId?: string | null;
  serviceCenterName?: string | null;
}

export interface FormVersionRecord {
  versionNumber: number;
  fileName?: string;
  createdAt: string;
}

export interface PublishValidationIssue {
  type: 'error' | 'warning';
  category: 'structure' | 'binding' | 'options' | 'security' | 'runtime';
  message: string;
  fieldId?: string;
}

export interface PublishValidationResult {
  valid: boolean;
  issues: PublishValidationIssue[];
  summary: {
    totalFields: number;
    databaseBindings: number;
    optionsBindings: number;
    oracleAvailable: boolean;
  };
}

export interface FormSubmissionRecord {
  id: number | string;
  formId: string;
  formSlug: string;
  formVersion?: number;
  patientId?: string;
  mrno?: string;
  admissionNumber?: string;
  recordId?: string;
  submittedAt: string;
  updatedAt?: string;
  submittedBy?: string;
  status: string;
  submissionMode: PatientFormMode;
  formData?: Record<string, any>;
}

export interface PatientFormStateResponse {
  success: boolean;
  mode: PatientFormMode;
  hasExistingRecord: boolean;
  recordId?: string | number | null;
  submissionId?: number | string | null;
  submittedAt?: string | null;
  updatedAt?: string | null;
  status?: string;
  data?: Record<string, any> | null;
  history?: FormSubmissionRecord[];
  error?: string;
}

