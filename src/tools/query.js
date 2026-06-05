import { z } from 'zod';

export function registerQueryTools(server, connectionManager) {
  server.tool(
    'execute_query',
    'Execute a read-only query (SELECT/WITH for SQL, JSON for MongoDB, basic SELECT for CSV). Results are limited automatically.',
    {
      sql: z.string().describe('The query to execute (SQL for relational DBs, JSON for MongoDB)'),
      limit: z.number().optional().default(50).describe('Max rows to return (default 50, max 100)'),
      connectionId: z.string().optional().describe('Connection ID'),
    },
    async ({ sql, limit, connectionId }) => {
      const adapter = connectionManager.getAdapter(connectionId);
      const effectiveLimit = Math.min(limit || 50, 100);
      try {
        const result = await adapter.executeQuery(sql, effectiveLimit);
        let output = `Query executed in ${result.executionTimeMs}ms | Rows: ${result.rowCount}\n\n`;
        if (result.rows.length > 0) {
          const colWidths = new Map();
          for (const col of result.columns) colWidths.set(col, col.length);
          for (const row of result.rows) {
            for (const col of result.columns) {
              const val = String(row[col] ?? 'NULL');
              colWidths.set(col, Math.min(Math.max(colWidths.get(col), val.length), 40));
            }
          }
          output += result.columns.map(c => c.padEnd(colWidths.get(c))).join(' | ') + '\n';
          output += result.columns.map(c => '-'.repeat(colWidths.get(c))).join('-+-') + '\n';
          for (const row of result.rows) {
            output += result.columns.map(c => String(row[c] ?? 'NULL').substring(0, 40).padEnd(colWidths.get(c))).join(' | ') + '\n';
          }
        }
        return { content: [{ type: 'text', text: output }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Query error: ${error.message}` }], isError: true };
      }
    }
  );

  server.tool(
    'explain_query',
    'Get the execution plan for a query to understand performance and optimization opportunities',
    {
      sql: z.string().describe('The query to explain'),
      connectionId: z.string().optional().describe('Connection ID'),
    },
    async ({ sql, connectionId }) => {
      const adapter = connectionManager.getAdapter(connectionId);
      try {
        const plan = await adapter.explainQuery(sql);
        let output = '## Query Execution Plan\n\n';
        if (plan.estimatedCost !== null) output += `Estimated Cost: ${plan.estimatedCost}\n`;
        if (plan.estimatedRows !== null) output += `Estimated Rows: ${plan.estimatedRows}\n`;
        output += `\n### Plan Details\n\`\`\`json\n${plan.plan}\n\`\`\`\n`;
        return { content: [{ type: 'text', text: output }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Explain error: ${error.message}` }], isError: true };
      }
    }
  );

  server.tool(
    'sample_data',
    'Get sample rows from a table/collection to understand data format and content patterns',
    {
      table: z.string().describe('Table/collection name'),
      schema: z.string().optional().describe('Schema name'),
      limit: z.number().optional().default(10).describe('Number of sample rows (default 10, max 50)'),
      connectionId: z.string().optional().describe('Connection ID'),
    },
    async ({ table, schema, limit, connectionId }) => {
      const adapter = connectionManager.getAdapter(connectionId);
      try {
        const result = await adapter.getSampleData(table, schema, limit);
        let output = `Sample data from ${schema || 'default'}.${table} (${result.rowCount} rows, ${result.executionTimeMs}ms):\n\n`;
        if (result.rows.length > 0) {
          output += '```json\n' + JSON.stringify(result.rows, null, 2) + '\n```\n';
        } else {
          output += 'Table/collection is empty.\n';
        }
        return { content: [{ type: 'text', text: output }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true };
      }
    }
  );

  server.tool(
    'suggest_query',
    'Given a natural language description, provides schema context relevant to formulating a query',
    {
      description: z.string().describe('Natural language description of what data you want (e.g., "users who signed up last month")'),
      connectionId: z.string().optional().describe('Connection ID'),
    },
    async ({ description, connectionId }) => {
      const adapter = connectionManager.getAdapter(connectionId);
      const keywords = description.toLowerCase().split(/\s+/).filter(w => w.length > 2);

      const allResults = [];
      for (const keyword of keywords.slice(0, 5)) {
        try {
          const results = await adapter.searchColumns(keyword);
          allResults.push(...results);
        } catch { /* skip */ }
      }

      const uniqueTables = [...new Set(allResults.map(r => `${r.schema}.${r.table}`))];
      let output = `## Query Context for: "${description}"\n\n### Potentially Relevant Tables\n`;

      for (const tableFullName of uniqueTables.slice(0, 5)) {
        const [schema, table] = tableFullName.split('.');
        const columns = await adapter.getColumns(table, schema);
        output += `\n#### ${tableFullName}\n`;
        for (const col of columns) {
          const flags = [];
          if (col.isPrimaryKey) flags.push('PK');
          if (!col.isNullable) flags.push('NOT NULL');
          output += `  ${col.name}: ${col.dataType}${flags.length ? ` [${flags.join(', ')}]` : ''}\n`;
        }
      }

      if (uniqueTables.length > 1) {
        output += '\n### Relationships Between These Tables\n';
        for (const tableFullName of uniqueTables.slice(0, 5)) {
          const [schema, table] = tableFullName.split('.');
          const fks = await adapter.getForeignKeys(table, schema);
          for (const fk of fks) {
            if (uniqueTables.includes(`${fk.targetSchema}.${fk.targetTable}`)) {
              output += `  ${fk.sourceTable}.${fk.sourceColumn} → ${fk.targetTable}.${fk.targetColumn}\n`;
            }
          }
        }
      }

      output += '\n### Matching Columns\n';
      for (const r of allResults.slice(0, 20)) {
        output += `  ${r.schema}.${r.table}.${r.column} (${r.dataType})\n`;
      }
      return { content: [{ type: 'text', text: output }] };
    }
  );
}
