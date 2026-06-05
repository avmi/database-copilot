# Setup Guide

## Prerequisites

- **Node.js** 18+ (recommended: 20 LTS)
- **npm** 9+
- Access to one of the supported databases (PostgreSQL, MySQL, MariaDB, SQL Server, SQLite, MongoDB, or CSV files)

## Installation

```bash
cd mcp
npm install
```

## Configuration

### Option 1: Single Database via DATABASE_URL

The simplest configuration. Set a single `DATABASE_URL` in your `.env` file:

```env
# PostgreSQL
DATABASE_URL=postgresql://username:password@localhost:5432/mydb

# MySQL
DATABASE_URL=mysql://username:password@localhost:3306/mydb
```

### Option 2: Multiple Databases

Configure multiple databases using numbered prefixes:

```env
DB_1_TYPE=postgresql
DB_1_HOST=localhost
DB_1_PORT=5432
DB_1_DATABASE=app_production
DB_1_USER=readonly_user
DB_1_PASSWORD=secret123
DB_1_SSL=false

DB_2_TYPE=mysql
DB_2_HOST=db.example.com
DB_2_PORT=3306
DB_2_DATABASE=analytics
DB_2_USER=reader
DB_2_PASSWORD=secret456
DB_2_SSL=true

DB_3_TYPE=sqlserver
DB_3_HOST=sql.internal
DB_3_PORT=1433
DB_3_DATABASE=warehouse
DB_3_USER=readonly
DB_3_PASSWORD=pass

DB_4_TYPE=sqlite
DB_4_DATABASE=./data/local.db

DB_5_TYPE=mongodb
DB_5_HOST=localhost
DB_5_PORT=27017
DB_5_DATABASE=myapp

DB_6_TYPE=csv
DB_6_DATABASE=./data/reports
```

You can configure up to 10 databases (DB_1 through DB_10).

### Supported Type Values

| Type String | Database | Aliases |
|------------|----------|---------|
| `postgresql` | PostgreSQL | `postgres`, `pg` |
| `mysql` | MySQL | — |
| `mariadb` | MariaDB | — |
| `sqlserver` | SQL Server | `mssql` |
| `sqlite` | SQLite | `sqlite3` |
| `mongodb` | MongoDB | `mongo` |
| `csv` | CSV Files | — |

### Server Configuration

```env
# Transport mode: "stdio" or "sse" (default: sse)
MCP_TRANSPORT=sse

# Port for SSE mode (default: 3100)
MCP_PORT=3100
```

### Transport Modes

| Mode | Use Case | How it works |
|------|----------|--------------|
| **stdio** | VS Code direct integration, Claude Desktop | Communicates via stdin/stdout |
| **sse** | HTTP clients, multiple clients, debugging | Express server with Server-Sent Events |

## Running

```bash
# SSE mode (default)
npm start
# → Server available at http://localhost:3100

# Stdio mode
npm run start:stdio
# → Communicates via stdin/stdout

# Development (with auto-restart, Node 18.11+)
npm run dev        # SSE mode
npm run dev:stdio  # Stdio mode
```

No build step required — runs directly as ES modules.

## Creating a Read-Only Database User (Recommended)

For production databases, create a dedicated read-only user:

### PostgreSQL

```sql
-- Create read-only role
CREATE ROLE mcp_readonly LOGIN PASSWORD 'your_secure_password';

-- Grant connect
GRANT CONNECT ON DATABASE your_db TO mcp_readonly;

-- Grant usage on schemas
GRANT USAGE ON SCHEMA public TO mcp_readonly;

-- Grant select on all tables
GRANT SELECT ON ALL TABLES IN SCHEMA public TO mcp_readonly;

-- Grant select on future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO mcp_readonly;
```

### MySQL

```sql
-- Create read-only user
CREATE USER 'mcp_readonly'@'%' IDENTIFIED BY 'your_secure_password';

-- Grant select on specific database
GRANT SELECT ON your_db.* TO 'mcp_readonly'@'%';

-- Apply
FLUSH PRIVILEGES;
```

## Verifying the Connection

After starting the server, check the health endpoint (SSE mode):

```bash
curl http://localhost:3100/health
# → {"status":"ok","server":"database-copilot","version":"1.0.0"}
```

Or check the logs for connection status:

```
[database-copilot] Connected to postgresql://localhost:5432/mydb
[database-copilot] MCP SSE server running on http://localhost:3100
```

## Troubleshooting

### Connection Refused

- Verify the database host and port are correct
- Check if the database server is running
- Ensure firewall rules allow the connection

### Authentication Failed

- Double-check username and password
- For PostgreSQL, check `pg_hba.conf` authentication rules
- For MySQL, verify the user has access from the connecting host

### SSL Errors

- Set `DB_x_SSL=true` if your database requires SSL
- For self-signed certs, the adapter uses `rejectUnauthorized: false`

### No Tables Shown

- Verify the user has SELECT privileges on the target schema
- For PostgreSQL, ensure `GRANT USAGE ON SCHEMA` is set
- For MySQL, ensure `GRANT SELECT` is applied to the database
