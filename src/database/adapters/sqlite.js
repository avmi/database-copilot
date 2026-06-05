import Database from 'better-sqlite3';
import { BaseAdapter } from '../base-adapter.js';
import path from 'path';

export class SQLiteAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.db = null;
  }

  async connect() {
    const dbPath = this.config.database || this.config.host; // database can be a file path
    this.db = new Database(dbPath, { readonly: true });
    this._connected = true;
  }

  async disconnect() {
    if (this.db) {
      this.db.close();
      this.db = null;
      this._connected = false;
    }
  }

  getDatabaseName() {
    return path.basename(this.config.database || this.config.host);
  }

  async listSchemas() {
    // SQLite doesn't have schemas, return 'main'
    return ['main'];
  }

  async listTables(schema) {
    const rows = this.db.prepare(
      `SELECT name, type FROM sqlite_master
       WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%'
       ORDER BY name`
    ).all();
    return rows.map(r => ({
      schema: 'main', name: r.name,
      type: r.type === 'table' ? 'table' : 'view',
      rowCount: null, comment: null,
    }));
  }

  async getColumns(table, schema) {
    const rows = this.db.prepare(`PRAGMA table_info("${table.replace(/"/g, '""')}")`).all();
    return rows.map(r => ({
      name: r.name,
      dataType: r.type || 'TEXT',
      isNullable: !r.notnull,
      defaultValue: r.dflt_value,
      isPrimaryKey: !!r.pk,
      isUnique: false, // Would need to parse indexes
      characterMaxLength: null,
      numericPrecision: null,
      comment: null,
    }));
  }

  async getForeignKeys(table, schema) {
    if (!table) {
      // Get FKs for all tables
      const tables = await this.listTables();
      const allFks = [];
      for (const t of tables) {
        const fks = await this.getForeignKeys(t.name);
        allFks.push(...fks);
      }
      return allFks;
    }
    const rows = this.db.prepare(`PRAGMA foreign_key_list("${table.replace(/"/g, '""')}")`).all();
    return rows.map(r => ({
      constraintName: `fk_${table}_${r.from}`,
      sourceSchema: 'main', sourceTable: table, sourceColumn: r.from,
      targetSchema: 'main', targetTable: r.table, targetColumn: r.to,
      onUpdate: r.on_update, onDelete: r.on_delete,
    }));
  }

  async getIndexes(table, schema) {
    const indexes = this.db.prepare(`PRAGMA index_list("${table.replace(/"/g, '""')}")`).all();
    const result = [];
    for (const idx of indexes) {
      const cols = this.db.prepare(`PRAGMA index_info("${idx.name.replace(/"/g, '""')}")`).all();
      result.push({
        name: idx.name,
        tableName: table,
        columns: cols.map(c => c.name),
        isUnique: !!idx.unique,
        isPrimary: idx.origin === 'pk',
        type: 'btree',
      });
    }
    return result;
  }

  async executeQuery(query, limit = 100) {
    this.validateReadOnly(query);
    const effectiveLimit = Math.min(limit, 100);
    const limitedSql = `SELECT * FROM (${query}) LIMIT ${effectiveLimit}`;
    const start = Date.now();
    const rows = this.db.prepare(limitedSql).all();
    return {
      columns: rows.length > 0 ? Object.keys(rows[0]) : [],
      rows,
      rowCount: rows.length,
      executionTimeMs: Date.now() - start,
    };
  }

  async explainQuery(query) {
    this.validateReadOnly(query);
    const rows = this.db.prepare(`EXPLAIN QUERY PLAN ${query}`).all();
    const planText = rows.map(r => `${r.id}|${r.parent}|${r.notused}|${r.detail}`).join('\n');
    return { plan: planText, estimatedCost: null, estimatedRows: null };
  }

  async getSampleData(table, schema, limit = 10) {
    const effectiveLimit = Math.min(limit, 50);
    const quotedTable = `"${table.replace(/"/g, '""')}"`;
    const start = Date.now();
    const rows = this.db.prepare(`SELECT * FROM ${quotedTable} LIMIT ${effectiveLimit}`).all();
    return {
      columns: rows.length > 0 ? Object.keys(rows[0]) : [],
      rows,
      rowCount: rows.length,
      executionTimeMs: Date.now() - start,
    };
  }

  async searchColumns(pattern) {
    const tables = await this.listTables();
    const results = [];
    for (const t of tables) {
      const columns = await this.getColumns(t.name);
      for (const col of columns) {
        if (col.name.toLowerCase().includes(pattern.toLowerCase()) ||
            t.name.toLowerCase().includes(pattern.toLowerCase())) {
          results.push({ schema: 'main', table: t.name, column: col.name, dataType: col.dataType });
        }
      }
      if (results.length >= 50) break;
    }
    return results.slice(0, 50);
  }
}
