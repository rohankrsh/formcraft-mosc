import express from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import * as dbController from '../controllers/database.controller.js';

const router = express.Router();

// Enforce authentication on all database metadata routes
router.use(requireAuth);

router.get('/tables', dbController.getTables);
router.get('/tables/:tableName/columns', dbController.getColumns);
router.get('/tables/:tableName/primary-key', dbController.getPrimaryKey);
router.get('/tables/:tableName/relationships', dbController.getRelationships);
router.post('/queries/preview', dbController.previewQuery);

export default router;
