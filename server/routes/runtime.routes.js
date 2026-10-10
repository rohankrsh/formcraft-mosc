import express from 'express';
import * as runtimeController from '../controllers/runtime.controller.js';

const router = express.Router();

// End-user form runtime routes (public or runtime-authenticated)
router.get('/:slug', runtimeController.getPublishedForm);
router.get('/:slug/options', runtimeController.getRuntimeOptions);

// Patient State & Submission History (Features A, C, D)
router.get('/:slug/patient-state', runtimeController.getPatientFormState);
router.get('/:slug/submissions', runtimeController.getSubmissionHistory);
router.get('/:slug/submissions/:submissionId', runtimeController.getHistoricalSubmission);

// Mode-aware Form Submission & Persistence (Feature E)
router.post('/:slug/submit', runtimeController.submitForm);

// Record & Data Routes
router.get('/:slug/record/:id', runtimeController.getHistoricalSubmission);
router.put('/:slug/record/:id', runtimeController.updateRuntimeData);
router.get('/:slug/data/:recordId', runtimeController.getRuntimeRecord);
router.post('/:slug/data', runtimeController.insertRuntimeData);
router.put('/:slug/data/:recordId', runtimeController.updateRuntimeData);

// Dynamic Queries
router.post('/:slug/queries/:queryId/execute', runtimeController.executeRuntimeQuery);

export default router;
