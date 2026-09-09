import { Router } from 'express';
import { authService } from '../services/auth.service.js';
import { requireAdminAuth, type AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { logsService } from '../services/logs.service.js';

const router = Router();

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const authResult = await authService.authenticateAdmin(username, password);
    if (!authResult) {
      await logsService.recordAudit('AUTH_FAILED', username, { reason: 'Invalid credentials' }, req.ip);
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    await logsService.recordAudit('AUTH_SUCCESS', username, { role: authResult.user.role }, req.ip);
    res.json({
      success: true,
      user: authResult.user,
      token: authResult.token,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAdminAuth, async (req: AuthenticatedRequest, res) => {
  res.json({ user: req.user });
});

router.post('/change-password', requireAdminAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const verified = await authService.authenticateAdmin(req.user.username, currentPassword);
    if (!verified) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    await authService.changeAdminPassword(req.user.username, newPassword);
    await logsService.recordAudit('PASSWORD_CHANGED', req.user.username, {}, req.ip);
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    next(err);
  }
});

export default router;
