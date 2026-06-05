import { z } from 'zod';

export function registerIndexTools(server, connectionManager) {
  server.tool(
    'get_indexes',
    'Get all indexes on a table including type, columns, and uniqueness. Useful for understanding query performance.',
    {
      table: z.string().describe('Table name'),
      schema: z.string().optional().describe('Schema name'),
      connectionId: z.string().optional().describe('Connection ID'),
    },
    async ({ table, schema, connectionId }) => {
      const adapter = connectionManager.getAdapter(connectionId);
      const indexes = await adapter.getIndexes(table, schema);
      if (indexes.length === 0) {
        return { content: [{ type: 'text', text: `No indexes found for "${table}".` }] };
      }
      let output = `## Indexes on ${schema || 'default'}.${table}\n\n`;
      for (const idx of indexes) {
        const flags = [];
        if (idx.isPrimary) flags.push('PRIMARY');
        if (idx.isUnique && !idx.isPrimary) flags.push('UNIQUE');
        output += `### ${idx.name}\n  Type: ${idx.type}\n  Columns: ${idx.columns.join(', ')}\n`;
        if (flags.length) output += `  Flags: ${flags.join(', ')}\n`;
        output += '\n';
      }
      return { content: [{ type: 'text', text: output }] };
    }
  );

  server.tool(
    'suggest_indexes',
    'Analyze a table and suggest potentially missing indexes based on foreign keys and common patterns',
    {
      table: z.string().describe('Table name to analyze'),
      schema: z.string().optional().describe('Schema name'),
      connectionId: z.string().optional().describe('Connection ID'),
    },
    async ({ table, schema, connectionId }) => {
      const adapter = connectionManager.getAdapter(connectionId);
      const [indexes, foreignKeys, columns] = await Promise.all([
        adapter.getIndexes(table, schema),
        adapter.getForeignKeys(table, schema),
        adapter.getColumns(table, schema),
      ]);

      const indexedColumns = new Set();
      for (const idx of indexes) for (const col of idx.columns) indexedColumns.add(col);

      let output = `## Index Analysis for ${schema || 'default'}.${table}\n\n`;
      output += `### Current Indexes: ${indexes.length}\n`;
      for (const idx of indexes) output += `  ${idx.name}: (${idx.columns.join(', ')})\n`;

      const suggestions = [];

      for (const fk of foreignKeys) {
        if (!indexedColumns.has(fk.sourceColumn)) {
          suggestions.push(`CREATE INDEX idx_${table}_${fk.sourceColumn} ON ${table}(${fk.sourceColumn}); -- FK to ${fk.targetTable}`);
        }
      }

      const commonCandidates = ['created_at', 'updated_at', 'status', 'type', 'email', 'name', 'created', 'modified'];
      for (const col of columns) {
        if (commonCandidates.includes(col.name) && !indexedColumns.has(col.name)) {
          suggestions.push(`CREATE INDEX idx_${table}_${col.name} ON ${table}(${col.name}); -- commonly queried column`);
        }
      }

      if (suggestions.length > 0) {
        output += `\n### Suggested Indexes\n\`\`\`sql\n${suggestions.join('\n')}\n\`\`\`\n`;
        output += '\n⚠️ Evaluate based on actual query patterns before applying.\n';
      } else {
        output += '\n### No Missing Indexes Detected\n';
      }

      return { content: [{ type: 'text', text: output }] };
    }
  );
}
