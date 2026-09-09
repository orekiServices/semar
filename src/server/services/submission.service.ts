import { getDb } from '../db/index.js';
import { lyricsService } from './lyrics.service.js';
import { nodeService } from './node.service.js';
import { isSpecialNode } from './providers/index.js';

export type SubmissionStatus = 'pending' | 'approved' | 'rejected';

export interface LyricsSubmission {
  id: number;
  node_id: string;
  title: string;
  artist: string;
  album?: string;
  youtube_video_id?: string;
  duration?: number;
  plain_lyrics?: string;
  synced_lyrics?: string;
  ttml_lyrics?: string;
  metadata?: any;
  submitter_name?: string;
  submitter_ip?: string;
  status: SubmissionStatus;
  review_note?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  song_id?: number;
  created_at?: string;
  updated_at?: string;
}

// Anti-spam: max submissions per IP per rolling 24h window
const MAX_SUBMISSIONS_PER_IP_PER_DAY = 10;

export class SubmissionService {
  private formatRow(r: any): LyricsSubmission {
    return {
      ...r,
      duration: r.duration !== null && r.duration !== undefined ? Number(r.duration) : undefined,
      song_id: r.song_id !== null && r.song_id !== undefined ? Number(r.song_id) : undefined,
      metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata || '{}') : r.metadata || {},
    };
  }

  async isSubmissionsEnabled(): Promise<boolean> {
    try {
      const db = getDb();
      const row = await db.queryOne<{ value: any }>('SELECT value FROM system_config WHERE key = ?', ['system_settings']);
      if (!row) return true; // default: enabled
      const val = typeof row.value === 'string' ? JSON.parse(row.value || '{}') : row.value;
      if (val && typeof val.allowPublicSubmissions === 'boolean') return val.allowPublicSubmissions;
      return true;
    } catch {
      return true;
    }
  }

  async createSubmission(data: Partial<LyricsSubmission> & { submitter_ip?: string }): Promise<LyricsSubmission> {
    const enabled = await this.isSubmissionsEnabled();
    if (!enabled) {
      const err: any = new Error('Public lyrics submissions are currently disabled by the administrator.');
      err.statusCode = 403;
      throw err;
    }

    const nodeId = (data.node_id || '').toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!nodeId) throw Object.assign(new Error('node_id is required'), { statusCode: 400 });
    if (!data.title || !data.title.trim()) throw Object.assign(new Error('title is required'), { statusCode: 400 });
    if (!data.artist || !data.artist.trim()) throw Object.assign(new Error('artist is required'), { statusCode: 400 });
    if (!data.plain_lyrics?.trim() && !data.synced_lyrics?.trim() && !data.ttml_lyrics?.trim()) {
      throw Object.assign(new Error('At least one lyrics payload (plain_lyrics, synced_lyrics or ttml_lyrics) is required'), { statusCode: 400 });
    }

    if (isSpecialNode(nodeId)) {
      throw Object.assign(new Error(`Cannot submit to special external node "${nodeId}"`), { statusCode: 400 });
    }
    const node = await nodeService.getNode(nodeId);
    if (!node) throw Object.assign(new Error(`Node "${nodeId}" does not exist`), { statusCode: 404 });

    const db = getDb();
    const ip = data.submitter_ip || 'unknown';

    // Spam guard: rolling 24h per-IP cap (space-separated UTC for lexical comparison).
    const oneDayAgo = new Date(Date.now() - 24 * 3600_000).toISOString().slice(0, 19).replace('T', ' ');
    const recent = await db.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM lyrics_submissions WHERE submitter_ip = ? AND created_at >= ?',
      [ip, oneDayAgo]
    );
    // Fallback for TEXT timestamps stored in non-ISO format: count all from this IP today-ish
    const recentCount = recent?.count || 0;
    if (recentCount >= MAX_SUBMISSIONS_PER_IP_PER_DAY) {
      throw Object.assign(new Error(`Submission limit reached: max ${MAX_SUBMISSIONS_PER_IP_PER_DAY} per day per IP`), { statusCode: 429 });
    }

    const metaStr = typeof data.metadata === 'object' ? JSON.stringify(data.metadata) : data.metadata || '{}';
    const res = await db.execute(
      `INSERT INTO lyrics_submissions (node_id, title, artist, album, youtube_video_id, duration, plain_lyrics, synced_lyrics, ttml_lyrics, metadata, submitter_name, submitter_ip, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nodeId,
        data.title.trim(),
        data.artist.trim(),
        data.album || '',
        data.youtube_video_id || '',
        data.duration || 0,
        data.plain_lyrics || '',
        data.synced_lyrics || '',
        data.ttml_lyrics || '',
        metaStr,
        (data.submitter_name || 'Anonymous').slice(0, 128),
        ip,
        'pending',
      ]
    );

    const created = await this.getById(Number(res.insertId));
    return created!;
  }

  async getById(id: number): Promise<LyricsSubmission | null> {
    const db = getDb();
    const row = await db.queryOne<any>('SELECT * FROM lyrics_submissions WHERE id = ?', [id]);
    return row ? this.formatRow(row) : null;
  }

  async listSubmissions(options: { status?: string; page?: number; limit?: number; search?: string } = {}): Promise<{ items: LyricsSubmission[]; total: number }> {
    const db = getDb();
    const page = Math.max(options.page || 1, 1);
    const limit = Math.min(options.limit || 20, 100);
    const offset = (page - 1) * limit;

    const clauses: string[] = [];
    const params: any[] = [];
    if (options.status && ['pending', 'approved', 'rejected'].includes(options.status)) {
      clauses.push('status = ?');
      params.push(options.status);
    }
    if (options.search && options.search.trim()) {
      const s = `%${options.search.trim()}%`;
      clauses.push('(title LIKE ? OR artist LIKE ? OR album LIKE ? OR submitter_name LIKE ?)');
      params.push(s, s, s, s);
    }
    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';

    const countRow = await db.queryOne<{ count: number }>(`SELECT COUNT(*) as count FROM lyrics_submissions ${where}`, params);
    const rows = await db.query<any>(
      `SELECT * FROM lyrics_submissions ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    return { items: rows.map((r) => this.formatRow(r)), total: Number(countRow?.count) || 0 };
  }

  async countByStatus(): Promise<{ pending: number; approved: number; rejected: number; total: number }> {
    const db = getDb();
    const rows = await db.query<{ status: string; count: number }>(
      'SELECT status, COUNT(*) as count FROM lyrics_submissions GROUP BY status'
    );
    const out = { pending: 0, approved: 0, rejected: 0, total: 0 };
    for (const r of rows) {
      const c = Number(r.count) || 0;
      if (r.status === 'pending') out.pending = c;
      else if (r.status === 'approved') out.approved = c;
      else if (r.status === 'rejected') out.rejected = c;
      out.total += c;
    }
    return out;
  }

  /** Approve a submission → inserts the track into the target node partition. */
  async approveSubmission(id: number, reviewer: string, overrides: Partial<LyricsSubmission> = {}): Promise<LyricsSubmission> {
    const submission = await this.getById(id);
    if (!submission) throw Object.assign(new Error(`Submission #${id} not found`), { statusCode: 404 });
    if (submission.status === 'approved') throw Object.assign(new Error('Submission is already approved'), { statusCode: 400 });

    const nodeId = (overrides.node_id || submission.node_id).toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (isSpecialNode(nodeId)) {
      throw Object.assign(new Error(`Cannot publish to special external node "${nodeId}"`), { statusCode: 400 });
    }
    const node = await nodeService.getNode(nodeId);
    if (!node) throw Object.assign(new Error(`Target node "${nodeId}" does not exist`), { statusCode: 404 });

    const saved = await lyricsService.saveLyrics(nodeId, {
      title: overrides.title || submission.title,
      artist: overrides.artist || submission.artist,
      album: overrides.album ?? submission.album,
      youtube_video_id: overrides.youtube_video_id ?? submission.youtube_video_id,
      duration: overrides.duration ?? submission.duration,
      plain_lyrics: overrides.plain_lyrics ?? submission.plain_lyrics,
      synced_lyrics: overrides.synced_lyrics ?? submission.synced_lyrics,
      ttml_lyrics: overrides.ttml_lyrics ?? submission.ttml_lyrics,
      metadata: {
        ...(submission.metadata || {}),
        submitted_by: submission.submitter_name,
        submission_id: submission.id,
      },
    });

    const db = getDb();
    await db.execute(
      `UPDATE lyrics_submissions SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, review_note = ?, song_id = ?, node_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      ['approved', reviewer, overrides.review_note || 'Approved & published to node partition', Number(saved.insertId), nodeId, id]
    );

    return (await this.getById(id))!;
  }

  async rejectSubmission(id: number, reviewer: string, reviewNote: string = ''): Promise<LyricsSubmission> {
    const submission = await this.getById(id);
    if (!submission) throw Object.assign(new Error(`Submission #${id} not found`), { statusCode: 404 });
    if (submission.status === 'rejected') throw Object.assign(new Error('Submission is already rejected'), { statusCode: 400 });

    const db = getDb();
    await db.execute(
      `UPDATE lyrics_submissions SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, review_note = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      ['rejected', reviewer, reviewNote || 'Rejected by moderator', id]
    );
    return (await this.getById(id))!;
  }

  async deleteSubmission(id: number): Promise<boolean> {
    const db = getDb();
    await db.execute('DELETE FROM lyrics_submissions WHERE id = ?', [id]);
    return true;
  }
}

export const submissionService = new SubmissionService();
