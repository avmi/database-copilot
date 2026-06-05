import mysql from 'mysql2/promise';
import { BaseAdapter } from '../base-adapter.js';

export class MySQLAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.pool = null;
  }

  async connect() {
    this.pool = mysql.createPool({
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
      ssl: this.config.ssl ? {} : undefined,
      connectionLimit: 5,
      waitForConnections: true,
    });
    const conn = await this.pool.getConnection();
    conn.release();
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
    const [rows] = await this._query(
      `SELECT SCHEMA_NAME FROM information_schema.SCHEMATA
       WHERE SCHEMA_NAME NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')
       ORDER BY SCHEMA_NAME`
    );
    return rows.map(r => r.SCHEMA_NAME);
  }

  async listTables(schema) {
    const targetSchema = schema || this.config.database;
    const [rows] = await this._query(
      `SELECT TABLE_SCHEMA as table_schema, TABLE_NAME as table_name,
        TABLE_TYPE as table_type, TABLE_ROWS as row_count, TABLE_COMMENT as comment
      FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?
      ORDER BY TABLE_NAME`, [targetSchema]
    );
    return rows.map(r => ({
      schema: r.table_schema, name: r.table_name,
      type: r.table_type === 'BASE TABLE' ? 'table' : 'view',
      rowCount: r.row_count, comment: r.comment || null,
    }));
  }

  async getColumns(table, schema) {
    const targetSchema = schema || this.config.database;
    const [rows] = await this._query(
      `SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT,
        CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION, COLUMN_KEY, COLUMN_COMMENT
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
      ORDER BY ORDINAL_POSITION`, [targetSchema, table]
    );
    return rows.map(r => ({
      name: r.COLUMN_NAME, dataType: r.COLUMN_TYPE || r.DATA_TYPE,
      isNullable: r.IS_NULLABLE === 'YES', defaultValue: r.COLUMN_DEFAULT,
      isPrimaryKey: r.COLUMN_KEY === 'PRI', isUnique: r.COLUMN_KEY === 'UNI',
      characterMaxLength: r.CHARACTER_MAXIMUM_LENGTH, numericPrecision: r.NUMERIC_PRECISION,
      comment: r.COLUMN_COMMENT || null,
    }));
  }

  async getForeignKeys(table, schema) {
    const targetSchema = schema || this.config.database;
    let sql = `
      SELECT tc.CONSTRAINT_NAME, tc.TABLE_SCHEMA as source_schema, tc.TABLE_NAME as source_table,
        kcu.COLUMN_NAME as source_column, kcu.REFERENCED_TABLE_SCHEMA as target_schema,
        kcu.REFERENCED_TABLE_NAME as target_table, kcu.REFERENCED_COLUMN_NAME as target_column,
        rc.UPDATE_RULE as on_update, rc.DELETE_RULE as on_delete
      FROM information_schema.TABLE_CONSTRAINTS tc
      JOIN information_schema.KEY_COLUMN_USAGE kcu ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME AND tc.TABLE_SCHEMA = kcu.TABLE_SCHEMA
      JOIN information_schema.REFERENTIAL_CONSTRAINTS rc ON tc.CONSTRAINT_NAME = rc.CONSTRAINT_NAME AND tc.TABLE_SCHEMA = rc.CONSTRAINT_SCHEMA
      WHERE tc.CONSTRAINT_TYPE = 'FOREIGN KEY' AND tc.TABLE_SCHEMA = ?`;
    const params = [targetSchema];
    if (table) { sql += ` AND tc.TABLE_NAME = ?`; params.push(table); }
    sql += ` ORDER BY tc.TABLE_NAME, tc.CONSTRAINT_NAME`;
    const [rows] = await this._query(sql, params);
    return rows.map(r => ({
      constraintName: r.CONSTRAINT_NAME,
      sourceSchema: r.source_schema, sourceTable: r.source_table, sourceColumn: r.source_column,
      targetSchema: r.target_schema, targetTable: r.target_table, targetColumn: r.target_column,
      onUpdate: r.on_update, onDelete: r.on_delete,
    }));
  }

  async getIndexes(table, schema) {
    const targetSchema = schema || this.config.database;
    const [rows] = await this._query(
      `SELECT INDEX_NAME, TABLE_NAME, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) as columns,
        CASE WHEN NON_UNIQUE = 0 THEN 1 ELSE 0 END as is_unique,
        CASE WHEN INDEX_NAME = 'PRIMARY' THEN 1 ELSE 0 END as is_primary, INDEX_TYPE
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
      GROUP BY INDEX_NAME, TABLE_NAME, NON_UNIQUE, INDEX_TYPE
      ORDER BY INDEX_NAME`, [targetSchema, table]
    );
    return rows.map(r => ({
      name: r.INDEX_NAME, tableName: r.TABLE_NAME, columns: r.columns.split(','),
      isUnique: !!r.is_unique, isPrimary: !!r.is_primary, type: r.INDEX_TYPE,
    }));
  }

  async executeQuery(query, limit = 100) {
    this.validateReadOnly(query);
    const effectiveLimit = Math.min(limit, 100);
    const limitedSql = `SELECT * FROM (${query}) AS _q LIMIT ${effectiveLimit}`;
    const start = Date.now();
    const [rows, fields] = await this._query(limitedSql);
    return {
      columns: fields.map(f => f.name), rows,
      rowCount: rows.length, executionTimeMs: Date.now() - start,
    };
  }

  async explainQuery(query) {
    this.validateReadOnly(query);
    const [rows] = await this._query(`EXPLAIN FORMAT=JSON ${query}`);
    const plan = JSON.parse(rows[0].EXPLAIN);
    return {
      plan: JSON.stringify(plan, null, 2),
      estimatedCost: plan.query_block?.cost_info?.query_cost ? parseFloat(plan.query_block.cost_info.query_cost) : null,
      estimatedRows: plan.query_block?.table?.rows_examined_per_scan || null,
    };
  }

  async getSampleData(table, schema, limit = 10) {
    const targetSchema = schema || this.config.database;
    const effectiveLimit = Math.min(limit, 50);
    const quotedSchema = `\`${targetSchema.replace(/`/g, '``')}\``;
    const quotedTable = `\`${table.replace(/`/g, '``')}\``;
    const start = Date.now();
    const [rows, fields] = await this._query(`SELECT * FROM ${quotedSchema}.${quotedTable} LIMIT ${effectiveLimit}`);
    return {
      columns: fields.map(f => f.name), rows,
      rowCount: rows.length, executionTimeMs: Date.now() - start,
    };
  }

  async searchColumns(pattern) {
    const [rows] = await this._query(
      `SELECT TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME, DATA_TYPE
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')
         AND (COLUMN_NAME LIKE ? OR TABLE_NAME LIKE ?)
       ORDER BY TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME LIMIT 50`,
      [`%${pattern}%`, `%${pattern}%`]
    );
    return rows.map(r => ({
      schema: r.TABLE_SCHEMA, table: r.TABLE_NAME, column: r.COLUMN_NAME, dataType: r.DATA_TYPE,
    }));
  }
}
