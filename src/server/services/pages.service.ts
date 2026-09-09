import { getDb } from '../db/index.js';

export interface CustomPageRecord {
  id: number;
  slug: string;
  title: string;
  content: string;
  is_published: boolean;
  require_auth: boolean;
  show_in_navbar: boolean;
  meta_description?: string;
  created_at?: string;
  updated_at?: string;
}

export class PagesService {
  async listPages(includeDrafts: boolean = true): Promise<CustomPageRecord[]> {
    const db = getDb();
    let sql = 'SELECT * FROM custom_pages';
    if (!includeDrafts) {
      sql += ' WHERE is_published = true';
    }
    sql += ' ORDER BY title ASC';
    const rows = await db.query<any>(sql);
    return rows.map((r) => ({
      ...r,
      is_published: Boolean(r.is_published),
      require_auth: Boolean(r.require_auth),
      show_in_navbar: Boolean(r.show_in_navbar),
    }));
  }

  async getPageBySlug(slug: string): Promise<CustomPageRecord | null> {
    const db = getDb();
    const row = await db.queryOne<any>('SELECT * FROM custom_pages WHERE slug = ?', [slug]);
    if (!row) return null;
    return {
      ...row,
      is_published: Boolean(row.is_published),
      require_auth: Boolean(row.require_auth),
      show_in_navbar: Boolean(row.show_in_navbar),
    };
  }

  async savePage(data: Partial<CustomPageRecord>): Promise<CustomPageRecord> {
    const db = getDb();
    const slug = (data.slug || '').toLowerCase().replace(/[^a-z0-9_-]/g, '');

    const existing = await this.getPageBySlug(slug);
    if (existing) {
      await db.execute(
        `UPDATE custom_pages 
         SET title = ?, content = ?, is_published = ?, require_auth = ?, show_in_navbar = ?, meta_description = ?, updated_at = CURRENT_TIMESTAMP
         WHERE slug = ?`,
        [
          data.title || existing.title,
          data.content || existing.content,
          data.is_published !== undefined ? Boolean(data.is_published) : Boolean(existing.is_published),
          data.require_auth !== undefined ? Boolean(data.require_auth) : Boolean(existing.require_auth),
          data.show_in_navbar !== undefined ? Boolean(data.show_in_navbar) : Boolean(existing.show_in_navbar),
          data.meta_description || existing.meta_description || '',
          slug,
        ]
      );
    } else {
      await db.execute(
        `INSERT INTO custom_pages (slug, title, content, is_published, require_auth, show_in_navbar, meta_description)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          slug,
          data.title || 'Untitled Page',
          data.content || '# New Page\n\nContent here...',
          data.is_published !== false,
          Boolean(data.require_auth),
          Boolean(data.show_in_navbar),
          data.meta_description || '',
        ]
      );
    }

    return (await this.getPageBySlug(slug))!;
  }

  async deletePage(slug: string): Promise<boolean> {
    const db = getDb();
    await db.execute('DELETE FROM custom_pages WHERE slug = ?', [slug]);
    return true;
  }
}

export const pagesService = new PagesService();
