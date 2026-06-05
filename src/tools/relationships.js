import { z } from 'zod';

export function registerRelationshipTools(server, connectionManager) {
  server.tool(
    'get_relationships',
    'Get foreign key relationships for a table or all tables in a schema. Shows how tables are connected.',
    {
      table: z.string().optional().describe('Table name (omit to get all relationships)'),
      schema: z.string().optional().describe('Schema name'),
      connectionId: z.string().optional().describe('Connection ID'),
    },
    async ({ table, schema, connectionId }) => {
      const adapter = connectionManager.getAdapter(connectionId);
      const fks = await adapter.getForeignKeys(table, schema);

      if (fks.length === 0) {
        return { content: [{ type: 'text', text: table ? `No foreign keys found for "${table}".` : 'No foreign keys found in schema.' }] };
      }

      let output = `## Relationships${table ? ` for ${table}` : ''}\n\n`;
      const grouped = new Map();
      for (const fk of fks) {
        const key = `${fk.sourceSchema}.${fk.sourceTable}`;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(fk);
      }
      for (const [tableName, relationships] of grouped) {
        output += `### ${tableName}\n`;
        for (const rel of relationships) {
          output += `  ${rel.sourceColumn} → ${rel.targetSchema}.${rel.targetTable}.${rel.targetColumn}\n`;
          output += `    Constraint: ${rel.constraintName} | ON DELETE: ${rel.onDelete} | ON UPDATE: ${rel.onUpdate}\n`;
        }
        output += '\n';
      }
      return { content: [{ type: 'text', text: output }] };
    }
  );

  server.tool(
    'schema_overview',
    'Get a high-level overview of all tables and their relationships as a text-based ER diagram',
    {
      schema: z.string().optional().describe('Schema name'),
      connectionId: z.string().optional().describe('Connection ID'),
    },
    async ({ schema, connectionId }) => {
      const adapter = connectionManager.getAdapter(connectionId);
      const [tables, allFks] = await Promise.all([
        adapter.listTables(schema),
        adapter.getForeignKeys(undefined, schema),
      ]);

      let output = `## Schema Overview: ${adapter.getDatabaseName()} (${adapter.getType()})\n\n`;
      output += `### Tables (${tables.length})\n`;

      for (const t of tables) {
        const inFks = allFks.filter(fk => fk.targetTable === t.name);
        const outFks = allFks.filter(fk => fk.sourceTable === t.name);
        const icon = t.type === 'view' ? '📋' : t.type === 'collection' ? '📁' : '📊';
        output += `\n#### ${icon} ${t.name}`;
        if (t.rowCount !== null) output += ` (~${t.rowCount} rows)`;
        if (t.comment) output += `\n  ${t.comment}`;
        output += '\n';
        if (outFks.length > 0) {
          output += '  References:\n';
          for (const fk of outFks) output += `    ${fk.sourceColumn} → ${fk.targetTable}.${fk.targetColumn}\n`;
        }
        if (inFks.length > 0) {
          output += '  Referenced by:\n';
          for (const fk of inFks) output += `    ${fk.sourceTable}.${fk.sourceColumn} → ${fk.targetColumn}\n`;
        }
      }

      if (allFks.length > 0) {
        output += '\n### Mermaid ER Diagram\n```mermaid\nerDiagram\n';
        for (const t of tables.filter(t => t.type === 'table')) output += `  ${t.name} {\n  }\n`;
        for (const fk of allFks) output += `  ${fk.sourceTable} }|--|| ${fk.targetTable} : "${fk.sourceColumn}"\n`;
        output += '```\n';
      }

      return { content: [{ type: 'text', text: output }] };
    }
  );
}
