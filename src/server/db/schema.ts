import type { DatabaseAdapter } from './adapter.js';

export async function runMigrations(db: DatabaseAdapter): Promise<void> {
  const isPg = db.type === 'postgres';
  const isMysql = db.type === 'mysql';
  const isSqlite = db.type === 'sqlite';

  // Helper type mappings
  const pkAuto = isPg ? 'SERIAL PRIMARY KEY' : isMysql ? 'INT AUTO_INCREMENT PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
  const jsonType = isPg ? 'JSONB' : isMysql ? 'JSON' : 'TEXT';
  const boolType = isPg ? 'BOOLEAN DEFAULT FALSE' : isMysql ? 'BOOLEAN DEFAULT FALSE' : 'INTEGER DEFAULT 0';
  const timestampType = isPg ? 'TIMESTAMPTZ DEFAULT NOW()' : isMysql ? 'DATETIME DEFAULT CURRENT_TIMESTAMP' : 'TEXT DEFAULT CURRENT_TIMESTAMP';
  const textType = isMysql ? 'LONGTEXT' : 'TEXT';

  if (isPg) {
    await db.query(`
      CREATE TABLE IF NOT EXISTS system_config (
        key VARCHAR(128) PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS admin_users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(128) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(64) DEFAULT 'superadmin',
        api_key VARCHAR(128),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        last_login_at TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS nodes (
        node_id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        table_name VARCHAR(128) NOT NULL,
        storage_mode VARCHAR(64) DEFAULT 'isolated_table',
        is_nsfw BOOLEAN DEFAULT FALSE,
        status VARCHAR(64) DEFAULT 'active',
        rate_limit INTEGER DEFAULT 120,
        total_records_approx INTEGER DEFAULT 0,
        about_config JSONB DEFAULT '{}'::jsonb,
        api_config JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS semapi_routes (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        path VARCHAR(255) NOT NULL,
        method VARCHAR(16) NOT NULL,
        enabled BOOLEAN DEFAULT TRUE,
        auth_required BOOLEAN DEFAULT FALSE,
        api_key_header VARCHAR(64) DEFAULT 'X-SemAPI-Key',
        rate_limit_rpm INTEGER DEFAULT 60,
        permissions JSONB DEFAULT '[]'::jsonb,
        request_schema JSONB DEFAULT '{}'::jsonb,
        response_schema JSONB DEFAULT '{}'::jsonb,
        code TEXT NOT NULL,
        default_response JSONB DEFAULT '{"status": "ok"}'::jsonb,
        description TEXT,
        tags JSONB DEFAULT '[]'::jsonb,
        total_calls INTEGER DEFAULT 0,
        last_called_at TIMESTAMPTZ,
        last_status INTEGER,
        error_count INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS semapi_logs (
        id SERIAL PRIMARY KEY,
        route_id VARCHAR(64),
        method VARCHAR(16),
        path VARCHAR(255),
        status_code INTEGER,
        latency_ms INTEGER,
        ip VARCHAR(64),
        request_headers JSONB,
        request_body JSONB,
        response_preview TEXT,
        log_messages JSONB,
        error_message TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS youtube_cache (
        youtube_video_id VARCHAR(64) PRIMARY KEY,
        song_id INTEGER,
        node_id VARCHAR(64),
        title VARCHAR(255),
        artist VARCHAR(255),
        album VARCHAR(255),
        duration INTEGER,
        plain_lyrics TEXT,
        synced_lyrics TEXT,
        ttml_lyrics TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        hit_count INTEGER DEFAULT 1,
        last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        expires_at TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS custom_pages (
        id SERIAL PRIMARY KEY,
        slug VARCHAR(128) UNIQUE NOT NULL,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        is_published BOOLEAN DEFAULT TRUE,
        require_auth BOOLEAN DEFAULT FALSE,
        show_in_navbar BOOLEAN DEFAULT FALSE,
        meta_description TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS api_keys (
        id VARCHAR(64) PRIMARY KEY,
        key_hash VARCHAR(255) NOT NULL,
        key_prefix VARCHAR(16) NOT NULL,
        name VARCHAR(128) NOT NULL,
        permissions JSONB DEFAULT '["read"]'::jsonb,
        node_restrictions JSONB DEFAULT '[]'::jsonb,
        rate_limit_rpm INTEGER DEFAULT 120,
        total_requests INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        last_used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        expires_at TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        event_type VARCHAR(64) NOT NULL,
        actor VARCHAR(128) DEFAULT 'system',
        details JSONB DEFAULT '{}'::jsonb,
        ip VARCHAR(64),
        user_agent TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS system_metrics (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMPTZ DEFAULT NOW(),
        category VARCHAR(64) NOT NULL,
        metric_name VARCHAR(128) NOT NULL,
        value NUMERIC NOT NULL,
        metadata JSONB DEFAULT '{}'::jsonb
      );

      CREATE INDEX IF NOT EXISTS idx_semapi_path ON semapi_routes (path, method);
      CREATE INDEX IF NOT EXISTS idx_youtube_cache_accessed ON youtube_cache (last_accessed_at);
      CREATE INDEX IF NOT EXISTS idx_metrics_cat ON system_metrics (category, timestamp);
    `);

    // v2.1: community lyrics submissions moderation queue
    await db.query(`
      CREATE TABLE IF NOT EXISTS lyrics_submissions (
        id SERIAL PRIMARY KEY,
        node_id VARCHAR(64) NOT NULL,
        title VARCHAR(255) NOT NULL,
        artist VARCHAR(255) NOT NULL,
        album VARCHAR(255),
        youtube_video_id VARCHAR(64),
        duration INTEGER DEFAULT 0,
        plain_lyrics TEXT,
        synced_lyrics TEXT,
        ttml_lyrics TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        submitter_name VARCHAR(128) DEFAULT 'Anonymous',
        submitter_ip VARCHAR(64),
        status VARCHAR(16) DEFAULT 'pending',
        review_note TEXT,
        reviewed_by VARCHAR(128),
        reviewed_at TIMESTAMPTZ,
        song_id INTEGER,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_submissions_status ON lyrics_submissions (status, created_at);
    `);
  } else if (isMysql) {
    await db.query(`
      CREATE TABLE IF NOT EXISTS \`system_config\` (
        \`key\` VARCHAR(128) PRIMARY KEY,
        \`value\` JSON NOT NULL,
        \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS \`admin_users\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`username\` VARCHAR(128) UNIQUE NOT NULL,
        \`password_hash\` VARCHAR(255) NOT NULL,
        \`role\` VARCHAR(64) DEFAULT 'superadmin',
        \`api_key\` VARCHAR(128),
        \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        \`last_login_at\` DATETIME
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS \`nodes\` (
        \`node_id\` VARCHAR(64) PRIMARY KEY,
        \`name\` VARCHAR(255) NOT NULL,
        \`description\` TEXT,
        \`table_name\` VARCHAR(128) NOT NULL,
        \`storage_mode\` VARCHAR(64) DEFAULT 'isolated_table',
        \`is_nsfw\` BOOLEAN DEFAULT FALSE,
        \`status\` VARCHAR(64) DEFAULT 'active',
        \`rate_limit\` INT DEFAULT 120,
        \`total_records_approx\` INT DEFAULT 0,
        \`about_config\` JSON,
        \`api_config\` JSON,
        \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS \`semapi_routes\` (
        \`id\` VARCHAR(64) PRIMARY KEY,
        \`name\` VARCHAR(255) NOT NULL,
        \`path\` VARCHAR(255) NOT NULL,
        \`method\` VARCHAR(16) NOT NULL,
        \`enabled\` BOOLEAN DEFAULT TRUE,
        \`auth_required\` BOOLEAN DEFAULT FALSE,
        \`api_key_header\` VARCHAR(64) DEFAULT 'X-SemAPI-Key',
        \`rate_limit_rpm\` INT DEFAULT 60,
        \`permissions\` JSON,
        \`request_schema\` JSON,
        \`response_schema\` JSON,
        \`code\` LONGTEXT NOT NULL,
        \`default_response\` JSON,
        \`description\` TEXT,
        \`tags\` JSON,
        \`total_calls\` INT DEFAULT 0,
        \`last_called_at\` DATETIME,
        \`last_status\` INT,
        \`error_count\` INT DEFAULT 0,
        \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_semapi_path\` (\`path\`, \`method\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS \`semapi_logs\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`route_id\` VARCHAR(64),
        \`method\` VARCHAR(16),
        \`path\` VARCHAR(255),
        \`status_code\` INT,
        \`latency_ms\` INT,
        \`ip\` VARCHAR(64),
        \`request_headers\` JSON,
        \`request_body\` JSON,
        \`response_preview\` TEXT,
        \`log_messages\` JSON,
        \`error_message\` TEXT,
        \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS \`youtube_cache\` (
        \`youtube_video_id\` VARCHAR(64) PRIMARY KEY,
        \`song_id\` INT,
        \`node_id\` VARCHAR(64),
        \`title\` VARCHAR(255),
        \`artist\` VARCHAR(255),
        \`album\` VARCHAR(255),
        \`duration\` INT,
        \`plain_lyrics\` MEDIUMTEXT,
        \`synced_lyrics\` MEDIUMTEXT,
        \`ttml_lyrics\` MEDIUMTEXT,
        \`metadata\` JSON,
        \`hit_count\` INT DEFAULT 1,
        \`last_accessed_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        \`expires_at\` DATETIME,
        INDEX \`idx_yt_accessed\` (\`last_accessed_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS \`custom_pages\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`slug\` VARCHAR(128) UNIQUE NOT NULL,
        \`title\` VARCHAR(255) NOT NULL,
        \`content\` LONGTEXT NOT NULL,
        \`is_published\` BOOLEAN DEFAULT TRUE,
        \`require_auth\` BOOLEAN DEFAULT FALSE,
        \`show_in_navbar\` BOOLEAN DEFAULT FALSE,
        \`meta_description\` TEXT,
        \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS \`api_keys\` (
        \`id\` VARCHAR(64) PRIMARY KEY,
        \`key_hash\` VARCHAR(255) NOT NULL,
        \`key_prefix\` VARCHAR(16) NOT NULL,
        \`name\` VARCHAR(128) NOT NULL,
        \`permissions\` JSON,
        \`node_restrictions\` JSON,
        \`rate_limit_rpm\` INT DEFAULT 120,
        \`total_requests\` INT DEFAULT 0,
        \`is_active\` BOOLEAN DEFAULT TRUE,
        \`last_used_at\` DATETIME,
        \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        \`expires_at\` DATETIME
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS \`audit_logs\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`event_type\` VARCHAR(64) NOT NULL,
        \`actor\` VARCHAR(128) DEFAULT 'system',
        \`details\` JSON,
        \`ip\` VARCHAR(64),
        \`user_agent\` TEXT,
        \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS \`system_metrics\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`timestamp\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        \`category\` VARCHAR(64) NOT NULL,
        \`metric_name\` VARCHAR(128) NOT NULL,
        \`value\` DOUBLE NOT NULL,
        \`metadata\` JSON
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    // v2.1: community lyrics submissions moderation queue
    await db.query(`
      CREATE TABLE IF NOT EXISTS \`lyrics_submissions\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`node_id\` VARCHAR(64) NOT NULL,
        \`title\` VARCHAR(255) NOT NULL,
        \`artist\` VARCHAR(255) NOT NULL,
        \`album\` VARCHAR(255),
        \`youtube_video_id\` VARCHAR(64),
        \`duration\` INT DEFAULT 0,
        \`plain_lyrics\` MEDIUMTEXT,
        \`synced_lyrics\` MEDIUMTEXT,
        \`ttml_lyrics\` MEDIUMTEXT,
        \`metadata\` JSON,
        \`submitter_name\` VARCHAR(128) DEFAULT 'Anonymous',
        \`submitter_ip\` VARCHAR(64),
        \`status\` VARCHAR(16) DEFAULT 'pending',
        \`review_note\` TEXT,
        \`reviewed_by\` VARCHAR(128),
        \`reviewed_at\` DATETIME,
        \`song_id\` INT,
        \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_submissions_status\` (\`status\`, \`created_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  } else {
    // SQLite
    await db.query(`
      CREATE TABLE IF NOT EXISTS system_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS admin_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'superadmin',
        api_key TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        last_login_at TEXT
      );

      CREATE TABLE IF NOT EXISTS nodes (
        node_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        table_name TEXT NOT NULL,
        storage_mode TEXT DEFAULT 'isolated_table',
        is_nsfw INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active',
        rate_limit INTEGER DEFAULT 120,
        total_records_approx INTEGER DEFAULT 0,
        about_config TEXT DEFAULT '{}',
        api_config TEXT DEFAULT '{}',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS semapi_routes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT NOT NULL,
        method TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        auth_required INTEGER DEFAULT 0,
        api_key_header TEXT DEFAULT 'X-SemAPI-Key',
        rate_limit_rpm INTEGER DEFAULT 60,
        permissions TEXT DEFAULT '[]',
        request_schema TEXT DEFAULT '{}',
        response_schema TEXT DEFAULT '{}',
        code TEXT NOT NULL,
        default_response TEXT DEFAULT '{"status": "ok"}',
        description TEXT,
        tags TEXT DEFAULT '[]',
        total_calls INTEGER DEFAULT 0,
        last_called_at TEXT,
        last_status INTEGER,
        error_count INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS semapi_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        route_id TEXT,
        method TEXT,
        path TEXT,
        status_code INTEGER,
        latency_ms INTEGER,
        ip TEXT,
        request_headers TEXT,
        request_body TEXT,
        response_preview TEXT,
        log_messages TEXT,
        error_message TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS youtube_cache (
        youtube_video_id TEXT PRIMARY KEY,
        song_id INTEGER,
        node_id TEXT,
        title TEXT,
        artist TEXT,
        album TEXT,
        duration INTEGER,
        plain_lyrics TEXT,
        synced_lyrics TEXT,
        ttml_lyrics TEXT,
        metadata TEXT DEFAULT '{}',
        hit_count INTEGER DEFAULT 1,
        last_accessed_at TEXT DEFAULT CURRENT_TIMESTAMP,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        expires_at TEXT
      );

      CREATE TABLE IF NOT EXISTS custom_pages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        is_published INTEGER DEFAULT 1,
        require_auth INTEGER DEFAULT 0,
        show_in_navbar INTEGER DEFAULT 0,
        meta_description TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS api_keys (
        id TEXT PRIMARY KEY,
        key_hash TEXT NOT NULL,
        key_prefix TEXT NOT NULL,
        name TEXT NOT NULL,
        permissions TEXT DEFAULT '["read"]',
        node_restrictions TEXT DEFAULT '[]',
        rate_limit_rpm INTEGER DEFAULT 120,
        total_requests INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        last_used_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        expires_at TEXT
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT NOT NULL,
        actor TEXT DEFAULT 'system',
        details TEXT DEFAULT '{}',
        ip TEXT,
        user_agent TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS system_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        category TEXT NOT NULL,
        metric_name TEXT NOT NULL,
        value REAL NOT NULL,
        metadata TEXT DEFAULT '{}'
      );

      CREATE INDEX IF NOT EXISTS idx_semapi_path ON semapi_routes (path, method);
      CREATE INDEX IF NOT EXISTS idx_youtube_cache_accessed ON youtube_cache (last_accessed_at);
      CREATE INDEX IF NOT EXISTS idx_metrics_cat ON system_metrics (category, timestamp);

      -- v2.1: community lyrics submissions moderation queue
      CREATE TABLE IF NOT EXISTS lyrics_submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        node_id TEXT NOT NULL,
        title TEXT NOT NULL,
        artist TEXT NOT NULL,
        album TEXT,
        youtube_video_id TEXT,
        duration INTEGER DEFAULT 0,
        plain_lyrics TEXT,
        synced_lyrics TEXT,
        ttml_lyrics TEXT,
        metadata TEXT DEFAULT '{}',
        submitter_name TEXT DEFAULT 'Anonymous',
        submitter_ip TEXT,
        status TEXT DEFAULT 'pending',
        review_note TEXT,
        reviewed_by TEXT,
        reviewed_at TEXT,
        song_id INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_submissions_status ON lyrics_submissions (status, created_at);
    `);
  }

  // Safe incremental column migration: ensure ttml_lyrics column exists on youtube_cache & node tables
  try {
    if (isPg) {
      await db.query(`ALTER TABLE youtube_cache ADD COLUMN IF NOT EXISTS ttml_lyrics TEXT;`);
    } else if (isMysql) {
      try {
        await db.query(`ALTER TABLE \`youtube_cache\` ADD COLUMN \`ttml_lyrics\` MEDIUMTEXT;`);
      } catch {}
    } else {
      // SQLite
      try {
        await db.query(`ALTER TABLE youtube_cache ADD COLUMN ttml_lyrics TEXT;`);
      } catch {}
    }
  } catch {}
}
