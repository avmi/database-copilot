# MCP Database Copilot — Install & Use

A ready-to-install package that connects GitHub Copilot (and other AI assistants) in VS Code directly to your database. Copilot can then read your **real** schema, relationships, indexes, and sample data — so it writes correct queries against your actual tables.

This folder contains everything you need:

| File | Purpose |
|------|---------|
| `mcp-database-copilot-2.0.0.tgz` | The built package (install this) |
| `.env.example` | Sample configuration reference |
| `.vscode/mcp.json.example` | Sample VS Code MCP config |

---

## 1. Prerequisites

- **Node.js 18+** (20 LTS recommended) — check with `node --version`
- **VS Code** with the **GitHub Copilot** and **GitHub Copilot Chat** extensions
- Network access from your machine to the target database
- A **read-only** database user is strongly recommended

---

## 2. Install the package

Install the tarball globally. This exposes a `mcp-database-copilot` command and compiles the
native database drivers for your platform automatically.

```powershell
npm install -g .\mcp-database-copilot-2.0.0.tgz
```

Verify it installed:

```powershell
mcp-database-copilot --transport stdio
```

You should see the server start (press `Ctrl+C` to stop). If the command is not found, ensure your
npm global bin folder is on your `PATH` (`npm config get prefix`).

> Prefer not to install globally? You can also run it on demand with
> `npx mcp-database-copilot --transport stdio` after `npm install -g` — or keep the tarball and
> reference the full path in `mcp.json`.

---

## 3. Configure your database connection

Connections are supplied through environment variables. In VS Code these live directly in the
`env` block of `.vscode/mcp.json` (see next step). The `.env.example` in this folder documents
every available field.
OR
C:\Users\[USERNAME]\AppData\Roaming\Code\User\mcp.json

### Supported databases & type values

| `DB_x_TYPE` | Database | Default Port | Notes |
|-------------|----------|--------------|-------|
| `postgresql` | PostgreSQL | 5432 | aliases: `postgres`, `pg` |
| `mysql` | MySQL | 3306 | |
| `mariadb` | MariaDB | 3306 | |
| `sqlserver` | SQL Server | 1433 | alias: `mssql` |
| `sqlite` | SQLite | n/a | `DB_x_DATABASE` = path to `.db` file |
| `mongodb` | MongoDB | 27017 | alias: `mongo` |
| `csv` | CSV files | n/a | `DB_x_DATABASE` = directory of `.csv` files |

Two ways to configure:

1. **Connection string** (single DB): `DATABASE_URL=postgresql://user:pass@host:5432/dbname`
2. **Individual fields** (up to 10 DBs): `DB_1_TYPE`, `DB_1_HOST`, `DB_1_PORT`, `DB_1_DATABASE`, `DB_1_USER`, `DB_1_PASSWORD`, `DB_1_SSL`

---

## 4. Wire it into VS Code + Copilot

1. In your project, create the folder `.vscode/` if it doesn't exist.
2. Copy `.vscode/mcp.json.example` from this package to `.vscode/mcp.json` in your project.
3. Edit the `env` block with your real connection details:

```json
{
  "servers": {
    "database-copilot": {
      "type": "stdio",
      "command": "mcp-database-copilot",
      "args": ["--transport", "stdio"],
      "env": {
        "DB_1_TYPE": "postgresql",
        "DB_1_HOST": "localhost",
        "DB_1_PORT": "5432",
        "DB_1_DATABASE": "mydb",
        "DB_1_USER": "readonly_user",
        "DB_1_PASSWORD": "change_me",
        "DB_1_SSL": "false"
      }
    }
  }
}
```

4. **Reload VS Code**: `Ctrl+Shift+P` → **Developer: Reload Window**.
5. Open **Copilot Chat** (`Ctrl+Alt+I`) and switch to **Agent mode** so it can call tools.

### Config snippets for other databases

<details>
<summary>SQLite</summary>

```json
"env": {
  "DB_1_TYPE": "sqlite",
  "DB_1_DATABASE": "C:\\path\\to\\myapp.db"
}
```
</details>

<details>
<summary>MySQL / MariaDB</summary>

```json
"env": {
  "DB_1_TYPE": "mysql",
  "DB_1_HOST": "localhost",
  "DB_1_PORT": "3306",
  "DB_1_DATABASE": "mydb",
  "DB_1_USER": "readonly_user",
  "DB_1_PASSWORD": "change_me"
}
```
</details>

<details>
<summary>SQL Server</summary>

```json
"env": {
  "DB_1_TYPE": "sqlserver",
  "DB_1_HOST": "localhost",
  "DB_1_PORT": "1433",
  "DB_1_DATABASE": "mydb",
  "DB_1_USER": "sa",
  "DB_1_PASSWORD": "YourStrong!Passw0rd",
  "DB_1_SSL": "false"
}
```
</details>

<details>
<summary>MongoDB (incl. Atlas)</summary>

```json
"env": {
  "DB_1_TYPE": "mongodb",
  "DB_1_DATABASE": "mydb",
  "DB_1_OPTIONS": "{\"uri\":\"mongodb+srv://user:pass@cluster.mongodb.net/mydb\"}"
}
```
</details>

<details>
<summary>CSV files</summary>

```json
"env": {
  "DB_1_TYPE": "csv",
  "DB_1_DATABASE": "C:\\path\\to\\csv-folder"
}
```
</details>

---

## 5. Updating / changing DB connections later

1. Open your project's `.vscode/mcp.json`.
2. Edit the values in the `env` block (change host, database, credentials, or add `DB_2_*`,
   `DB_3_*`, … for more connections — up to 10).
3. **Reload VS Code** (`Ctrl+Shift+P` → **Developer: Reload Window**) so Copilot restarts the
   server with the new settings.

Adding a second database looks like this:

```json
"env": {
  "DB_1_TYPE": "postgresql",
  "DB_1_HOST": "localhost",
  "DB_1_PORT": "5432",
  "DB_1_DATABASE": "app",
  "DB_1_USER": "reader",
  "DB_1_PASSWORD": "secret1",

  "DB_2_TYPE": "mysql",
  "DB_2_HOST": "analytics.internal",
  "DB_2_PORT": "3306",
  "DB_2_DATABASE": "metrics",
  "DB_2_USER": "reader",
  "DB_2_PASSWORD": "secret2"
}
```

---

## 6. Start using it in Copilot Chat

Open Copilot Chat in **Agent mode** and ask natural-language questions. Copilot will pick the right
tool, call the database, and show results inline. Try:

- "What databases am I connected to?"
- "List all tables and their row counts."
- "Describe the `orders` table."
- "How are `orders` and `customers` related? Draw an ER diagram."
- "Write and run a query for the top 10 customers by total order value."
- "Suggest missing indexes for the `orders` table."

All queries run **read-only** with automatic `LIMIT` enforcement.

---

## 7. Updating the package to a new version

When you receive a newer `.tgz`, reinstall over the top:

```powershell
npm install -g .\mcp-database-copilot-<new-version>.tgz
```

Then reload VS Code. No `mcp.json` changes are needed unless connection details changed.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `mcp-database-copilot` not found | Ensure npm global bin is on `PATH` (`npm config get prefix`), or use the full path in `mcp.json`. |
| Server not listed in Copilot | Reload the VS Code window; confirm `.vscode/mcp.json` is valid JSON. |
| Copilot doesn't call tools | Switch Copilot Chat to **Agent mode**. |
| Connection errors | Verify host/port/credentials and that the DB is reachable from your machine. |
| `better-sqlite3` build error on install | Install Node 18/20 LTS and platform build tools, then reinstall. |

---

## Security notes

- Use a **read-only** database account.
- Credentials in `.vscode/mcp.json` are stored in plain text — do **not** commit it. Add
  `.vscode/mcp.json` to your `.gitignore`.
- The server only executes read queries and enforces row limits.
