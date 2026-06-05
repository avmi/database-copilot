/**
 * @typedef {Object} ColumnInfo
 * @property {string} name
 * @property {string} dataType
 * @property {boolean} isNullable
 * @property {string|null} defaultValue
 * @property {boolean} isPrimaryKey
 * @property {boolean} isUnique
 * @property {number|null} characterMaxLength
 * @property {number|null} numericPrecision
 * @property {string|null} comment
 */

/**
 * @typedef {Object} TableInfo
 * @property {string} schema
 * @property {string} name
 * @property {'table'|'view'|'collection'} type
 * @property {number|null} rowCount
 * @property {string|null} comment
 */

/**
 * @typedef {Object} ForeignKey
 * @property {string} constraintName
 * @property {string} sourceSchema
 * @property {string} sourceTable
 * @property {string} sourceColumn
 * @property {string} targetSchema
 * @property {string} targetTable
 * @property {string} targetColumn
 * @property {string} onUpdate
 * @property {string} onDelete
 */

/**
 * @typedef {Object} IndexInfo
 * @property {string} name
 * @property {string} tableName
 * @property {string[]} columns
 * @property {boolean} isUnique
 * @property {boolean} isPrimary
 * @property {string} type
 */

/**
 * @typedef {Object} QueryResult
 * @property {string[]} columns
 * @property {Record<string, unknown>[]} rows
 * @property {number} rowCount
 * @property {number} executionTimeMs
 */

/**
 * @typedef {Object} QueryPlan
 * @property {string} plan
 * @property {number|null} estimatedCost
 * @property {number|null} estimatedRows
 */

/**
 * Base adapter class that all database adapters must extend.
 * To add a new database type:
 *   1. Create a new file in src/database/adapters/ (e.g., oracle.js)
 *   2. Export a class that extends BaseAdapter
 *   3. Implement all methods marked with "Must implement"
 *   4. Register it in src/database/adapters/index.js
 *
 * @abstract
 */
export class BaseAdapter {
  /**
   * @param {object} config - Database connection configuration
   * @param {string} config.type - Database type identifier
   * @param {string} config.host - Database host
   * @param {number} config.port - Database port
   * @param {string} config.database - Database name or file path
   * @param {string} config.user - Username
   * @param {string} config.password - Password
   * @param {boolean} [config.ssl] - Whether to use SSL
   * @param {object} [config.options] - Additional driver-specific options
   */
  constructor(config) {
    if (new.target === BaseAdapter) {
      throw new Error('BaseAdapter is abstract and cannot be instantiated directly.');
    }
    this.config = config;
    this._connected = false;
  }

  // ─── Connection Lifecycle ────────────────────────────────────────

  /** Connect to the database. Must implement. */
  async connect() {
    throw new Error('connect() must be implemented by adapter');
  }

  /** Disconnect from the database. Must implement. */
  async disconnect() {
    throw new Error('disconnect() must be implemented by adapter');
  }

  /** @returns {boolean} Whether currently connected */
  isConnected() {
    return this._connected;
  }

  /** @returns {string} The database name or identifier */
  getDatabaseName() {
    return this.config.database;
  }

  /** @returns {string} The adapter type (e.g., 'postgresql', 'mysql') */
  getType() {
    return this.config.type;
  }

  // ─── Schema Inspection ───────────────────────────────────────────

  /**
   * List all schemas/databases.
   * @returns {Promise<string[]>}
   */
  async listSchemas() {
    throw new Error('listSchemas() must be implemented by adapter');
  }

  /**
   * List all tables/views/collections in a schema.
   * @param {string} [schema]
   * @returns {Promise<TableInfo[]>}
   */
  async listTables(schema) {
    throw new Error('listTables() must be implemented by adapter');
  }

  /**
   * Get column information for a table.
   * @param {string} table
   * @param {string} [schema]
   * @returns {Promise<ColumnInfo[]>}
   */
  async getColumns(table, schema) {
    throw new Error('getColumns() must be implemented by adapter');
  }

  /**
   * Get foreign key relationships.
   * @param {string} [table] - Specific table, or all if omitted
   * @param {string} [schema]
   * @returns {Promise<ForeignKey[]>}
   */
  async getForeignKeys(table, schema) {
    // Default: no foreign keys (for non-relational DBs)
    return [];
  }

  /**
   * Get indexes for a table.
   * @param {string} table
   * @param {string} [schema]
   * @returns {Promise<IndexInfo[]>}
   */
  async getIndexes(table, schema) {
    // Default: no indexes (override in relational adapters)
    return [];
  }

  // ─── Query Execution ─────────────────────────────────────────────

  /**
   * Execute a read-only query.
   * @param {string} query - SQL or query string
   * @param {number} [limit=100] - Max rows to return
   * @returns {Promise<QueryResult>}
   */
  async executeQuery(query, limit = 100) {
    throw new Error('executeQuery() must be implemented by adapter');
  }

  /**
   * Explain a query's execution plan.
   * @param {string} query
   * @returns {Promise<QueryPlan>}
   */
  async explainQuery(query) {
    // Default: not supported
    return { plan: 'EXPLAIN not supported for this database type', estimatedCost: null, estimatedRows: null };
  }

  /**
   * Get sample data from a table/collection.
   * @param {string} table
   * @param {string} [schema]
   * @param {number} [limit=10]
   * @returns {Promise<QueryResult>}
   */
  async getSampleData(table, schema, limit = 10) {
    throw new Error('getSampleData() must be implemented by adapter');
  }

  // ─── Search ──────────────────────────────────────────────────────

  /**
   * Search for columns/fields matching a pattern.
   * @param {string} pattern
   * @returns {Promise<Array<{schema: string, table: string, column: string, dataType: string}>>}
   */
  async searchColumns(pattern) {
    throw new Error('searchColumns() must be implemented by adapter');
  }

  // ─── Helpers ─────────────────────────────────────────────────────

  /**
   * Validate that a query is read-only (SELECT/WITH only for SQL databases).
   * Override if your database uses a different query language.
   * @param {string} query
   * @throws {Error} if query is not read-only
   */
  validateReadOnly(query) {
    const normalized = query.trim().toLowerCase();
    const allowed = ['select', 'with', 'explain', 'show', 'describe', 'desc'];
    const startsWithAllowed = allowed.some(prefix => normalized.startsWith(prefix));
    if (!startsWithAllowed) {
      throw new Error('Only read-only queries are allowed (SELECT, WITH, EXPLAIN, SHOW, DESCRIBE).');
    }
  }
}
