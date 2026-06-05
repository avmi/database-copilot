/**
 * Adapter Registry - Maps database type names to their adapter classes.
 *
 * To add a new database adapter:
 *   1. Create a file in this directory (e.g., oracle.js)
 *   2. Export a class extending BaseAdapter
 *   3. Import and register it in the ADAPTERS map below
 */

import { PostgresAdapter } from './postgresql.js';
import { MySQLAdapter } from './mysql.js';
import { MariaDBAdapter } from './mariadb.js';
import { SQLServerAdapter } from './sqlserver.js';
import { SQLiteAdapter } from './sqlite.js';
import { MongoDBAdapter } from './mongodb.js';
import { CSVAdapter } from './csv.js';

/**
 * Registry of all available database adapters.
 * Key: the type string used in config (DB_x_TYPE env var)
 * Value: the adapter class (must extend BaseAdapter)
 */
export const ADAPTERS = new Map([
  ['postgresql', PostgresAdapter],
  ['postgres', PostgresAdapter],   // alias
  ['pg', PostgresAdapter],         // alias
  ['mysql', MySQLAdapter],
  ['mariadb', MariaDBAdapter],
  ['sqlserver', SQLServerAdapter],
  ['mssql', SQLServerAdapter],     // alias
  ['sqlite', SQLiteAdapter],
  ['sqlite3', SQLiteAdapter],      // alias
  ['mongodb', MongoDBAdapter],
  ['mongo', MongoDBAdapter],       // alias
  ['csv', CSVAdapter],
]);

/**
 * Get an adapter class by type name.
 * @param {string} type
 * @returns {typeof import('../database/base-adapter.js').BaseAdapter | undefined}
 */
export function getAdapterClass(type) {
  return ADAPTERS.get(type.toLowerCase());
}

/**
 * List all supported database types.
 * @returns {string[]}
 */
export function getSupportedTypes() {
  // Return unique types (no aliases)
  return ['postgresql', 'mysql', 'mariadb', 'sqlserver', 'sqlite', 'mongodb', 'csv'];
}
