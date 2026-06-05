import dotenv from 'dotenv';
dotenv.config();

/**
 * Parse database configurations from environment variables.
 */
function parseDatabaseConfigs() {
  const databases = [];

  // Parse DATABASE_URL format (single connection)
  if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);
    let type = url.protocol.replace(':', '');
    if (type === 'postgres') type = 'postgresql';

    databases.push({
      type,
      host: url.hostname,
      port: parseInt(url.port) || getDefaultPort(type),
      database: url.pathname.slice(1),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      ssl: url.searchParams.get('ssl') === 'true',
    });
  }

  // Parse individual DB configs (DB_1_*, DB_2_*, etc.)
  for (let i = 1; i <= 10; i++) {
    const prefix = `DB_${i}_`;
    const type = process.env[`${prefix}TYPE`];
    if (!type) break;

    databases.push({
      type: type.toLowerCase(),
      host: process.env[`${prefix}HOST`] || 'localhost',
      port: parseInt(process.env[`${prefix}PORT`] || String(getDefaultPort(type))),
      database: process.env[`${prefix}DATABASE`] || process.env[`${prefix}PATH`] || '',
      user: process.env[`${prefix}USER`] || '',
      password: process.env[`${prefix}PASSWORD`] || '',
      ssl: process.env[`${prefix}SSL`] === 'true',
      options: process.env[`${prefix}OPTIONS`] ? JSON.parse(process.env[`${prefix}OPTIONS`]) : undefined,
    });
  }

  return databases;
}

function getDefaultPort(type) {
  const ports = {
    postgresql: 5432, postgres: 5432, pg: 5432,
    mysql: 3306, mariadb: 3306,
    sqlserver: 1433, mssql: 1433,
    mongodb: 27017, mongo: 27017,
    sqlite: 0, sqlite3: 0,
    csv: 0,
  };
  return ports[type.toLowerCase()] || 0;
}

export function getConfig() {
  const args = process.argv.slice(2);
  let transport = 'sse';

  const transportIdx = args.indexOf('--transport');
  if (transportIdx !== -1 && args[transportIdx + 1]) {
    transport = args[transportIdx + 1];
  }
  if (process.env.MCP_TRANSPORT) {
    transport = process.env.MCP_TRANSPORT;
  }

  return {
    transport,
    port: parseInt(process.env.MCP_PORT || '3100'),
    databases: parseDatabaseConfigs(),
  };
}
