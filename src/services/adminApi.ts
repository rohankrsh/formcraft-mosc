export interface AdminUser {
  admin_id: number;
  name: string;
  email: string;
  created_at?: string;
}

export interface AdminLoginCredentials {
  email: string;
  password: string;
}

export interface AdminLoginResponse {
  success: boolean;
  admin?: AdminUser;
  token?: string;
  error?: string;
  retryAfterSeconds?: number;
}

export interface AdminMeResponse {
  success: boolean;
  admin?: AdminUser;
  error?: string;
}

export interface AdminActivityLog {
  logId: number;
  eventType: string;
  entityType?: string | null;
  entityId?: string | null;
  actorType: string;
  actorId?: string | null;
  actorName: string;
  description: string;
  details?: any;
  ipAddress?: string | null;
  status: string;
  createdAt: string;
}

export interface AdminStatsResponse {
  success: boolean;
  stats?: {
    totalForms: number;
    publishedForms: number;
    draftForms: number;
    configuredDepartmentsCount: number;
    allowlistedTablesCount: number;
    totalSubmissions: number;
    submissionsToday: number;
    submissionsThisMonth: number;
    distinctSubmittersCount: number;
    totalAdminEdits: number;
    recentActivities?: AdminActivityLog[];
    database: {
      connected: boolean;
      type: string;
      schema: string;
    };
    admin: {
      admin_id: number;
      name: string;
      email: string;
    };
  };
  error?: string;
}

export interface AdminSubmissionRecord {
  id: number;
  formId: string;
  formSlug: string;
  formTitle: string;
  formVersion: number;
  patientId?: string | null;
  mrno?: string | null;
  patientName?: string | null;
  admissionNumber?: string | null;
  recordId?: string | null;
  submittedAt: string;
  updatedAt: string;
  submittedBy: string;
  status: string;
  submissionMode: string;
  editCount: number;
  formData?: Record<string, any>;
  patient?: any;
}

export interface AdminSubmissionListResponse {
  success: boolean;
  data?: AdminSubmissionRecord[];
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  error?: string;
}

export interface AdminSubmissionDetailResponse {
  success: boolean;
  submission?: AdminSubmissionRecord;
  schema?: any;
  error?: string;
  code?: string;
}

export interface SubmissionAuditHistoryItem {
  id: number;
  submissionId: number;
  adminId: number;
  adminName: string;
  adminEmail?: string;
  reason: string;
  changedFields: string[];
  diff?: Record<string, { from: any; to: any }>;
  ipAddress?: string;
  createdAt: string;
}

export interface AdminSubmissionHistoryResponse {
  success: boolean;
  history?: SubmissionAuditHistoryItem[];
  error?: string;
}

export interface AdminLogsResponse {
  success: boolean;
  logs?: AdminActivityLog[];
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  error?: string;
}

export interface AdminLogDetailResponse {
  success: boolean;
  log?: AdminActivityLog;
  error?: string;
}

const API_BASE = '/api/admin';

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const storedToken = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('formcraft_admin_token') : null;
  if (storedToken) {
    headers['Authorization'] = `Bearer ${storedToken}`;
  }
  return headers;
}

/**
 * Authenticates administrator with email and password.
 */
export async function loginAdmin(credentials: AdminLoginCredentials): Promise<AdminLoginResponse> {
  const res = await fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(credentials),
  });

  const data = await res.json();
  if (data.success && data.token) {
    try {
      sessionStorage.setItem('formcraft_admin_token', data.token);
    } catch {
      // ignore
    }
  }

  return data;
}

/**
 * Checks current active administrator session.
 */
export async function getAdminProfile(): Promise<AdminMeResponse> {
  const res = await fetch(`${API_BASE}/me`, {
    method: 'GET',
    headers: getAuthHeaders(),
    credentials: 'include',
  });

  if (!res.ok) {
    return { success: false, error: 'Unauthorized' };
  }

  return await res.json();
}

/**
 * Logs out the administrator, revokes session, and clears client tokens.
 */
export async function logoutAdmin(): Promise<{ success: boolean; message?: string }> {
  try {
    await fetch(`${API_BASE}/logout`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
    });
  } finally {
    try {
      sessionStorage.removeItem('formcraft_admin_token');
    } catch {
      // ignore
    }
  }

  return { success: true };
}

/**
 * Retrieves administrative overview and system metrics.
 */
export async function getAdminDashboardStats(): Promise<AdminStatsResponse> {
  const res = await fetch(`${API_BASE}/stats`, {
    method: 'GET',
    headers: getAuthHeaders(),
    credentials: 'include',
  });

  return await res.json();
}

/**
 * Lists submissions system-wide with search, filter, and pagination.
 */
export async function getAdminSubmissions(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  formSlug?: string;
  formId?: string;
  mrno?: string;
  submittedBy?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}): Promise<AdminSubmissionListResponse> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  if (params.search) query.set('search', params.search);
  if (params.formSlug) query.set('formSlug', params.formSlug);
  if (params.formId) query.set('formId', params.formId);
  if (params.mrno) query.set('mrno', params.mrno);
  if (params.submittedBy) query.set('submittedBy', params.submittedBy);
  if (params.status && params.status !== 'all') query.set('status', params.status);
  if (params.startDate) query.set('startDate', params.startDate);
  if (params.endDate) query.set('endDate', params.endDate);
  if (params.sortBy) query.set('sortBy', params.sortBy);
  if (params.sortOrder) query.set('sortOrder', params.sortOrder);

  const res = await fetch(`${API_BASE}/submissions?${query.toString()}`, {
    method: 'GET',
    headers: getAuthHeaders(),
    credentials: 'include',
  });

  return await res.json();
}

/**
 * Retrieves single submission details and historical schema for viewing/editing.
 */
export async function getAdminSubmissionDetail(submissionId: number | string): Promise<AdminSubmissionDetailResponse> {
  const res = await fetch(`${API_BASE}/submissions/${submissionId}`, {
    method: 'GET',
    headers: getAuthHeaders(),
    credentials: 'include',
  });

  return await res.json();
}

/**
 * Submits an administrative amendment to a clinical submission.
 */
export async function updateAdminSubmission(
  submissionId: number | string,
  payload: {
    formData: Record<string, any>;
    reason: string;
    originalUpdatedAt?: string;
  }
): Promise<{ success: boolean; message?: string; error?: string; code?: string; changedFields?: string[]; diff?: any; currentUpdatedAt?: string }> {
  const res = await fetch(`${API_BASE}/submissions/${submissionId}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  return await res.json();
}

/**
 * Retrieves the full edit history of a submission.
 */
export async function getAdminSubmissionHistory(submissionId: number | string): Promise<AdminSubmissionHistoryResponse> {
  const res = await fetch(`${API_BASE}/submissions/${submissionId}/history`, {
    method: 'GET',
    headers: getAuthHeaders(),
    credentials: 'include',
  });

  return await res.json();
}

/**
 * Lists system-wide activity logs.
 */
export async function getAdminLogs(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  eventType?: string;
  actorType?: string;
  entityType?: string;
  entityId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}): Promise<AdminLogsResponse> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  if (params.search) query.set('search', params.search);
  if (params.eventType && params.eventType !== 'all') query.set('eventType', params.eventType);
  if (params.actorType && params.actorType !== 'all') query.set('actorType', params.actorType);
  if (params.entityType) query.set('entityType', params.entityType);
  if (params.entityId) query.set('entityId', params.entityId);
  if (params.status && params.status !== 'all') query.set('status', params.status);
  if (params.startDate) query.set('startDate', params.startDate);
  if (params.endDate) query.set('endDate', params.endDate);

  const res = await fetch(`${API_BASE}/logs?${query.toString()}`, {
    method: 'GET',
    headers: getAuthHeaders(),
    credentials: 'include',
  });

  return await res.json();
}

/**
 * Retrieves a single activity log detail.
 */
export async function getAdminLogDetail(logId: number | string): Promise<AdminLogDetailResponse> {
  const res = await fetch(`${API_BASE}/logs/${logId}`, {
    method: 'GET',
    headers: getAuthHeaders(),
    credentials: 'include',
  });

  return await res.json();
}

/**
 * Retrieves distinct event types for activity log dropdown filters.
 */
export async function getAdminLogEventTypes(): Promise<{ success: boolean; eventTypes?: string[]; error?: string }> {
  const res = await fetch(`${API_BASE}/logs/event-types`, {
    method: 'GET',
    headers: getAuthHeaders(),
    credentials: 'include',
  });

  return await res.json();
}
