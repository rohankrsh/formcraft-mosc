import * as patientService from '../services/patientService.js';
import * as runtimeService from '../services/runtimeService.js';

/**
 * Controller for retrieving patients with filtering and pagination.
 * GET /api/patients
 */
export async function getPatients(req, res) {
  try {
    const { department, departmentId, serviceCenter, serviceCenterId, search, page, limit } = req.query;

    const result = await patientService.getPatients({
      department: department ? String(department).trim() : undefined,
      departmentId: departmentId ? String(departmentId).trim() : undefined,
      serviceCenter: serviceCenter ? String(serviceCenter).trim() : undefined,
      serviceCenterId: serviceCenterId ? String(serviceCenterId).trim() : undefined,
      search: search ? String(search).trim() : undefined,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 25,
    });

    return res.json({
      success: true,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
      patients: result.patients,
    });
  } catch (err) {
    console.error('[PatientController] getPatients error:', err);
    return res.status(500).json({
      success: false,
      error: 'Unable to fetch patient records. Please ensure the database service is reachable.',
      patients: [],
    });
  }
}

/**
 * Controller for retrieving departments for dropdown.
 * GET /api/patients/departments
 */
export async function getDepartments(req, res) {
  try {
    const departments = await patientService.getDepartments();
    return res.json({
      success: true,
      departments,
    });
  } catch (err) {
    console.error('[PatientController] getDepartments error:', err);
    return res.status(500).json({
      success: false,
      error: 'Unable to fetch departments.',
      departments: [],
    });
  }
}

/**
 * Controller for retrieving service centers for dropdown.
 * GET /api/patients/service-centers
 */
export async function getServiceCenters(req, res) {
  try {
    const serviceCenters = await patientService.getServiceCenters();
    return res.json({
      success: true,
      serviceCenters,
    });
  } catch (err) {
    console.error('[PatientController] getServiceCenters error:', err);
    return res.status(500).json({
      success: false,
      error: 'Unable to fetch service centers.',
      serviceCenters: [],
    });
  }
}

/**
 * Controller for retrieving patient form data by form slug and MRNO.
 * Validates form existence, deployment status, and MRNO parameter.
 * GET /api/forms/:slug/patient-data?mrno=159636
 */
export async function getPatientFormData(req, res) {
  const { slug } = req.params;
  const mrno = req.query.mrno;

  if (!mrno || !String(mrno).trim()) {
    return res.status(400).json({
      success: false,
      error: 'MRNO query parameter is required.',
    });
  }

  try {
    // 1. Validate that the form exists and is published/deployed
    const formRecord = await runtimeService.getPublishedFormBySlug(slug);
    if (!formRecord) {
      return res.status(404).json({
        success: false,
        error: `Form "${slug}" not found or not deployed.`,
      });
    }

    // 2. Fetch patient data using bind variable
    const patientData = await patientService.getPatientByMrno(mrno);

    // 3. Return JSON data suitable for form population
    return res.json({
      success: true,
      ...patientData,
      patientData,
    });
  } catch (err) {
    console.error(`[PatientController] getPatientFormData error for slug "${slug}", mrno "${mrno}":`, err.message);
    const status = err.status || 500;
    return res.status(status).json({
      success: false,
      code: err.code || 'PATIENT_DATA_ERROR',
      error: err.message || `Unable to fetch patient data for MRNO ${mrno}.`,
    });
  }
}
