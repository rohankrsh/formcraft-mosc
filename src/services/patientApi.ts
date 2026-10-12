/**
 * Patient and Deployed Form API Services
 */

export interface Patient {
  mrno: string;
  patientName: string;
  admissionDate: string;
  bedNo: string;
  admissionNumber: string;
  age: string;
  gender: string;
  consultant: string;
  departmentName: string;
  serviceCenter: string;
  mobileNo: string;
  departmentId?: string;
  serviceCenterId?: string;
}

export interface Department {
  departmentId: string;
  departmentName: string;
}

export interface ServiceCenter {
  serviceCenterId: string;
  serviceCenterName: string;
}

export interface DeployedForm {
  id: string;
  title: string;
  slug?: string;
  publishedVersion?: number;
  version?: number;
  runtimeUrl: string;
  fullUrl?: string;
  publishedAt?: string;
  departmentId?: string | null;
  departmentName?: string | null;
  serviceCenterId?: string | null;
  serviceCenterName?: string | null;
}

export interface PatientQueryParams {
  department?: string;
  departmentId?: string;
  serviceCenter?: string;
  serviceCenterId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface PatientsResponse {
  success: boolean;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  patients: Patient[];
  error?: string;
}

/**
 * Fetches patients from Oracle Database with optional department, service center, search, and pagination.
 */
export async function fetchPatients(params: PatientQueryParams = {}): Promise<PatientsResponse> {
  const searchParams = new URLSearchParams();

  if (params.department && params.department !== 'all') {
    searchParams.set('department', params.department);
  } else if (params.departmentId && params.departmentId !== 'all') {
    searchParams.set('departmentId', params.departmentId);
  }

  if (params.serviceCenter && params.serviceCenter !== 'all') {
    searchParams.set('serviceCenter', params.serviceCenter);
  } else if (params.serviceCenterId && params.serviceCenterId !== 'all') {
    searchParams.set('serviceCenterId', params.serviceCenterId);
  }
  if (params.search && params.search.trim() !== '') {
    searchParams.set('search', params.search.trim());
  }
  if (params.page) {
    searchParams.set('page', String(params.page));
  }
  if (params.limit) {
    searchParams.set('limit', String(params.limit));
  }

  const queryStr = searchParams.toString();
  const url = queryStr ? `/api/patients?${queryStr}` : '/api/patients';

  const res = await fetch(url);
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Failed to fetch patients (HTTP ${res.status})`);
  }

  return res.json();
}

/**
 * Fetches available departments for dropdown filter.
 */
export async function fetchDepartments(): Promise<Department[]> {
  const res = await fetch('/api/patients/departments');
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to fetch departments');
  }
  const data = await res.json();
  return data.departments || [];
}

/**
 * Fetches available service centers for dropdown filter.
 */
export async function fetchServiceCenters(): Promise<ServiceCenter[]> {
  const res = await fetch('/api/patients/service-centers');
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to fetch service centers');
  }
  const data = await res.json();
  return data.serviceCenters || [];
}

/**
 * Fetches currently deployed/published forms with optional department and service center filtering.
 */
export async function fetchDeployedForms(params?: {
  department?: string;
  serviceCenter?: string;
}): Promise<DeployedForm[]> {
  const searchParams = new URLSearchParams();
  if (params?.department && params.department.toLowerCase() !== 'all') {
    searchParams.set('department', params.department);
  }
  if (params?.serviceCenter && params.serviceCenter.toLowerCase() !== 'all') {
    searchParams.set('serviceCenter', params.serviceCenter);
  }
  const queryStr = searchParams.toString();
  const url = queryStr ? `/api/deployed-forms?${queryStr}` : '/api/deployed-forms';

  const res = await fetch(url);
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to fetch deployed forms');
  }
  const data = await res.json();
  return data.forms || data.data || [];
}
