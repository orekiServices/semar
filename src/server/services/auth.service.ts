import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'semar_jwt_super_secret_key_change_in_prod';

export interface AdminUser {
  id: number;
  username: string;
  role: string;
  api_key?: string;
  created_at?: string;
  last_login_at?: string;
}

export interface ApiKeyItem {
  id: string;
  key_prefix: string;
  name: string;
  permissions: string[];
  node_restrictions: string[];
  rate_limit_rpm: number;
  total_requests: number;
  is_active: boolean;
  last_used_at?: string;
  created_at?: string;
}

export class AuthService {
  async authenticateAdmin(username: string, passwordPlain: string): Promise<{ user: AdminUser; token: string } | null> {
    const db = getDb();
    const user = await db.queryOne<any>('SELECT * FROM admin_users WHERE username = ?', [username]);
    if (!user) return null;

    const match = await bcrypt.compare(passwordPlain, user.password_hash);
    if (!match) return null;

    // Update last login (v2.2: admin_users is keyed by username)
    await db.execute('UPDATE admin_users SET last_login_at = CURRENT_TIMESTAMP WHERE username = ?', [user.username]);

    const token = jwt.sign(
      { username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return {
      user: {
        id: 0,
        username: user.username,
        role: user.role,
        api_key: user.api_key,
        created_at: user.created_at,
        last_login_at: user.last_login_at,
      },
      token,
    };
  }

  verifyToken(token: string): any {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch {
      return null;
    }
  }

  async getAdminCount(): Promise<number> {
    const db = getDb();
    const res = await db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM admin_users');
    return Number(res?.count) || 0;
  }

  async createAdminUser(username: string, passwordPlain: string, role: string = 'superadmin'): Promise<AdminUser> {
    const db = getDb();
    const hash = await bcrypt.hash(passwordPlain, 10);
    const masterApiKey = 'semar_adm_' + uuidv4().replace(/-/g, '');

    const res = await db.execute(
      'INSERT INTO admin_users (username, password_hash, role, api_key) VALUES (?, ?, ?, ?)',
      [username, hash, role, masterApiKey]
    );

    void res;
    return {
      id: 0, // admin_users is keyed by username; kept for shape compat
      username,
      role,
      api_key: masterApiKey,
    };
  }

  async changeAdminPassword(username: string, newPasswordPlain: string): Promise<boolean> {
    const db = getDb();
    const hash = await bcrypt.hash(newPasswordPlain, 10);
    // v2.2: admin_users is keyed by username (no numeric id column)
    const res = await db.execute('UPDATE admin_users SET password_hash = ? WHERE username = ?', [hash, username]);
    return res.rowsAffected > 0;
  }

  // API Key management
  async listApiKeys(): Promise<ApiKeyItem[]> {
    const db = getDb();
    const rows = await db.query<any>('SELECT * FROM api_keys ORDER BY created_at DESC');
    return rows.map((r) => ({
      id: r.id,
      key_prefix: r.key_prefix,
      name: r.name,
      permissions: typeof r.permissions === 'string' ? JSON.parse(r.permissions || '[]') : r.permissions || [],
      node_restrictions: typeof r.node_restrictions === 'string' ? JSON.parse(r.node_restrictions || '[]') : r.node_restrictions || [],
      rate_limit_rpm: Number(r.rate_limit_rpm || 120),
      total_requests: Number(r.total_requests || 0),
      is_active: Boolean(r.is_active),
      last_used_at: r.last_used_at,
      created_at: r.created_at,
    }));
  }

  async generateApiKey(name: string, permissions: string[] = ['read'], nodeRestrictions: string[] = [], rateLimitRpm: number = 120): Promise<{ keyItem: ApiKeyItem; rawKey: string }> {
    const db = getDb();
    const rawKey = 'semar_key_' + uuidv4().replace(/-/g, '');
    const prefix = rawKey.substring(0, 12) + '...';
    const keyHash = await bcrypt.hash(rawKey, 10);
    const id = 'key-' + uuidv4().substring(0, 8);

    await db.execute(
      `INSERT INTO api_keys (id, key_hash, key_prefix, name, permissions, node_restrictions, rate_limit_rpm, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        keyHash,
        prefix,
        name,
        JSON.stringify(permissions),
        JSON.stringify(nodeRestrictions),
        rateLimitRpm,
        true,
      ]
    );

    return {
      keyItem: {
        id,
        key_prefix: prefix,
        name,
        permissions,
        node_restrictions: nodeRestrictions,
        rate_limit_rpm: rateLimitRpm,
        total_requests: 0,
        is_active: true,
      },
      rawKey,
    };
  }

  async validateApiKey(rawKey: string): Promise<ApiKeyItem | null> {
    if (!rawKey) return null;
    const db = getDb();
    const keys = await db.query<any>('SELECT * FROM api_keys WHERE is_active = ?', [true]);

    for (const k of keys) {
      const match = await bcrypt.compare(rawKey, k.key_hash);
      if (match) {
        // Increment usage
        db.execute(
          'UPDATE api_keys SET total_requests = total_requests + 1, last_used_at = CURRENT_TIMESTAMP WHERE id = ?',
          [k.id]
        ).catch(() => {});

        return {
          id: k.id,
          key_prefix: k.key_prefix,
          name: k.name,
          permissions: typeof k.permissions === 'string' ? JSON.parse(k.permissions || '[]') : k.permissions || [],
          node_restrictions: typeof k.node_restrictions === 'string' ? JSON.parse(k.node_restrictions || '[]') : k.node_restrictions || [],
          rate_limit_rpm: Number(k.rate_limit_rpm || 120),
          total_requests: Number(k.total_requests || 0),
          is_active: Boolean(k.is_active),
          last_used_at: k.last_used_at,
          created_at: k.created_at,
        };
      }
    }

    return null;
  }

  async deleteApiKey(id: string): Promise<boolean> {
    const db = getDb();
    await db.execute('DELETE FROM api_keys WHERE id = ?', [id]);
    return true;
  }

  async toggleApiKey(id: string, active: boolean): Promise<boolean> {
    const db = getDb();
    await db.execute('UPDATE api_keys SET is_active = ? WHERE id = ?', [Boolean(active), id]);
    return true;
  }
}

export const authService = new AuthService();
