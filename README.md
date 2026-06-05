# MCP Database Copilot

A Model Context Protocol (MCP) server that connects AI assistants (GitHub Copilot, Claude, etc.) directly to your databases. It exposes your real schema, relationships, indexes, and sample data so the AI writes correct queries against your *actual* tables — no more hallucinated column names.

## Features

- **Schema Exploration** — List schemas, tables, columns with types, constraints, and comments
- **Relationship Mapping** — Foreign key discovery with Mermaid ER diagrams
- **Index Analysis** — View existing indexes and get suggestions for missing ones
- **Safe Query Execution** — Read-only queries with automatic LIMIT enforcement
- **Query Plan Analysis** — EXPLAIN output for performance optimization
- **Sample Data** — Preview table contents to understand data patterns
- **Smart Search** — Find tables/columns by name pattern across the entire database
- **Multi-Database** — Connect to any combination of supported databases simultaneously
- **Extensible** — Add new database support by implementing a single adapter class

## Supported Databases

| Database   | Status | Type |
|-----------|--------|------|
| PostgreSQL | ✅ | Relational |
| MySQL      | ✅ | Relational |
| MariaDB    | ✅ | Relational |
| SQL Server | ✅ | Relational |
| SQLite     | ✅ | Embedded |
| MongoDB    | ✅ | Document |
| CSV Files  | ✅ | File-based |

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment file and configure your database
cp .env.example .env
# Edit .env with your database credentials

# Run with SSE transport (for HTTP-based clients)
npm start

# Or run with stdio transport (for VS Code direct integration)
npm run start:stdio
```

No build step required — pure JavaScript (ES modules).

## Configuration Cheat Sheet

Pick your database, set the `dbType` value, and provide a connection string OR individual fields.

| dbType | Connection String Example | Fields-based Example |
|--------|---------------------------|---------------------|
| `postgresql` | `postgresql://user:pass@host:5432/dbname` | `DB_1_TYPE=postgresql`, `DB_1_HOST=...`, `DB_1_PORT=5432`, `DB_1_DATABASE=...` |
| `mysql` | `mysql://user:pass@host:3306/dbname` | `DB_1_TYPE=mysql`, `DB_1_HOST=...`, `DB_1_PORT=3306`, `DB_1_DATABASE=...` |
| `mariadb` | `mariadb://user:pass@host:3306/dbname` | `DB_1_TYPE=mariadb`, `DB_1_HOST=...`, `DB_1_PORT=3306`, `DB_1_DATABASE=...` |
| `sqlserver` | `sqlserver://user:pass@host:1433/dbname` | `DB_1_TYPE=sqlserver`, `DB_1_HOST=...`, `DB_1_PORT=1433`, `DB_1_DATABASE=...` |
| `sqlite` | (no URL — use file path) | `DB_1_TYPE=sqlite`, `DB_1_DATABASE=./path/to/db.sqlite` |
| `mongodb` | `mongodb://user:pass@host:27017/dbname` | `DB_1_TYPE=mongodb`, `DB_1_HOST=...`, `DB_1_PORT=27017`, `DB_1_DATABASE=...` |
| `csv` | (no URL — use directory path) | `DB_1_TYPE=csv`, `DB_1_DATABASE=./path/to/csv-folder` |

See [docs/VSCODE_INTEGRATION.md](docs/VSCODE_INTEGRATION.md) for ready-to-paste `mcp.json` snippets per database type.

## Available MCP Tools

| Tool | Description |
|------|-------------|
| `list_connections` | List all configured database connections |
| `list_schemas` | List schemas in a database |
| `list_tables` | List tables/views/collections with row counts |
| `describe_table` | Get column/field details (types, constraints, defaults) |
| `full_table_info` | Complete table info (columns + FKs + indexes) |
| `search_schema` | Search for tables/columns by pattern |
| `get_relationships` | Get foreign key relationships |
| `schema_overview` | High-level ER diagram of all tables |
| `get_indexes` | List indexes on a table |
| `suggest_indexes` | Suggest missing indexes |
| `execute_query` | Run a read-only query (SQL, JSON for Mongo, basic for CSV) |
| `explain_query` | Get execution plan for a query |
| `sample_data` | Get sample rows from a table/collection |
| `suggest_query` | Get schema context for query formulation |

## Sample Queries You Can Ask in VS Code Chat

Once set up, open GitHub Copilot Chat in VS Code (`Ctrl+Alt+I`) and ask natural-language questions. Copilot will pick the right MCP tool, call it, and show the result inline.

### Setup (30 seconds)

1. Run `npm install` in the `mcp/` folder
2. Open [.vscode/mcp.json](.vscode/mcp.json) and set your `DATABASE_URL`
3. Reload VS Code (`Ctrl+Shift+P` → "Developer: Reload Window")
4. Open Copilot Chat (`Ctrl+Alt+I`) and switch to **Agent mode** (so it can call tools)
5. Ask any question below

### Schema Discovery

| You ask… | Tool called | What you get back |
|----------|-------------|-------------------|
| "What databases am I connected to?" | `list_connections` | List of active connections with type and status |
| "List all tables in the database" | `list_tables` | Table names, row counts, comments |
| "What schemas exist?" | `list_schemas` | All non-system schemas |
| "Describe the users table" | `describe_table` | Column names, types, nullability, defaults, PK/FK flags |
| "Give me everything about the orders table" | `full_table_info` | Columns + foreign keys + indexes in one response |
| "Find any column with 'email' in the name" | `search_schema` | All matching table.column pairs across the DB |
| "Show me the entire schema overview" | `schema_overview` | Tables grouped with relationships + Mermaid ER diagram |

### Relationship & Data Modeling

| You ask… | Tool called | What you get back |
|----------|-------------|-------------------|
| "How are orders and customers related?" | `get_relationships` | FK details: source → target columns, ON DELETE/UPDATE rules |
| "What tables reference the products table?" | `get_relationships` | Reverse FK lookup |
| "Draw me an ER diagram of the public schema" | `schema_overview` | Mermaid diagram you can render in VS Code preview |

### Query Writing (the killer feature)

| You ask… | Tool called | What happens |
|----------|-------------|--------------|
| "Write a query for users who signed up in the last 30 days" | `suggest_query` → user-written SQL | Copilot reads your real schema, then writes correct SQL |
| "Get the top 10 customers by total order value" | `suggest_query` + `execute_query` | Writes the JOIN against actual column names, runs it |
| "Find users with no orders" | `execute_query` | LEFT JOIN with NULL check, executed against your DB |
| "Show me users created today" | `execute_query` | Returns actual rows from your data |

### Data Exploration

| You ask… | Tool called | What you get back |
|----------|-------------|-------------------|
| "Show me 5 sample rows from the orders table" | `sample_data` | First 5 rows as JSON |
| "What does the events collection look like?" | `sample_data` | Sample documents (for MongoDB) |
| "Preview the customers.csv file" | `sample_data` | First rows of the CSV |

### Performance Analysis

| You ask… | Tool called | What you get back |
|----------|-------------|-------------------|
| "Explain this query: SELECT * FROM users WHERE email = 'x'" | `explain_query` | Execution plan with cost estimates |
| "Show all indexes on the orders table" | `get_indexes` | Index names, columns, types, uniqueness flags |
| "What indexes am I missing on the orders table?" | `suggest_indexes` | SQL `CREATE INDEX` statements for unindexed FKs and common columns |
| "Why is this query slow?" | `explain_query` + `get_indexes` | Plan + index list, Copilot suggests optimizations |

### Multi-Database Queries

When you have multiple connections configured, Copilot can route to any of them:

| You ask… | What happens |
|----------|--------------|
| "List tables in the analytics database" | Copilot picks the right `connectionId` automatically |
| "Compare the users table in app_db vs warehouse" | Calls `describe_table` on both connections |
| "Run this query against the production database" | Uses the matching `connectionId` for `execute_query` |

### Example Conversation

```
You:    What tables do I have?
Copilot: [calls list_tables] You have 8 tables:
          📊 public.users (~12,450 rows)
          📊 public.orders (~89,231 rows)
          📊 public.products (~1,205 rows)
          ...

You:    Write a query to find the top 5 products by total revenue
Copilot: [calls suggest_query, sees orders → products FK, sees order_items.quantity, products.price]
        Here's the query:
        SELECT p.id, p.name, SUM(oi.quantity * oi.unit_price) AS revenue
        FROM products p
        JOIN order_items oi ON oi.product_id = p.id
        JOIN orders o ON o.id = oi.order_id
        WHERE o.status = 'completed'
        GROUP BY p.id, p.name
        ORDER BY revenue DESC
        LIMIT 5;

You:    Run it
Copilot: [calls execute_query]
        Query executed in 47ms | Rows: 5
        id  | name              | revenue
        ----+-------------------+---------
        42  | Premium Widget    | 89432.50
        18  | Standard Widget   | 67120.00
        ...

You:    Are there indexes that could speed this up?
Copilot: [calls suggest_indexes for order_items]
        I'd recommend:
        CREATE INDEX idx_order_items_product_id ON order_items(product_id);
        CREATE INDEX idx_orders_status ON orders(status);
```

### Tips for Best Results

- **Use Agent mode**, not Ask mode — only Agent mode can invoke MCP tools
- **Start broad, then drill down** — "list tables" → "describe users" → "write a query…"
- **Reference real table/column names** when you know them — Copilot uses the schema to verify
- **Ask for explanations** — "why did you write it this way?" — Copilot remembers the schema context
- **Chain requests** — "Find slow tables, then suggest indexes" works because Copilot can call multiple tools in sequence

## Architecture

```
┌─────────────────────────────────────────────────┐
│   VS Code / GitHub Copilot / Claude Desktop     │
└──────────────────────┬──────────────────────────┘
                       │ MCP Protocol (stdio or SSE)
┌──────────────────────▼──────────────────────────┐
│          MCP Database Copilot Server             │
├─────────────────────────────────────────────────┤
│  Tools Layer (schema, query, relationships)      │
├─────────────────────────────────────────────────┤
│  Connection Manager + Adapter Registry           │
├─────────┬──────┬────────┬──────┬────┬─────┬────┤
│  Postgres│MySQL │MariaDB │MSSQL │SQLite│Mongo│CSV│
│  Adapter │Adapt.│Adapter │Adapt.│Adapt│Adapt│Adp│
└────┬─────┴──┬───┴────┬───┴──┬───┴──┬──┴──┬──┴─┬┘
     │        │        │      │      │     │    │
   ┌─▼──┐ ┌──▼─┐ ┌───▼──┐ ┌─▼──┐ ┌─▼─┐ ┌▼─┐ ┌▼──┐
   │ PG │ │MySQL│ │Maria │ │MSSQL│ │.db│ │DB│ │.csv│
   └────┘ └────┘ └──────┘ └────┘ └───┘ └──┘ └───┘
```

## Adding a New Database Adapter

The project uses a plugin-like architecture. To add support for a new database:

1. **Create adapter file** — `src/database/adapters/your-db.js`
2. **Extend `BaseAdapter`** — Implement the required methods
3. **Register it** — Add one line to `src/database/adapters/index.js`

```javascript
// src/database/adapters/oracle.js
import { BaseAdapter } from '../base-adapter.js';

export class OracleAdapter extends BaseAdapter {
  async connect() { /* ... */ }
  async disconnect() { /* ... */ }
  async listSchemas() { /* ... */ }
  async listTables(schema) { /* ... */ }
  async getColumns(table, schema) { /* ... */ }
  async executeQuery(query, limit) { /* ... */ }
  async getSampleData(table, schema, limit) { /* ... */ }
  async searchColumns(pattern) { /* ... */ }
  // Optional: getForeignKeys, getIndexes, explainQuery
}
```

Then register in `src/database/adapters/index.js`:
```javascript
import { OracleAdapter } from './oracle.js';
// Add to ADAPTERS map:
['oracle', OracleAdapter],
```

See `src/database/base-adapter.js` for the full interface with JSDoc types.

## Security

- **Read-only queries only** — INSERT, UPDATE, DELETE, DROP are blocked at the adapter level
- **Automatic LIMIT** — All queries are wrapped with LIMIT to prevent unbounded result sets
- **Parameterized queries** — All schema queries use parameterized inputs
- **Quoted identifiers** — Table/schema names are properly quoted to prevent SQL injection
- **Connection pooling** — Limited pool sizes prevent connection exhaustion

## Configuration

See [docs/SETUP.md](docs/SETUP.md) for detailed configuration options.

## VS Code Integration

See [docs/VSCODE_INTEGRATION.md](docs/VSCODE_INTEGRATION.md) for step-by-step VS Code setup.

## Development

```bash
# Run in development mode with auto-restart (Node 18.11+)
npm run dev

# Run in stdio mode for testing with MCP Inspector
npm run dev:stdio
```

## License

MIT
