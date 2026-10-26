import { Router } from 'express';
import { login, getMe, logout, register, getDashboardStats } from '../controllers/admin.controller.js';
import {
  listSubmissions,
  getSubmission,
  updateSubmission,
  getSubmissionHistory,
} from '../controllers/adminSubmission.controller.js';
import {
  listLogs,
  getLogDetail,
  getEventTypes,
} from '../controllers/adminLogs.controller.js';
import { requireAdminAuth } from '../middleware/adminAuth.js';

const router = Router();

// Public Authentication endpoints
router.post('/login', login);
router.post('/logout', logout);

// Protected Admin Session & Metrics endpoints
router.get('/me', requireAdminAuth, getMe);
router.get('/stats', requireAdminAuth, getDashboardStats);
router.post('/register', requireAdminAuth, register);

// Module 1: Form Submissions Management endpoints (All protected by requireAdminAuth)
router.get('/submissions', requireAdminAuth, listSubmissions);
router.get('/submissions/:submissionId', requireAdminAuth, getSubmission);
router.put('/submissions/:submissionId', requireAdminAuth, updateSubmission);
router.get('/submissions/:submissionId/history', requireAdminAuth, getSubmissionHistory);

// Module 2: System Activity Logs endpoints (All protected by requireAdminAuth)
router.get('/logs', requireAdminAuth, listLogs);
router.get('/logs/event-types', requireAdminAuth, getEventTypes);
router.get('/logs/:logId', requireAdminAuth, getLogDetail);

export default router;
