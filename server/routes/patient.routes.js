import express from 'express';
import * as patientController from '../controllers/patient.controller.js';

const router = express.Router();

router.get('/', patientController.getPatients);
router.get('/departments', patientController.getDepartments);
router.get('/service-centers', patientController.getServiceCenters);
router.get('/:mrno/submitted-forms', patientController.getPatientSubmittedForms);
router.get('/:mrno/submitted-forms/:submissionId', patientController.getPatientSubmissionDetail);

export default router;
