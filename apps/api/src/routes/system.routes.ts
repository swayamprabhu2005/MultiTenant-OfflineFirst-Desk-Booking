import { Router, Request, Response } from 'express';
import { SystemService } from '../services/system.service';

const router = Router();

// GET complete software stack and runtime versions manifest
router.get('/versions', async (_req: Request, res: Response) => {
  try {
    const manifest = await SystemService.getSystemManifest();
    return res.json(manifest);
  } catch (error: any) {
    console.error('Failed to get system versions:', error);
    return res.status(500).json({ error: error.message || 'Failed to inspect system versions' });
  }
});

// GET formatted text version summary
router.get('/info-text', async (_req: Request, res: Response) => {
  try {
    const m = await SystemService.getSystemManifest();
    const text = SystemService.formatManifestAsText(m);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.send(text);
  } catch (error: any) {
    return res.status(500).send(`Error getting system versions: ${error.message}`);
  }
});

// GET downloadable diagnostic text report
router.get('/download-report', async (_req: Request, res: Response) => {
  try {
    const manifest = await SystemService.getSystemManifest();
    const text = SystemService.formatManifestAsText(manifest);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="system-diagnostics.txt"');
    return res.send(text);
  } catch (error: any) {
    return res.status(500).send(`Error generating diagnostics report: ${error.message}`);
  }
});

export default router;
