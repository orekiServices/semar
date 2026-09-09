import { getDb } from '../db/index.js';

export interface NodeRecord {
  node_id: string;
  name: string;
  description?: string;
  table_name: string;
  storage_mode: string;
  is_nsfw: boolean;
  status: string;
  rate_limit: number;
  total_records_approx: number;
  about_config: any;
  api_config: any;
  created_at?: string;
  updated_at?: string;
  real_record_count?: number;
}

export class NodeService {
  async listNodes(): Promise<NodeRecord[]> {
    const db = getDb();
    const nodes = await db.query<any>('SELECT * FROM nodes ORDER BY created_at ASC');
    
    // Enrich with live counts
    const enriched = await Promise.all(
      nodes.map(async (n) => {
        const stats = await db.getNodeTableStats(n.node_id);
        const about = typeof n.about_config === 'string' ? JSON.parse(n.about_config || '{}') : n.about_config;
        const api = typeof n.api_config === 'string' ? JSON.parse(n.api_config || '{}') : n.api_config;
        return {
          ...n,
          is_nsfw: Boolean(n.is_nsfw),
          about_config: about,
          api_config: api,
          real_record_count: stats.rowCount,
        };
      })
    );

    return enriched;
  }

  async getNode(nodeId: string): Promise<NodeRecord | null> {
    const db = getDb();
    const node = await db.queryOne<any>('SELECT * FROM nodes WHERE node_id = ?', [nodeId]);
    if (!node) return null;

    const stats = await db.getNodeTableStats(node.node_id);
    return {
      ...node,
      is_nsfw: Boolean(node.is_nsfw),
      about_config: typeof node.about_config === 'string' ? JSON.parse(node.about_config || '{}') : node.about_config,
      api_config: typeof node.api_config === 'string' ? JSON.parse(node.api_config || '{}') : node.api_config,
      real_record_count: stats.rowCount,
    };
  }

  async createNode(data: Partial<NodeRecord>): Promise<NodeRecord> {
    const db = getDb();
    const nodeId = (data.node_id || '').toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!nodeId) throw new Error('Invalid node_id');

    const existing = await this.getNode(nodeId);
    if (existing) throw new Error(`Node "${nodeId}" already exists`);

    const tableName = `lyrics_${nodeId}`;
    const isSqlite = db.type === 'sqlite';

    // 1. Create isolated storage table
    await db.createNodeTable(nodeId);

    // 2. Register node metadata
    await db.execute(
      `INSERT INTO nodes (node_id, name, description, table_name, storage_mode, is_nsfw, status, rate_limit, total_records_approx, about_config, api_config)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nodeId,
        data.name || `${nodeId.toUpperCase()} Node`,
        data.description || '',
        tableName,
        data.storage_mode || 'isolated_table',
        data.is_nsfw ? (isSqlite ? 1 : true) : (isSqlite ? 0 : false),
        data.status || 'active',
        data.rate_limit || 120,
        data.total_records_approx || 0,
        typeof data.about_config === 'object' ? JSON.stringify(data.about_config) : data.about_config || '{}',
        typeof data.api_config === 'object' ? JSON.stringify(data.api_config) : data.api_config || '{}',
      ]
    );

    return (await this.getNode(nodeId))!;
  }

  async updateNode(nodeId: string, data: Partial<NodeRecord>): Promise<NodeRecord | null> {
    const db = getDb();
    const existing = await this.getNode(nodeId);
    if (!existing) return null;

    const isSqlite = db.type === 'sqlite';
    const name = data.name !== undefined ? data.name : existing.name;
    const description = data.description !== undefined ? data.description : existing.description;
    const isNsfw = data.is_nsfw !== undefined ? (data.is_nsfw ? (isSqlite ? 1 : true) : (isSqlite ? 0 : false)) : (existing.is_nsfw ? (isSqlite ? 1 : true) : (isSqlite ? 0 : false));
    const status = data.status !== undefined ? data.status : existing.status;
    const rateLimit = data.rate_limit !== undefined ? data.rate_limit : existing.rate_limit;
    const totalApprox = data.total_records_approx !== undefined ? data.total_records_approx : existing.total_records_approx;
    const aboutConfig = data.about_config !== undefined ? (typeof data.about_config === 'object' ? JSON.stringify(data.about_config) : data.about_config) : JSON.stringify(existing.about_config);
    const apiConfig = data.api_config !== undefined ? (typeof data.api_config === 'object' ? JSON.stringify(data.api_config) : data.api_config) : JSON.stringify(existing.api_config);

    await db.execute(
      `UPDATE nodes 
       SET name = ?, description = ?, is_nsfw = ?, status = ?, rate_limit = ?, total_records_approx = ?, about_config = ?, api_config = ?, updated_at = CURRENT_TIMESTAMP
       WHERE node_id = ?`,
      [name, description, isNsfw, status, rateLimit, totalApprox, aboutConfig, apiConfig, nodeId]
    );

    return await this.getNode(nodeId);
  }

  async deleteNode(nodeId: string): Promise<boolean> {
    const db = getDb();
    await db.dropNodeTable(nodeId);
    await db.execute('DELETE FROM nodes WHERE node_id = ?', [nodeId]);
    return true;
  }
}

export const nodeService = new NodeService();
