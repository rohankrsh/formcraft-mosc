import type {
  FormDefinition,
  FormSubmissionRecord,
  PatientFormStateResponse,
} from '../types/schema';

export interface PublishedFormResponse {
  success: boolean;
  form?: {
    id: string;
    slug: string;
    title: string;
    description?: string;
    version: number;
    publishedAt?: string;
    definition: FormDefinition;
  };
  error?: string;
  code?: string;
}

export async function fetchPublishedForm(slug: string): Promise<PublishedFormResponse> {
  const res = await fetch(`/api/runtime/forms/${encodeURIComponent(slug)}`);
  const data = await res.json();
  if (!res.ok) {
    return {
      success: false,
      error: data.error || 'Failed to load form definition.',
      code: data.code || 'HTTP_ERROR',
    };
  }
  return data;
}

export async function fetchRuntimeOptions(slug: string): Promise<Record<string, { label: string; value: string }[]>> {
  const res = await fetch(`/api/runtime/forms/${encodeURIComponent(slug)}/options`);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to load dynamic options.');
  }
  return data.data || {};
}

export async function fetchRuntimeRecord(slug: string, recordId: string | number): Promise<Record<string, any>> {
  const res = await fetch(`/api/runtime/forms/${encodeURIComponent(slug)}/data/${encodeURIComponent(recordId)}`);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch record from database.');
  }
  return data.data || {};
}

/**
 * Feature D & A: Fetches current patient state for the published form.
 */
export async function fetchPatientFormState(
  slug: string,
  mrno: string,
  patientId?: string,
  admissionNumber?: string
): Promise<PatientFormStateResponse> {
  const params = new URLSearchParams();
  if (mrno) params.append('mrno', mrno);
  if (patientId) params.append('patientId', patientId);
  if (admissionNumber) params.append('admissionNumber', admissionNumber);

  const res = await fetch(`/api/runtime/forms/${encodeURIComponent(slug)}/patient-state?${params.toString()}`);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to load patient form state.');
  }
  return data;
}

/**
 * Feature C: Fetches previous submissions for current patient and form.
 */
export async function fetchSubmissionHistory(
  slug: string,
  mrno: string,
  patientId?: string
): Promise<FormSubmissionRecord[]> {
  const params = new URLSearchParams();
  if (mrno) params.append('mrno', mrno);
  if (patientId) params.append('patientId', patientId);

  const res = await fetch(`/api/runtime/forms/${encodeURIComponent(slug)}/submissions?${params.toString()}`);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to load submission history.');
  }
  return data.submissions || [];
}

/**
 * Feature C & 9.D: Fetches one historical submission for read-only viewing.
 */
export async function fetchHistoricalSubmission(
  slug: string,
  submissionId: string | number,
  mrno?: string
): Promise<FormSubmissionRecord> {
  const params = new URLSearchParams();
  if (mrno) params.append('mrno', mrno);

  const res = await fetch(
    `/api/runtime/forms/${encodeURIComponent(slug)}/submissions/${encodeURIComponent(submissionId)}?${params.toString()}`
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to load historical submission.');
  }
  return data.submission;
}

/**
 * Feature E: Mode-aware transactional submission to Oracle Database.
 */
export async function submitFormPersistence(
  slug: string,
  payload: {
    data: Record<string, any>;
    mrno?: string;
    patientId?: string;
    admissionNumber?: string;
    submittedBy?: string;
    isUpdate?: boolean;
    recordId?: string | number | null;
    submissionId?: string | number | null;
  }
): Promise<{
  success: boolean;
  action: 'inserted' | 'updated';
  recordId: string | number;
  submissionId: string | number;
  submittedAt: string;
  updatedAt?: string;
  status: string;
}> {
  const res = await fetch(`/api/runtime/forms/${encodeURIComponent(slug)}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    const err: any = new Error(data.error || 'Failed to submit form data.');
    err.validationErrors = data.validationErrors;
    err.status = res.status;
    throw err;
  }
  return data;
}

export async function submitRuntimeInsert(slug: string, formData: Record<string, any>): Promise<any> {
  const res = await fetch(`/api/runtime/forms/${encodeURIComponent(slug)}/data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: formData }),
  });
  const data = await res.json();
  if (!res.ok) {
    const err: any = new Error(data.error || 'Failed to submit form data.');
    err.validationErrors = data.validationErrors;
    err.status = res.status;
    throw err;
  }
  return data.data;
}

export async function submitRuntimeUpdate(
  slug: string,
  recordId: string | number,
  formData: Record<string, any>
): Promise<any> {
  const res = await fetch(`/api/runtime/forms/${encodeURIComponent(slug)}/data/${encodeURIComponent(recordId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: formData }),
  });
  const data = await res.json();
  if (!res.ok) {
    const err: any = new Error(data.error || 'Failed to update form record.');
    err.validationErrors = data.validationErrors;
    err.status = res.status;
    throw err;
  }
  return data.data;
}

export async function executeRuntimeQueryApi(
  slug: string,
  queryId: string,
  parameters: Record<string, any>
): Promise<{ rawRow: Record<string, any> | null; mappedValues: Record<string, any> }> {
  const res = await fetch(
    `/api/runtime/forms/${encodeURIComponent(slug)}/queries/${encodeURIComponent(queryId)}/execute`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parameters }),
    }
  );
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to execute query.');
  }
  return data;
}
