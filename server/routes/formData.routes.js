import express from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import * as formDataController from '../controllers/formData.controller.js';

const router = express.Router();

// Enforce authentication specifically on form data and options operations
router.get('/:formId/options', requireAuth, formDataController.getOptions);
router.get('/:formId/data/:recordId', requireAuth, formDataController.getRecord);
router.post('/:formId/data', requireAuth, formDataController.insertData);
router.put('/:formId/data/:recordId', requireAuth, formDataController.updateData);
router.post('/:formId/queries/:queryId/execute', requireAuth, formDataController.executeFormQuery);

export default router;
