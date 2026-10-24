import express from 'express';
import * as userController from '../controllers/user.controller.js';

const router = express.Router();

// GET /api/users/:userId/staff-details
router.get('/:userId/staff-details', userController.getStaffDetails);

export default router;
