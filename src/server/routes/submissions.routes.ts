import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { submissionService } from '../services/submission.service.js';
import { requireAdminAuth } from '../middleware/auth.middleware.js';
import { logsService } from '../services/logs.service.js';

const router = Router();

// Strict per-IP limiter for the public submission endpoint (10 req/min)
const submitLimits = new Map<string, { count: number; resetAt: number }>();
function submissionRateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
  const now = Date.now();
  const record = submitLimits.get(ip);
  const LIMIT = 10;
  if (record) {
    if (now < record.resetAt) {
      if (record.count >= LIMIT) {
        return res.status(429).json({ error: 'Too Many Requests', message: 'Submission rate limit exceeded. Please wait a minute and try again.' });
      }
      record.count++;
    } else {
      submitLimits.set(ip, { count: 1, resetAt: now + 60000 });
    }
  } else {
    submitLimits.set(ip, { count: 1, resetAt: now + 60000 });
  }
  next();
}

// --- Public: submit lyrics for moderation ---
router.post('/', submissionRateLimiter, async (req, res, next) => {
  try {
    const created = await submissionService.createSubmission({
      ...req.body,
      submitter_ip: req.ip || req.socket.remoteAddress || 'unknown',
    });
    res.status(201).json({
      status: 'success',
      message: 'Thank you! Your lyrics submission is pending moderator review.',
      submission: { ...created, submitter_ip: undefined },
    });
  } catch (err: any) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

// --- Admin: moderation queue ---
router.get('/', requireAdminAuth, async (req, res, next) => {
  try {
    const { status, page, limit, search } = req.query;
    const data = await submissionService.listSubmissions({
      status: status as string,
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 20,
      search: (search as string) || '',
    });
    const counts = await submissionService.countByStatus();
    res.json({ status: 'success', ...data, counts });
  } catch (err) {
    next(err);
  }
});

router.get('/counts', requireAdminAuth, async (req, res, next) => {
  try {
    const counts = await submissionService.countByStatus();
    res.json({ status: 'success', counts });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', requireAdminAuth, async (req, res, next) => {
  try {
    const item = await submissionService.getById(parseInt(req.params.id as string, 10));
    if (!item) return res.status(404).json({ error: `Submission #${req.params.id} not found` });
    res.json({ status: 'success', submission: item });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/approve', requireAdminAuth, async (req, res, next) => {
  try {
    const reviewer = (req as any).user?.username || 'admin';
    const approved = await submissionService.approveSubmission(parseInt(req.params.id as string, 10), reviewer, req.body || {});
    await logsService.recordAudit('SUBMISSION_APPROVED', reviewer, { submissionId: req.params.id, nodeId: approved.node_id, songId: approved.song_id }, req.ip);
    res.json({ status: 'success', message: `Submission #${req.params.id} approved & published`, submission: approved });
  } catch (err: any) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

router.post('/:id/reject', requireAdminAuth, async (req, res, next) => {
  try {
    const reviewer = (req as any).user?.username || 'admin';
    const { reviewNote } = req.body || {};
    const rejected = await submissionService.rejectSubmission(parseInt(req.params.id as string, 10), reviewer, reviewNote || '');
    await logsService.recordAudit('SUBMISSION_REJECTED', reviewer, { submissionId: req.params.id }, req.ip);
    res.json({ status: 'success', message: `Submission #${req.params.id} rejected`, submission: rejected });
  } catch (err: any) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

router.delete('/:id', requireAdminAuth, async (req, res, next) => {
  try {
    await submissionService.deleteSubmission(parseInt(req.params.id as string, 10));
    await logsService.recordAudit('SUBMISSION_DELETED', (req as any).user?.username, { submissionId: req.params.id }, req.ip);
    res.json({ status: 'success', message: `Submission #${req.params.id} deleted` });
  } catch (err) {
    next(err);
  }
});

export default router;
