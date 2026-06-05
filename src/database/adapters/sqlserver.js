import sql from 'mssql';
import { BaseAdapter } from '../base-adapter.js';

export class SQLServerAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.pool = null;
  }

  async connect() {
    this.pool = await sql.connect({
      server: this.config.host,
      port: this.config.port || 1433,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
      options: {
        encrypt: !!this.config.ssl,
        trustServerCertificate: true,
      },
      pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
    });
    this._connected = true;
  }

  async disconnect() {
    if (this.pool) {
      await this.pool.close();
      this.pool = null;
      this._connected = false;
    }
  }

  async _query(sqlText) {
    if (!this.pool) throw new Error('Not connected');
    return this.pool.request().query(sqlText);
  }

  async listSchemas() {
    const result = await this._query(
      `SELECT s.name FROM sys.schemas s
       WHERE s.name NOT IN ('sys', 'INFORMATION_SCHEMA', 'guest', 'db_owner', 'db_accessadmin',
         'db_securityadmin', 'db_ddladmin', 'db_backupoperator', 'db_datareader', 'db_datawriter',
         'db_denydatareader', 'db_denydatawriter')
       ORDER BY s.name`
    );
    return result.recordset.map(r => r.name);
  }

  async listTables(schema) {
    const targetSchema = schema || 'dbo';
    const result = await this._query(
      `SELECT s.name as [schema], t.name, t.type_desc,
        p.rows as row_count, ep.value as comment
      FROM sys.tables t
      JOIN sys.schemas s ON t.schema_id = s.schema_id
      LEFT JOIN sys.partitions p ON t.object_id = p.object_id AND p.index_id IN (0, 1)
      LEFT JOIN sys.extended_properties ep ON ep.major_id = t.object_id AND ep.minor_id = 0 AND ep.name = 'MS_Description'
      WHERE s.name = '${targetSchema.replace(/'/g, "''")}'
      UNION ALL
      SELECT s.name, v.name, 'VIEW', NULL, ep.value
      FROM sys.views v
      JOIN sys.schemas s ON v.schema_id = s.schema_id
      LEFT JOIN sys.extended_properties ep ON ep.major_id = v.object_id AND ep.minor_id = 0 AND ep.name = 'MS_Description'
      WHERE s.name = '${targetSchema.replace(/'/g, "''")}'
      ORDER BY name`
    );
    return result.recordset.map(r => ({
      schema: r.schema, name: r.name,
      type: r.type_desc === 'VIEW' ? 'view' : 'table',
      rowCount: r.row_count, comment: r.comment || null,
    }));
  }

  async getColumns(table, schema) {
    const targetSchema = schema || 'dbo';
    const result = await this._query(
      `SELECT c.name as column_name, ty.name as data_type, c.max_length, c.precision,
        c.is_nullable, dc.definition as column_default,
        CASE WHEN pk.column_id IS NOT NULL THEN 1 ELSE 0 END as is_primary_key,
        CASE WHEN uq.column_id IS NOT NULL THEN 1 ELSE 0 END as is_unique,
        ep.value as comment
      FROM sys.columns c
      JOIN sys.types ty ON c.user_type_id = ty.user_type_id
      JOIN sys.tables t ON c.object_id = t.object_id
      JOIN sys.schemas s ON t.schema_id = s.schema_id
      LEFT JOIN sys.default_constraints dc ON c.default_object_id = dc.object_id
      LEFT JOIN (
        SELECT ic.column_id, ic.object_id FROM sys.index_columns ic
        JOIN sys.indexes i ON ic.object_id = i.object_id AND ic.index_id = i.index_id
        WHERE i.is_primary_key = 1
      ) pk ON pk.object_id = c.object_id AND pk.column_id = c.column_id
      LEFT JOIN (
        SELECT ic.column_id, ic.object_id FROM sys.index_columns ic
        JOIN sys.indexes i ON ic.object_id = i.object_id AND ic.index_id = i.index_id
        WHERE i.is_unique = 1 AND i.is_primary_key = 0
      ) uq ON uq.object_id = c.object_id AND uq.column_id = c.column_id
      LEFT JOIN sys.extended_properties ep ON ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name = 'MS_Description'
      WHERE s.name = '${targetSchema.replace(/'/g, "''")}' AND t.name = '${table.replace(/'/g, "''")}'
      ORDER BY c.column_id`
    );
    return result.recordset.map(r => ({
      name: r.column_name, dataType: r.data_type,
      isNullable: r.is_nullable, defaultValue: r.column_default,
      isPrimaryKey: !!r.is_primary_key, isUnique: !!r.is_unique,
      characterMaxLength: r.max_length > 0 ? r.max_length : null,
      numericPrecision: r.precision > 0 ? r.precision : null,
      comment: r.comment || null,
    }));
  }

  async getForeignKeys(table, schema) {
    const targetSchema = schema || 'dbo';
    let query = `
      SELECT fk.name as constraint_name,
        SCHEMA_NAME(tp.schema_id) as source_schema, tp.name as source_table, cp.name as source_column,
        SCHEMA_NAME(tr.schema_id) as target_schema, tr.name as target_table, cr.name as target_column,
        fk.update_referential_action_desc as on_update,
        fk.delete_referential_action_desc as on_delete
      FROM sys.foreign_keys fk
      JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
      JOIN sys.tables tp ON fkc.parent_object_id = tp.object_id
      JOIN sys.columns cp ON fkc.parent_object_id = cp.object_id AND fkc.parent_column_id = cp.column_id
      JOIN sys.tables tr ON fkc.referenced_object_id = tr.object_id
      JOIN sys.columns cr ON fkc.referenced_object_id = cr.object_id AND fkc.referenced_column_id = cr.column_id
      WHERE SCHEMA_NAME(tp.schema_id) = '${targetSchema.replace(/'/g, "''")}'`;
    if (table) query += ` AND tp.name = '${table.replace(/'/g, "''")}'`;
    query += ` ORDER BY tp.name, fk.name`;
    const result = await this._query(query);
    return result.recordset.map(r => ({
      constraintName: r.constraint_name,
      sourceSchema: r.source_schema, sourceTable: r.source_table, sourceColumn: r.source_column,
      targetSchema: r.target_schema, targetTable: r.target_table, targetColumn: r.target_column,
      onUpdate: r.on_update, onDelete: r.on_delete,
    }));
  }

  async getIndexes(table, schema) {
    const targetSchema = schema || 'dbo';
    const result = await this._query(
      `SELECT i.name as index_name, t.name as table_name,
        STRING_AGG(c.name, ',') WITHIN GROUP (ORDER BY ic.key_ordinal) as columns,
        i.is_unique, i.is_primary_key, i.type_desc
      FROM sys.indexes i
      JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
      JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
      JOIN sys.tables t ON i.object_id = t.object_id
      JOIN sys.schemas s ON t.schema_id = s.schema_id
      WHERE s.name = '${targetSchema.replace(/'/g, "''")}' AND t.name = '${table.replace(/'/g, "''")}'
        AND i.name IS NOT NULL
      GROUP BY i.name, t.name, i.is_unique, i.is_primary_key, i.type_desc
      ORDER BY i.name`
    );
    return result.recordset.map(r => ({
      name: r.index_name, tableName: r.table_name, columns: r.columns.split(','),
      isUnique: r.is_unique, isPrimary: r.is_primary_key, type: r.type_desc,
    }));
  }

  async executeQuery(query, limit = 100) {
    this.validateReadOnly(query);
    const effectiveLimit = Math.min(limit, 100);
    // SQL Server uses TOP instead of LIMIT
    const limitedSql = `SELECT TOP ${effectiveLimit} * FROM (${query}) AS _q`;
    const start = Date.now();
    const result = await this._query(limitedSql);
    return {
      columns: result.recordset.columns ? Object.keys(result.recordset.columns) : (result.recordset.length > 0 ? Object.keys(result.recordset[0]) : []),
      rows: result.recordset,
      rowCount: result.recordset.length,
      executionTimeMs: Date.now() - start,
    };
  }

  async explainQuery(query) {
    this.validateReadOnly(query);
    // SQL Server uses SET SHOWPLAN_TEXT for query plans
    await this._query('SET SHOWPLAN_TEXT ON');
    const result = await this._query(query);
    await this._query('SET SHOWPLAN_TEXT OFF');
    const planText = result.recordset.map(r => Object.values(r)[0]).join('\n');
    return { plan: planText, estimatedCost: null, estimatedRows: null };
  }

  async getSampleData(table, schema, limit = 10) {
    const targetSchema = schema || 'dbo';
    const effectiveLimit = Math.min(limit, 50);
    const quotedSchema = `[${targetSchema.replace(/\]/g, ']]')}]`;
    const quotedTable = `[${table.replace(/\]/g, ']]')}]`;
    const start = Date.now();
    const result = await this._query(`SELECT TOP ${effectiveLimit} * FROM ${quotedSchema}.${quotedTable}`);
    return {
      columns: result.recordset.length > 0 ? Object.keys(result.recordset[0]) : [],
      rows: result.recordset,
      rowCount: result.recordset.length,
      executionTimeMs: Date.now() - start,
    };
  }

  async searchColumns(pattern) {
    const result = await this._query(
      `SELECT TOP 50 s.name as table_schema, t.name as table_name, c.name as column_name, ty.name as data_type
       FROM sys.columns c
       JOIN sys.tables t ON c.object_id = t.object_id
       JOIN sys.schemas s ON t.schema_id = s.schema_id
       JOIN sys.types ty ON c.user_type_id = ty.user_type_id
       WHERE c.name LIKE '%${pattern.replace(/'/g, "''")}%' OR t.name LIKE '%${pattern.replace(/'/g, "''")}%'
       ORDER BY s.name, t.name, c.name`
    );
    return result.recordset.map(r => ({
      schema: r.table_schema, table: r.table_name, column: r.column_name, dataType: r.data_type,
    }));
  }
}
