# VS Code Integration Guide

This guide covers how to connect the MCP Database Copilot server to Visual Studio Code for use with GitHub Copilot and other AI assistants.

## Quick Reference: `dbType` and Connection Strings

The MCP server supports 7 database types. Use the `DB_x_TYPE` env var (or the protocol part of `DATABASE_URL`) to choose:

| `dbType` value | Database | Aliases | Default Port | Connection String Format |
|----------------|----------|---------|--------------|--------------------------|
| `postgresql` | PostgreSQL | `postgres`, `pg` | 5432 | `postgresql://user:pass@host:5432/dbname` |
| `mysql` | MySQL | — | 3306 | `mysql://user:pass@host:3306/dbname` |
| `mariadb` | MariaDB | — | 3306 | `mariadb://user:pass@host:3306/dbname` |
| `sqlserver` | SQL Server | `mssql` | 1433 | `sqlserver://user:pass@host:1433/dbname` |
| `sqlite` | SQLite | `sqlite3` | n/a | (path to `.db` file) |
| `mongodb` | MongoDB | `mongo` | 27017 | `mongodb://user:pass@host:27017/dbname` |
| `csv` | CSV files | — | n/a | (path to directory of `.csv` files) |

You can configure a database in **two ways**:

1. **Connection String** — Set `DATABASE_URL` (single DB only)
2. **Individual fields** — Set `DB_1_TYPE`, `DB_1_HOST`, `DB_1_PORT`, `DB_1_DATABASE`, `DB_1_USER`, `DB_1_PASSWORD`, `DB_1_SSL` (multi-DB, up to 10)

---

## Sample `.vscode/mcp.json` for Each Database Type

Copy the snippet matching your database into [.vscode/mcp.json](../../.vscode/mcp.json) and replace credentials.

### PostgreSQL

```json
{
  "servers": {
    "database-copilot": {
      "type": "stdio",
      "command": "node",
      "args": ["${workspaceFolder}/mcp/src/index.js", "--transport", "stdio"],
      "env": {
        "DATABASE_URL": "postgresql://myuser:mypassword@localhost:5432/mydb"
      }
    }
  }
}
```

Or with individual fields:

```json
{
  "servers": {
    "database-copilot": {
      "type": "stdio",
      "command": "node",
      "args": ["${workspaceFolder}/mcp/src/index.js", "--transport", "stdio"],
      "env": {
        "DB_1_TYPE": "postgresql",
        "DB_1_HOST": "localhost",
        "DB_1_PORT": "5432",
        "DB_1_DATABASE": "mydb",
        "DB_1_USER": "myuser",
        "DB_1_PASSWORD": "mypassword",
        "DB_1_SSL": "false"
      }
    }
  }
}
```

### MySQL

```json
{
  "servers": {
    "database-copilot": {
      "type": "stdio",
      "command": "node",
      "args": ["${workspaceFolder}/mcp/src/index.js", "--transport", "stdio"],
      "env": {
        "DATABASE_URL": "mysql://myuser:mypassword@localhost:3306/mydb"
      }
    }
  }
}
```

### MariaDB

```json
{
  "servers": {
    "database-copilot": {
      "type": "stdio",
      "command": "node",
      "args": ["${workspaceFolder}/mcp/src/index.js", "--transport", "stdio"],
      "env": {
        "DB_1_TYPE": "mariadb",
        "DB_1_HOST": "localhost",
        "DB_1_PORT": "3306",
        "DB_1_DATABASE": "mydb",
        "DB_1_USER": "myuser",
        "DB_1_PASSWORD": "mypassword"
      }
    }
  }
}
```

### SQL Server

```json
{
  "servers": {
    "database-copilot": {
      "type": "stdio",
      "command": "node",
      "args": ["${workspaceFolder}/mcp/src/index.js", "--transport", "stdio"],
      "env": {
        "DB_1_TYPE": "sqlserver",
        "DB_1_HOST": "localhost",
        "DB_1_PORT": "1433",
        "DB_1_DATABASE": "mydb",
        "DB_1_USER": "sa",
        "DB_1_PASSWORD": "YourStrong!Passw0rd",
        "DB_1_SSL": "false"
      }
    }
  }
}
```

### SQLite

For SQLite, `DB_1_DATABASE` is the **path to the `.db` file** (relative paths resolve from the MCP server's working directory).

```json
{
  "servers": {
    "database-copilot": {
      "type": "stdio",
      "command": "node",
      "args": ["${workspaceFolder}/mcp/src/index.js", "--transport", "stdio"],
      "env": {
        "DB_1_TYPE": "sqlite",
        "DB_1_DATABASE": "${workspaceFolder}/data/myapp.db"
      }
    }
  }
}
```

### MongoDB

```json
{
  "servers": {
    "database-copilot": {
      "type": "stdio",
      "command": "node",
      "args": ["${workspaceFolder}/mcp/src/index.js", "--transport", "stdio"],
      "env": {
        "DB_1_TYPE": "mongodb",
        "DB_1_HOST": "localhost",
        "DB_1_PORT": "27017",
        "DB_1_DATABASE": "mydb",
        "DB_1_USER": "myuser",
        "DB_1_PASSWORD": "mypassword"
      }
    }
  }
}
```

For MongoDB Atlas or full URI control, pass it via `DB_1_OPTIONS`:

```json
{
  "env": {
    "DB_1_TYPE": "mongodb",
    "DB_1_DATABASE": "mydb",
    "DB_1_OPTIONS": "{\"uri\": \"mongodb+srv://user:pass@cluster.mongodb.net/mydb\"}"
  }
}
```

### CSV Files

For CSV, `DB_1_DATABASE` is the **path to a directory** containing `.csv` files. Each file becomes a "table".

```json
{
  "servers": {
    "database-copilot": {
      "type": "stdio",
      "command": "node",
      "args": ["${workspaceFolder}/mcp/src/index.js", "--transport", "stdio"],
      "env": {
        "DB_1_TYPE": "csv",
        "DB_1_DATABASE": "${workspaceFolder}/data/csv-files"
      }
    }
  }
}
```

### Multiple Databases at Once

You can mix any database types in a single configuration. Each connection gets its own `DB_x_*` block (1 through 10):

```json
{
  "servers": {
    "database-copilot": {
      "type": "stdio",
      "command": "node",
      "args": ["${workspaceFolder}/mcp/src/index.js", "--transport", "stdio"],
      "env": {
        "DB_1_TYPE": "postgresql",
        "DB_1_HOST": "localhost",
        "DB_1_PORT": "5432",
        "DB_1_DATABASE": "app_production",
        "DB_1_USER": "readonly",
        "DB_1_PASSWORD": "secret1",

        "DB_2_TYPE": "mysql",
        "DB_2_HOST": "analytics.internal",
        "DB_2_PORT": "3306",
        "DB_2_DATABASE": "warehouse",
        "DB_2_USER": "reader",
        "DB_2_PASSWORD": "secret2",

        "DB_3_TYPE": "mongodb",
        "DB_3_HOST": "localhost",
        "DB_3_PORT": "27017",
        "DB_3_DATABASE": "events",

        "DB_4_TYPE": "sqlite",
        "DB_4_DATABASE": "${workspaceFolder}/data/local.db",

        "DB_5_TYPE": "csv",
        "DB_5_DATABASE": "${workspaceFolder}/data/reports"
      }
    }
  }
}
```

When you have multiple connections, every MCP tool accepts an optional `connectionId` parameter. Use the `list_connections` tool to see available IDs.

---

## Method 1: VS Code MCP Settings (Recommended)

VS Code has native MCP server support. Configure it in your workspace or user settings.

### Step 1: Install Dependencies

```bash
cd mcp
npm install
```

No build step needed — runs as pure JavaScript.

### Step 2: Configure VS Code Settings

Add the MCP server configuration to your VS Code settings. You can do this at the workspace level or user level.

#### Option A: Workspace Settings (`.vscode/settings.json`)

Create or edit `.vscode/settings.json` in your project root:

```json
{
  "mcp": {
    "servers": {
      "database-copilot": {
        "type": "stdio",
        "command": "node",
        "args": ["${workspaceFolder}/mcp/src/index.js", "--transport", "stdio"],
        "env": {
          "DATABASE_URL": "postgresql://username:password@localhost:5432/your_database"
        }
      }
    }
  }
}
```

#### Option B: User Settings (global)

Open VS Code Settings (JSON) via `Ctrl+Shift+P` → "Preferences: Open User Settings (JSON)":

```json
{
  "mcp": {
    "servers": {
      "database-copilot": {
        "type": "stdio",
        "command": "node",
        "args": ["C:/path/to/mcp/src/index.js", "--transport", "stdio"],
        "env": {
          "DATABASE_URL": "postgresql://username:password@localhost:5432/your_database"
        }
      }
    }
  }
}
```

#### Option C: Multiple Databases

```json
{
  "mcp": {
    "servers": {
      "database-copilot": {
        "type": "stdio",
        "command": "node",
        "args": ["${workspaceFolder}/mcp/src/index.js", "--transport", "stdio"],
        "env": {
          "DB_1_TYPE": "postgresql",
          "DB_1_HOST": "localhost",
          "DB_1_PORT": "5432",
          "DB_1_DATABASE": "app_db",
          "DB_1_USER": "readonly",
          "DB_1_PASSWORD": "password",
          "DB_2_TYPE": "mysql",
          "DB_2_HOST": "localhost",
          "DB_2_PORT": "3306",
          "DB_2_DATABASE": "analytics",
          "DB_2_USER": "reader",
          "DB_2_PASSWORD": "password"
        }
      }
    }
  }
}
```

### Step 3: Restart VS Code

After saving the settings, restart VS Code or reload the window (`Ctrl+Shift+P` → "Developer: Reload Window").

### Step 4: Verify Connection

1. Open GitHub Copilot Chat (`Ctrl+Shift+I`)
2. Type: "List all database tables"
3. Copilot should use the `list_tables` tool and return your actual tables

---

## Method 2: MCP Configuration File (`.vscode/mcp.json`)

VS Code also supports a dedicated MCP configuration file:

### Create `.vscode/mcp.json`

```json
{
  "servers": {
    "database-copilot": {
      "type": "stdio",
      "command": "node",
      "args": ["${workspaceFolder}/mcp/src/index.js", "--transport", "stdio"],
      "env": {
        "DATABASE_URL": "postgresql://username:password@localhost:5432/your_database"
      }
    }
  }
}
```

This file is automatically detected by VS Code.

---

## Method 3: SSE Transport (Remote/Shared Server)

Use SSE transport when you want to run the server separately (e.g., on a shared machine or in Docker).

### Step 1: Start the Server

```bash
cd mcp
npm start
# Server runs at http://localhost:3100
```

### Step 2: Configure VS Code

In `.vscode/mcp.json` or settings:

```json
{
  "servers": {
    "database-copilot": {
      "type": "sse",
      "url": "http://localhost:3100/sse"
    }
  }
}
```

---

## Method 4: Claude Desktop Integration

If you use Claude Desktop alongside VS Code:

### Edit Claude Desktop Config

Location: `%APPDATA%\Claude\claude_desktop_config.json` (Windows)

```json
{
  "mcpServers": {
    "database-copilot": {
      "command": "node",
      "args": ["C:\\path\\to\\mcp\\src\\index.js", "--transport", "stdio"],
      "env": {
        "DATABASE_URL": "postgresql://username:password@localhost:5432/your_database"
      }
    }
  }
}
```

---

## Usage Examples

Once connected, open GitHub Copilot Chat in VS Code (`Ctrl+Alt+I`) and switch to **Agent mode** so it can call MCP tools.

### How Chat → MCP Tools Mapping Works

When you ask Copilot a question, it selects the most appropriate tool from the MCP server, calls it with the right arguments, and uses the response to compose its answer. You don't need to know the tool names — just ask in plain English.

### Sample Prompts by Category

#### 1. Schema Exploration

| Ask Copilot | Tool Used | Response Format |
|-------------|-----------|-----------------|
| "What tables are in my database?" | `list_tables` | List with row counts and icons (📊 table, 📋 view, 📁 collection) |
| "Describe the users table" | `describe_table` | Column list with types, PK/FK flags, defaults |
| "Tell me everything about the orders table" | `full_table_info` | Columns + foreign keys + indexes |
| "What schemas are available?" | `list_schemas` | List of all non-system schemas |
| "Search for any column called 'email'" | `search_schema` | All `schema.table.column` matches |
| "Show me the ER diagram" | `schema_overview` | Tables, relationships, and a Mermaid diagram |

#### 2. Relationship Understanding

| Ask Copilot | Tool Used | Response Format |
|-------------|-----------|-----------------|
| "How are users and orders related?" | `get_relationships` | Source → target column with ON DELETE/UPDATE rules |
| "What tables reference the products table?" | `get_relationships` | Reverse FK lookup |
| "Show the full schema as an ER diagram" | `schema_overview` | Mermaid `erDiagram` block (renders in VS Code preview) |

#### 3. Query Writing (Most Powerful)

This is where the MCP server shines — Copilot reads your **actual schema** before writing a query, so column names, joins, and types are always correct.

| Ask Copilot | Tool Sequence | What Happens |
|-------------|---------------|--------------|
| "Get all users who signed up in the last 30 days" | `suggest_query` → SQL | Copilot inspects the `users` table, sees a `created_at` column, writes the WHERE clause correctly |
| "Find the top 10 products by total revenue" | `suggest_query` → `execute_query` | Reads products + order_items schema, writes JOIN + GROUP BY, runs it |
| "Get users who have never placed an order" | `execute_query` | Writes `LEFT JOIN orders WHERE orders.id IS NULL` |
| "How many orders were placed each day this month?" | `execute_query` | Writes GROUP BY date_trunc query, returns results |

#### 4. Data Exploration

| Ask Copilot | Tool Used | Response Format |
|-------------|-----------|-----------------|
| "Show me 5 sample rows from the users table" | `sample_data` | JSON-formatted sample rows |
| "What does the data in events look like?" | `sample_data` | First N documents (great for MongoDB) |
| "Preview the customers.csv file" | `sample_data` | First rows from the CSV |

#### 5. Performance & Optimization

| Ask Copilot | Tool Used | Response Format |
|-------------|-----------|-----------------|
| "Show indexes on the orders table" | `get_indexes` | Index names, columns, uniqueness, type |
| "Explain this query: SELECT * FROM users WHERE email = 'x'" | `explain_query` | Execution plan with estimated cost and rows |
| "What indexes should I add to the orders table?" | `suggest_indexes` | Ready-to-run `CREATE INDEX` statements |
| "Why is this query slow?" | `explain_query` + `get_indexes` | Plan + index list, Copilot suggests improvements |

### End-to-End Example Conversation

This shows a real interaction with multiple tool calls chained together:

```
You: What's in this database?

Copilot: [calls list_tables]
I see 8 tables in your database:
  📊 public.users (~12,450 rows)
  📊 public.orders (~89,231 rows)
  📊 public.order_items (~245,810 rows)
  📊 public.products (~1,205 rows)
  📊 public.categories (~24 rows)
  📊 public.addresses (~15,892 rows)
  📋 public.user_summary (view)
  📊 public.events (~2,341,209 rows)

You: Write a query to find the top 5 customers by total order value last quarter.

Copilot: [calls suggest_query with "top customers order value"]
[reads users.id, users.email, orders.user_id, orders.total, orders.created_at,
       order_items.quantity, order_items.unit_price relationships]

Here's the query:

  SELECT u.id, u.email,
         SUM(o.total) AS total_spent,
         COUNT(o.id) AS order_count
  FROM users u
  JOIN orders o ON o.user_id = u.id
  WHERE o.status = 'completed'
    AND o.created_at >= DATE_TRUNC('quarter', NOW() - INTERVAL '3 months')
    AND o.created_at < DATE_TRUNC('quarter', NOW())
  GROUP BY u.id, u.email
  ORDER BY total_spent DESC
  LIMIT 5;

You: Run it.

Copilot: [calls execute_query]
Query executed in 124ms | Rows: 5

  id   | email                   | total_spent | order_count
  -----+-------------------------+-------------+-------------
  4521 | sarah.chen@example.com  | 8943.50     | 14
  2841 | jdoe@example.com        | 7120.00     | 9
  1893 | maria.garcia@example.com | 6502.25    | 11
  ...

You: Are there indexes to make this faster?

Copilot: [calls suggest_indexes for orders]
You're missing two important indexes:

  CREATE INDEX idx_orders_user_id ON orders(user_id);    -- FK lookup
  CREATE INDEX idx_orders_status_created ON orders(status, created_at); -- WHERE filter

Adding these should significantly reduce the query time.

You: Explain the current query plan.

Copilot: [calls explain_query]
The query is doing a sequential scan on orders (cost: 12,450)
because there's no index on (status, created_at). Here's the plan:
...
```

### Tips for Best Results

- **Use Agent mode** in Copilot Chat (the icon at the top of the chat panel) — Ask mode cannot invoke MCP tools
- **Start broad, then drill down**: "list tables" → "describe orders" → "write a query…"
- **Mention table names** when you know them — Copilot will verify them against the live schema
- **Chain requests**: "Find slow queries, then suggest indexes" — Copilot will call multiple tools in sequence
- **For MongoDB**, queries are JSON: `{"collection": "users", "filter": {"active": true}, "limit": 10}`
- **For CSV**, queries are basic SQL: `SELECT * FROM filename WHERE column = 'value'`
- **With multiple databases**, mention the database name: "list tables in the analytics database"

---

## Security Best Practices

1. **Use a read-only database user** — Never connect with admin/write credentials
2. **Use workspace-level settings** — Don't commit passwords to user settings
3. **Use environment variables** — Reference secrets from your `.env` file:

```json
{
  "mcp": {
    "servers": {
      "database-copilot": {
        "type": "stdio",
        "command": "node",
        "args": ["${workspaceFolder}/mcp/src/index.js", "--transport", "stdio"],
        "env": {
          "DATABASE_URL": "${env:DATABASE_URL}"
        }
      }
    }
  }
}
```

4. **Add `.vscode/mcp.json` to `.gitignore`** if it contains credentials
5. **Never use production admin credentials** — Create a dedicated MCP user

---

## Troubleshooting

### "No tools available" in Copilot

- Ensure dependencies are installed: `npm install`
- Check the path in your settings points to the correct `src/index.js`
- Restart VS Code after changing MCP settings

### "Connection refused" errors

- Verify your database is running and accessible
- Check credentials in the env configuration
- Look at the VS Code Output panel → select "MCP" for server logs

### Tools not responding

- Open the VS Code Output panel (`Ctrl+Shift+U`)
- Select "MCP" from the dropdown
- Check for error messages from the database-copilot server

### Slow responses

- The first query may be slow due to connection pool initialization
- Complex schemas with many tables may take longer to enumerate
- Consider limiting queries to specific schemas using the `schema` parameter

---

## Advanced: Running with Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY src/ ./src/
EXPOSE 3100
CMD ["node", "src/index.js"]
```

```bash
docker build -t mcp-database-copilot .
docker run -p 3100:3100 \
  -e DATABASE_URL="postgresql://user:pass@host.docker.internal:5432/mydb" \
  mcp-database-copilot
```

Then configure VS Code to connect via SSE:

```json
{
  "servers": {
    "database-copilot": {
      "type": "sse",
      "url": "http://localhost:3100/sse"
    }
  }
}
```
