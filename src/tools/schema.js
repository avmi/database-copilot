import { z } from 'zod';
import { getSupportedTypes } from '../database/adapters/index.js';

export function registerSchemaTools(server, connectionManager) {
  server.tool(
    'list_connections',
    'List all configured database connections and their status',
    {},
    async () => {
      const connections = connectionManager.listConnections();
      const supported = getSupportedTypes();
      return {
        content: [{
          type: 'text',
          text: `## Active Connections\n${JSON.stringify(connections, null, 2)}\n\n## Supported Types\n${supported.join(', ')}`,
        }],
      };
    }
  );

  server.tool(
    'list_schemas',
    'List all schemas/databases available in the connected database',
    {
      connectionId: z.string().optional().describe('Connection ID (uses default if not specified)'),
    },
    async ({ connectionId }) => {
      const adapter = connectionManager.getAdapter(connectionId);
      const schemas = await adapter.listSchemas();
      return {
        content: [{ type: 'text', text: `Schemas in ${adapter.getDatabaseName()} (${adapter.getType()}):\n${schemas.map(s => `  - ${s}`).join('\n')}` }],
      };
    }
  );

  server.tool(
    'list_tables',
    'List all tables/views/collections in a database schema, including row counts and comments',
    {
      schema: z.string().optional().describe('Schema name (defaults vary by database type)'),
      connectionId: z.string().optional().describe('Connection ID (uses default if not specified)'),
    },
    async ({ schema, connectionId }) => {
      const adapter = connectionManager.getAdapter(connectionId);
      const tables = await adapter.listTables(schema);
      const output = tables.map(t => {
        const icon = t.type === 'view' ? '📋' : t.type === 'collection' ? '📁' : '📊';
        let line = `  ${icon} ${t.schema}.${t.name}`;
        if (t.rowCount !== null) line += ` (~${t.rowCount} rows)`;
        if (t.comment) line += ` — ${t.comment}`;
        return line;
      });
      return {
        content: [{ type: 'text', text: `Tables in ${adapter.getDatabaseName()}${schema ? `.${schema}` : ''}:\n${output.join('\n')}` }],
      };
    }
  );

  server.tool(
    'describe_table',
    'Get detailed column/field information for a table including types, constraints, defaults, and comments',
    {
      table: z.string().describe('Table/collection name'),
      schema: z.string().optional().describe('Schema name'),
      connectionId: z.string().optional().describe('Connection ID'),
    },
    async ({ table, schema, connectionId }) => {
      const adapter = connectionManager.getAdapter(connectionId);
      const columns = await adapter.getColumns(table, schema);
      const lines = columns.map(c => {
        const flags = [];
        if (c.isPrimaryKey) flags.push('PK');
        if (c.isUnique) flags.push('UNIQUE');
        if (!c.isNullable) flags.push('NOT NULL');
        if (c.defaultValue) flags.push(`DEFAULT ${c.defaultValue}`);
        let line = `  ${c.name}: ${c.dataType}`;
        if (c.characterMaxLength) line += `(${c.characterMaxLength})`;
        if (flags.length) line += ` [${flags.join(', ')}]`;
        if (c.comment) line += ` — ${c.comment}`;
        return line;
      });
      return {
        content: [{ type: 'text', text: `Table: ${schema || 'default'}.${table}\nColumns:\n${lines.join('\n')}` }],
      };
    }
  );

  server.tool(
    'full_table_info',
    'Get comprehensive table information including columns, foreign keys, and indexes all at once',
    {
      table: z.string().describe('Table name'),
      schema: z.string().optional().describe('Schema name'),
      connectionId: z.string().optional().describe('Connection ID'),
    },
    async ({ table, schema, connectionId }) => {
      const adapter = connectionManager.getAdapter(connectionId);
      const [columns, foreignKeys, indexes] = await Promise.all([
        adapter.getColumns(table, schema),
        adapter.getForeignKeys(table, schema),
        adapter.getIndexes(table, schema),
      ]);

      let output = `## Table: ${schema || 'default'}.${table} (${adapter.getType()})\n\n### Columns\n`;
      for (const c of columns) {
        const flags = [];
        if (c.isPrimaryKey) flags.push('🔑 PK');
        if (c.isUnique) flags.push('UNIQUE');
        if (!c.isNullable) flags.push('NOT NULL');
        if (c.defaultValue) flags.push(`DEFAULT ${c.defaultValue}`);
        output += `  ${c.name}: ${c.dataType}`;
        if (c.characterMaxLength) output += `(${c.characterMaxLength})`;
        if (flags.length) output += ` [${flags.join(', ')}]`;
        if (c.comment) output += ` — ${c.comment}`;
        output += '\n';
      }

      if (foreignKeys.length > 0) {
        output += '\n### Foreign Keys\n';
        for (const fk of foreignKeys) {
          output += `  ${fk.constraintName}: ${fk.sourceColumn} → ${fk.targetTable}.${fk.targetColumn} (ON DELETE ${fk.onDelete}, ON UPDATE ${fk.onUpdate})\n`;
        }
      }

      if (indexes.length > 0) {
        output += '\n### Indexes\n';
        for (const idx of indexes) {
          const flags = [];
          if (idx.isPrimary) flags.push('PRIMARY');
          if (idx.isUnique) flags.push('UNIQUE');
          output += `  ${idx.name}: (${idx.columns.join(', ')}) [${idx.type}${flags.length ? ', ' + flags.join(', ') : ''}]\n`;
        }
      }

      return { content: [{ type: 'text', text: output }] };
    }
  );

  server.tool(
    'search_schema',
    'Search for tables and columns matching a pattern (useful for finding where data lives)',
    {
      pattern: z.string().describe('Search pattern (e.g., "email", "user", "created")'),
      connectionId: z.string().optional().describe('Connection ID'),
    },
    async ({ pattern, connectionId }) => {
      const adapter = connectionManager.getAdapter(connectionId);
      const results = await adapter.searchColumns(pattern);
      if (results.length === 0) {
        return { content: [{ type: 'text', text: `No columns or tables matching "${pattern}" found.` }] };
      }
      const lines = results.map(r => `  ${r.schema}.${r.table}.${r.column} (${r.dataType})`);
      return { content: [{ type: 'text', text: `Columns matching "${pattern}":\n${lines.join('\n')}` }] };
    }
  );
}
