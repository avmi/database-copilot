import { parse } from 'csv-parse/sync';
import { readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';
import { BaseAdapter } from '../base-adapter.js';

/**
 * CSV Adapter - treats a directory of CSV files as a database.
 * Each .csv file = one table.
 * config.database = path to directory containing CSV files.
 */
export class CSVAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    /** @type {Map<string, {columns: string[], rows: Record<string, unknown>[]}>} */
    this.tables = new Map();
  }

  async connect() {
    const dirPath = this.config.database || this.config.host;
    const files = readdirSync(dirPath).filter(f => f.toLowerCase().endsWith('.csv'));

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stat = statSync(filePath);
      if (stat.size > 50 * 1024 * 1024) continue; // Skip files > 50MB

      const content = readFileSync(filePath, 'utf-8');
      const records = parse(content, { columns: true, skip_empty_lines: true, trim: true });
      const tableName = path.basename(file, '.csv');
      const columns = records.length > 0 ? Object.keys(records[0]) : [];
      this.tables.set(tableName, { columns, rows: records });
    }

    this._connected = true;
  }

  async disconnect() {
    this.tables.clear();
    this._connected = false;
  }

  getDatabaseName() {
    return path.basename(this.config.database || this.config.host);
  }

  async listSchemas() {
    return ['files'];
  }

  async listTables(schema) {
    const result = [];
    for (const [name, data] of this.tables) {
      result.push({
        schema: 'files',
        name,
        type: 'table',
        rowCount: data.rows.length,
        comment: null,
      });
    }
    return result;
  }

  async getColumns(table, schema) {
    const data = this.tables.get(table);
    if (!data) throw new Error(`Table/file not found: ${table}`);

    // Infer types from first 100 rows
    return data.columns.map(col => {
      let inferredType = 'text';
      const sample = data.rows.slice(0, 100);
      const values = sample.map(r => r[col]).filter(v => v !== '' && v != null);

      if (values.length > 0) {
        if (values.every(v => !isNaN(Number(v)) && !isNaN(parseFloat(v)))) {
          inferredType = values.every(v => Number.isInteger(Number(v))) ? 'integer' : 'float';
        } else if (values.every(v => /^\d{4}-\d{2}-\d{2}/.test(String(v)))) {
          inferredType = 'date';
        } else if (values.every(v => /^(true|false|yes|no|1|0)$/i.test(String(v)))) {
          inferredType = 'boolean';
        }
      }

      return {
        name: col,
        dataType: inferredType,
        isNullable: true,
        defaultValue: null,
        isPrimaryKey: false,
        isUnique: false,
        characterMaxLength: null,
        numericPrecision: null,
        comment: null,
      };
    });
  }

  async getForeignKeys(table, schema) {
    return []; // CSV has no relationships
  }

  async getIndexes(table, schema) {
    return []; // CSV has no indexes
  }

  async executeQuery(query, limit = 100) {
    // Simple query parser for CSV: supports "SELECT * FROM table WHERE col = 'val'" style
    const effectiveLimit = Math.min(limit, 100);
    const start = Date.now();

    // Parse basic SELECT ... FROM tablename [WHERE col op val] [LIMIT n]
    const match = query.trim().match(/^select\s+(.+?)\s+from\s+(\w+)(?:\s+where\s+(.+?))?(?:\s+limit\s+(\d+))?$/i);
    if (!match) {
      throw new Error('CSV adapter supports: SELECT columns FROM table [WHERE col = "value"] [LIMIT n]');
    }

    const [, selectCols, tableName, whereClause, limitStr] = match;
    const data = this.tables.get(tableName);
    if (!data) throw new Error(`Table not found: ${tableName}`);

    let rows = [...data.rows];

    // Apply WHERE (basic: col = 'val', col > val, col LIKE '%val%')
    if (whereClause) {
      rows = this._applyWhere(rows, whereClause);
    }

    // Apply LIMIT
    const finalLimit = Math.min(parseInt(limitStr) || effectiveLimit, effectiveLimit);
    rows = rows.slice(0, finalLimit);

    // Apply column selection
    let columns = data.columns;
    if (selectCols.trim() !== '*') {
      columns = selectCols.split(',').map(c => c.trim());
      rows = rows.map(r => {
        const filtered = {};
        for (const col of columns) { filtered[col] = r[col]; }
        return filtered;
      });
    }

    return { columns, rows, rowCount: rows.length, executionTimeMs: Date.now() - start };
  }

  _applyWhere(rows, whereClause) {
    // Support: col = 'val', col != 'val', col > val, col < val, col LIKE '%val%'
    const condMatch = whereClause.match(/^(\w+)\s*(=|!=|>|<|>=|<=|like)\s*'?([^']*)'?$/i);
    if (!condMatch) return rows;

    const [, col, op, val] = condMatch;
    return rows.filter(row => {
      const cellVal = String(row[col] || '');
      switch (op.toLowerCase()) {
        case '=': return cellVal === val;
        case '!=': return cellVal !== val;
        case '>': return Number(cellVal) > Number(val);
        case '<': return Number(cellVal) < Number(val);
        case '>=': return Number(cellVal) >= Number(val);
        case '<=': return Number(cellVal) <= Number(val);
        case 'like': {
          const pattern = val.replace(/%/g, '.*').replace(/_/g, '.');
          return new RegExp(`^${pattern}$`, 'i').test(cellVal);
        }
        default: return true;
      }
    });
  }

  async getSampleData(table, schema, limit = 10) {
    const data = this.tables.get(table);
    if (!data) throw new Error(`Table not found: ${table}`);
    const effectiveLimit = Math.min(limit, 50);
    const rows = data.rows.slice(0, effectiveLimit);
    return {
      columns: data.columns, rows,
      rowCount: rows.length, executionTimeMs: 0,
    };
  }

  async searchColumns(pattern) {
    const results = [];
    const lower = pattern.toLowerCase();
    for (const [tableName, data] of this.tables) {
      for (const col of data.columns) {
        if (col.toLowerCase().includes(lower) || tableName.toLowerCase().includes(lower)) {
          results.push({ schema: 'files', table: tableName, column: col, dataType: 'text' });
        }
      }
      if (results.length >= 50) break;
    }
    return results.slice(0, 50);
  }

  validateReadOnly(query) {
    // CSV is inherently read-only
  }
}
