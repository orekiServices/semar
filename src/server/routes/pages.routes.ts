import { Router } from 'express';
import { pagesService } from '../services/pages.service.js';
import { requireAdminAuth } from '../middleware/auth.middleware.js';
import { logsService } from '../services/logs.service.js';

const router = Router();

// Public: List pages (published only for non-admin)
router.get('/', async (req, res, next) => {
  try {
    const isPublic = req.query.all !== 'true';
    const pages = await pagesService.listPages(!isPublic);
    res.json({ status: 'success', pages });
  } catch (err) {
    next(err);
  }
});

// Public: Get single page by slug
router.get('/:slug', async (req, res, next) => {
  try {
    const page = await pagesService.getPageBySlug(req.params.slug);
    if (!page) {
      return res.status(404).json({ error: `Page "${req.params.slug}" not found` });
    }
    res.json({ status: 'success', page });
  } catch (err) {
    next(err);
  }
});

// Admin: Save page (create/update)
router.post('/', requireAdminAuth, async (req, res, next) => {
  try {
    const saved = await pagesService.savePage(req.body);
    await logsService.recordAudit('PAGE_SAVED', (req as any).user?.username, { slug: saved.slug, title: saved.title }, req.ip);
    res.json({ status: 'success', page: saved });
  } catch (err) {
    next(err);
  }
});

// Admin: Delete page
router.delete('/:slug', requireAdminAuth, async (req, res, next) => {
  try {
    await pagesService.deletePage(req.params.slug);
    await logsService.recordAudit('PAGE_DELETED', (req as any).user?.username, { slug: req.params.slug }, req.ip);
    res.json({ status: 'success', message: 'Page deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
