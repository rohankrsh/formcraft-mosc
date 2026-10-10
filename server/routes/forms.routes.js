import express from 'express';
import * as formController from '../controllers/form.controller.js';

const router = express.Router();

// Form authoring and management endpoints
router.get('/', formController.listForms);
router.post('/', formController.saveForm);
router.get('/:formId', formController.getForm);
router.post('/:formId/validate', formController.validateForm);
router.post('/:formId/publish', formController.publishForm);
router.post('/:formId/unpublish', formController.unpublishForm);
router.post('/:formId/archive', formController.archiveForm);
router.post('/:formId/duplicate', formController.duplicateForm);
router.delete('/:formId', formController.deleteForm);
router.get('/:formId/versions', formController.getFormVersions);
router.get('/:formId/versions/:version', formController.getVersionDefinition);

export default router;
