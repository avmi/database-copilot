import pg from 'pg';
import { BaseAdapter } from '../base-adapter.js';

export class PostgresAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.pool = null;
  }

  async connect() {
    this.pool = new pg.Pool({
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
      ssl: this.config.ssl ? { rejectUnauthorized: false } : undefined,
      max: 5,
      idleTimeoutMillis: 30000,
    });
    const client = await this.pool.connect();
    client.release();
    this._connected = true;
  }

  async disconnect() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this._connected = false;
    }
  }

  async _query(sql, params) {
    if (!this.pool) throw new Error('Not connected');
    return this.pool.query(sql, params);
  }

  async listSchemas() {
    const result = await this._query(
      `SELECT schema_name FROM information_schema.schemata
       WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
       ORDER BY schema_name`
    );
    return result.rows.map(r => r.schema_name);
  }

  async listTables(schema) {
    const targetSchema = schema || 'public';
    const result = await this._query(
      `SELECT
        t.table_schema as schema,
        t.table_name as name,
        t.table_type,
        COALESCE(s.n_live_tup, 0) as row_count,
        obj_description((t.table_schema || '.' || t.table_name)::regclass) as comment
      FROM information_schema.tables t
      LEFT JOIN pg_stat_user_tables s ON s.schemaname = t.table_schema AND s.relname = t.table_name
      WHERE t.table_schema = $1
      ORDER BY t.table_name`,
      [targetSchema]
    );
    return result.rows.map(r => ({
      schema: r.schema,
      name: r.name,
      type: r.table_type === 'BASE TABLE' ? 'table' : 'view',
      rowCount: parseInt(r.row_count) || null,
      comment: r.comment,
    }));
  }

  async getColumns(table, schema) {
    const targetSchema = schema || 'public';
    const result = await this._query(
      `SELECT
        c.column_name, c.data_type, c.udt_name, c.is_nullable,
        c.column_default, c.character_maximum_length, c.numeric_precision,
        CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_primary_key,
        CASE WHEN uq.column_name IS NOT NULL THEN true ELSE false END as is_unique,
        col_description((c.table_schema || '.' || c.table_name)::regclass, c.ordinal_position) as comment
      FROM information_schema.columns c
      LEFT JOIN (
        SELECT ku.column_name, ku.table_schema, ku.table_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage ku ON tc.constraint_name = ku.constraint_name
        WHERE tc.constraint_type = 'PRIMARY KEY'
      ) pk ON pk.column_name = c.column_name AND pk.table_schema = c.table_schema AND pk.table_name = c.table_name
      LEFT JOIN (
        SELECT ku.column_name, ku.table_schema, ku.table_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage ku ON tc.constraint_name = ku.constraint_name
        WHERE tc.constraint_type = 'UNIQUE'
      ) uq ON uq.column_name = c.column_name AND uq.table_schema = c.table_schema AND uq.table_name = c.table_name
      WHERE c.table_schema = $1 AND c.table_name = $2
      ORDER BY c.ordinal_position`,
      [targetSchema, table]
    );
    return result.rows.map(r => ({
      name: r.column_name,
      dataType: r.udt_name || r.data_type,
      isNullable: r.is_nullable === 'YES',
      defaultValue: r.column_default,
      isPrimaryKey: r.is_primary_key,
      isUnique: r.is_unique,
      characterMaxLength: r.character_maximum_length,
      numericPrecision: r.numeric_precision,
      comment: r.comment,
    }));
  }

  async getForeignKeys(table, schema) {
    const targetSchema = schema || 'public';
    let sql = `
      SELECT tc.constraint_name, tc.table_schema as source_schema, tc.table_name as source_table,
        kcu.column_name as source_column, ccu.table_schema as target_schema,
        ccu.table_name as target_table, ccu.column_name as target_column,
        rc.update_rule as on_update, rc.delete_rule as on_delete
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
      JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = $1`;
    const params = [targetSchema];
    if (table) { sql += ` AND tc.table_name = $2`; params.push(table); }
    sql += ` ORDER BY tc.table_name, tc.constraint_name`;
    const result = await this._query(sql, params);
    return result.rows.map(r => ({
      constraintName: r.constraint_name,
      sourceSchema: r.source_schema, sourceTable: r.source_table, sourceColumn: r.source_column,
      targetSchema: r.target_schema, targetTable: r.target_table, targetColumn: r.target_column,
      onUpdate: r.on_update, onDelete: r.on_delete,
    }));
  }

  async getIndexes(table, schema) {
    const targetSchema = schema || 'public';
    const result = await this._query(
      `SELECT i.relname as index_name, t.relname as table_name,
        array_agg(a.attname ORDER BY k.n) as columns,
        ix.indisunique as is_unique, ix.indisprimary as is_primary, am.amname as index_type
      FROM pg_index ix
      JOIN pg_class t ON t.oid = ix.indrelid
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_am am ON am.oid = i.relam
      CROSS JOIN LATERAL unnest(ix.indkey) WITH ORDINALITY AS k(attnum, n)
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
      WHERE n.nspname = $1 AND t.relname = $2
      GROUP BY i.relname, t.relname, ix.indisunique, ix.indisprimary, am.amname
      ORDER BY i.relname`,
      [targetSchema, table]
    );
    return result.rows.map(r => ({
      name: r.index_name, tableName: r.table_name, columns: r.columns,
      isUnique: r.is_unique, isPrimary: r.is_primary, type: r.index_type,
    }));
  }

  async executeQuery(query, limit = 100) {
    this.validateReadOnly(query);
    const effectiveLimit = Math.min(limit, 100);
    const limitedSql = `SELECT * FROM (${query}) AS _q LIMIT ${effectiveLimit}`;
    const start = Date.now();
    const result = await this._query(limitedSql);
    return {
      columns: result.fields.map(f => f.name),
      rows: result.rows,
      rowCount: result.rowCount || 0,
      executionTimeMs: Date.now() - start,
    };
  }

  async explainQuery(query) {
    this.validateReadOnly(query);
    const result = await this._query(`EXPLAIN (FORMAT JSON) ${query}`);
    const plan = result.rows[0]['QUERY PLAN'][0];
    return {
      plan: JSON.stringify(plan, null, 2),
      estimatedCost: plan.Plan?.['Total Cost'] || null,
      estimatedRows: plan.Plan?.['Plan Rows'] || null,
    };
  }

  async getSampleData(table, schema, limit = 10) {
    const targetSchema = schema || 'public';
    const effectiveLimit = Math.min(limit, 50);
    const quotedSchema = `"${targetSchema.replace(/"/g, '""')}"`;
    const quotedTable = `"${table.replace(/"/g, '""')}"`;
    const start = Date.now();
    const result = await this._query(`SELECT * FROM ${quotedSchema}.${quotedTable} LIMIT ${effectiveLimit}`);
    return {
      columns: result.fields.map(f => f.name),
      rows: result.rows,
      rowCount: result.rowCount || 0,
      executionTimeMs: Date.now() - start,
    };
  }

  async searchColumns(pattern) {
    const result = await this._query(
      `SELECT table_schema, table_name, column_name, udt_name as data_type
       FROM information_schema.columns
       WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
         AND (column_name ILIKE $1 OR table_name ILIKE $1)
       ORDER BY table_schema, table_name, column_name LIMIT 50`,
      [`%${pattern}%`]
    );
    return result.rows.map(r => ({
      schema: r.table_schema, table: r.table_name, column: r.column_name, dataType: r.data_type,
    }));
  }
}
