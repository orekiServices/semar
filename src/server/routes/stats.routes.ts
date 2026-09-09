import { Router } from 'express';
import { statsService } from '../services/stats.service.js';
import { requireAdminAuth } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/dashboard', requireAdminAuth, async (req, res, next) => {
  try {
    const data = await statsService.getDashboardOverview();
    res.json({ status: 'success', data });
  } catch (err) {
    next(err);
  }
});

export default router;
