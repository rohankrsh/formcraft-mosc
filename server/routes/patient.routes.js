import express from 'express';
import * as patientController from '../controllers/patient.controller.js';

const router = express.Router();

router.get('/', patientController.getPatients);
router.get('/departments', patientController.getDepartments);
router.get('/service-centers', patientController.getServiceCenters);

export default router;
