import { getDb } from '../db/index.js';

export interface AuditLogItem {
  id: number;
  event_type: string;
  actor: string;
  details: any;
  ip: string;
  user_agent?: string;
  created_at: string;
}

export class LogsService {
  async listAuditLogs(limit: number = 100, eventType?: string): Promise<AuditLogItem[]> {
    const db = getDb();
    let sql = 'SELECT * FROM audit_logs';
    const params: any[] = [];

    if (eventType) {
      sql += ' WHERE event_type = ?';
      params.push(eventType);
    }

    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const rows = await db.query<any>(sql, params);
    return rows.map((r) => ({
      ...r,
      details: typeof r.details === 'string' ? JSON.parse(r.details || '{}') : r.details || {},
    }));
  }

  async recordAudit(eventType: string, actor: string = 'system', details: any = {}, ip: string = '127.0.0.1', userAgent?: string) {
    const db = getDb();
    const detailsStr = typeof details === 'object' ? JSON.stringify(details) : details || '{}';
    await db.execute(
      'INSERT INTO audit_logs (event_type, actor, details, ip, user_agent) VALUES (?, ?, ?, ?, ?)',
      [eventType, actor, detailsStr, ip, userAgent || '']
    );
  }

  async clearAuditLogs(): Promise<number> {
    const db = getDb();
    const res = await db.execute('DELETE FROM audit_logs');
    return res.rowsAffected;
  }
}

export const logsService = new LogsService();
