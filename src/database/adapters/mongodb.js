import { MongoClient } from 'mongodb';
import { BaseAdapter } from '../base-adapter.js';

export class MongoDBAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.client = null;
    this.db = null;
  }

  async connect() {
    const uri = this.config.options?.uri ||
      `mongodb://${this.config.user ? `${this.config.user}:${this.config.password}@` : ''}${this.config.host}:${this.config.port || 27017}/${this.config.database}`;

    this.client = new MongoClient(uri);
    await this.client.connect();
    this.db = this.client.db(this.config.database);
    this._connected = true;
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
      this._connected = false;
    }
  }

  async listSchemas() {
    // MongoDB: list all databases
    const admin = this.client.db().admin();
    const result = await admin.listDatabases();
    return result.databases.map(d => d.name).filter(n => !['admin', 'local', 'config'].includes(n));
  }

  async listTables(schema) {
    const db = schema ? this.client.db(schema) : this.db;
    const collections = await db.listCollections().toArray();
    const result = [];
    for (const col of collections) {
      let count = null;
      try { count = await db.collection(col.name).estimatedDocumentCount(); } catch { /* ignore */ }
      result.push({
        schema: db.databaseName,
        name: col.name,
        type: 'collection',
        rowCount: count,
        comment: null,
      });
    }
    return result;
  }

  async getColumns(table, schema) {
    // MongoDB: infer fields from a sample of documents
    const db = schema ? this.client.db(schema) : this.db;
    const sample = await db.collection(table).find().limit(20).toArray();

    const fieldMap = new Map();
    for (const doc of sample) {
      this._extractFields(doc, '', fieldMap);
    }

    return Array.from(fieldMap.entries()).map(([name, types]) => ({
      name,
      dataType: [...types].join(' | '),
      isNullable: true,
      defaultValue: null,
      isPrimaryKey: name === '_id',
      isUnique: name === '_id',
      characterMaxLength: null,
      numericPrecision: null,
      comment: null,
    }));
  }

  _extractFields(obj, prefix, fieldMap) {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      const type = Array.isArray(value) ? 'array' : (value === null ? 'null' : typeof value);

      if (!fieldMap.has(fullKey)) fieldMap.set(fullKey, new Set());
      fieldMap.get(fullKey).add(type);

      // Go one level deep into objects (not arrays)
      if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date) && key !== '_id') {
        this._extractFields(value, fullKey, fieldMap);
      }
    }
  }

  async getForeignKeys(table, schema) {
    // MongoDB has no foreign keys
    return [];
  }

  async getIndexes(table, schema) {
    const db = schema ? this.client.db(schema) : this.db;
    const indexes = await db.collection(table).indexes();
    return indexes.map(idx => ({
      name: idx.name,
      tableName: table,
      columns: Object.keys(idx.key),
      isUnique: !!idx.unique,
      isPrimary: idx.name === '_id_',
      type: Object.values(idx.key).includes('text') ? 'text' : 'btree',
    }));
  }

  async executeQuery(query, limit = 100) {
    // MongoDB query format: { collection: "name", filter: {}, projection: {}, sort: {} }
    let parsed;
    try {
      parsed = JSON.parse(query);
    } catch {
      throw new Error('MongoDB queries must be JSON: { "collection": "name", "filter": {}, "projection": {}, "sort": {}, "limit": 10 }');
    }

    const collection = parsed.collection;
    if (!collection) throw new Error('MongoDB query must include "collection" field');

    const effectiveLimit = Math.min(parsed.limit || limit, 100);
    const start = Date.now();

    const cursor = this.db.collection(collection)
      .find(parsed.filter || {})
      .project(parsed.projection || {});

    if (parsed.sort) cursor.sort(parsed.sort);
    cursor.limit(effectiveLimit);

    const rows = await cursor.toArray();
    // Serialize ObjectId and Date for JSON output
    const serialized = rows.map(r => JSON.parse(JSON.stringify(r)));

    return {
      columns: serialized.length > 0 ? Object.keys(serialized[0]) : [],
      rows: serialized,
      rowCount: serialized.length,
      executionTimeMs: Date.now() - start,
    };
  }

  async explainQuery(query) {
    let parsed;
    try { parsed = JSON.parse(query); } catch {
      return { plan: 'Invalid JSON query', estimatedCost: null, estimatedRows: null };
    }
    const collection = parsed.collection;
    if (!collection) return { plan: 'Missing collection field', estimatedCost: null, estimatedRows: null };

    const explanation = await this.db.collection(collection)
      .find(parsed.filter || {})
      .explain('executionStats');

    return {
      plan: JSON.stringify(explanation, null, 2),
      estimatedCost: null,
      estimatedRows: explanation.executionStats?.nReturned || null,
    };
  }

  async getSampleData(table, schema, limit = 10) {
    const db = schema ? this.client.db(schema) : this.db;
    const effectiveLimit = Math.min(limit, 50);
    const start = Date.now();
    const rows = await db.collection(table).find().limit(effectiveLimit).toArray();
    const serialized = rows.map(r => JSON.parse(JSON.stringify(r)));
    return {
      columns: serialized.length > 0 ? Object.keys(serialized[0]) : [],
      rows: serialized,
      rowCount: serialized.length,
      executionTimeMs: Date.now() - start,
    };
  }

  async searchColumns(pattern) {
    // Search across all collections for matching field names
    const collections = await this.db.listCollections().toArray();
    const results = [];
    const lowerPattern = pattern.toLowerCase();

    for (const col of collections) {
      if (results.length >= 50) break;
      const sample = await this.db.collection(col.name).find().limit(5).toArray();
      const fieldMap = new Map();
      for (const doc of sample) {
        this._extractFields(doc, '', fieldMap);
      }
      for (const [fieldName, types] of fieldMap) {
        if (fieldName.toLowerCase().includes(lowerPattern) || col.name.toLowerCase().includes(lowerPattern)) {
          results.push({ schema: this.db.databaseName, table: col.name, column: fieldName, dataType: [...types].join('|') });
        }
      }
    }
    return results.slice(0, 50);
  }

  /**
   * Override read-only validation for MongoDB (uses JSON, not SQL)
   */
  validateReadOnly(query) {
    // MongoDB adapter only does finds, no mutation operations exposed
  }
}
