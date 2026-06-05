import { getAdapterClass, getSupportedTypes } from './adapters/index.js';

export class ConnectionManager {
  constructor() {
    /** @type {Map<string, import('./base-adapter.js').BaseAdapter>} */
    this.connections = new Map();
  }

  /**
   * Add and connect a new database.
   * @param {object} config
   * @returns {Promise<string>} Connection ID
   */
  async addConnection(config) {
    const id = `${config.type}://${config.host || 'local'}:${config.port || 0}/${config.database}`;

    if (this.connections.has(id)) {
      return id;
    }

    const AdapterClass = getAdapterClass(config.type);
    if (!AdapterClass) {
      const supported = getSupportedTypes().join(', ');
      throw new Error(`Unsupported database type: "${config.type}". Supported: ${supported}`);
    }

    const adapter = new AdapterClass(config);
    await adapter.connect();
    this.connections.set(id, adapter);
    return id;
  }

  /**
   * @param {string} id
   * @returns {import('./base-adapter.js').BaseAdapter | undefined}
   */
  getConnection(id) {
    return this.connections.get(id);
  }

  /** @returns {import('./base-adapter.js').BaseAdapter | undefined} */
  getDefaultConnection() {
    const first = this.connections.values().next();
    return first.done ? undefined : first.value;
  }

  /** List all connections with status */
  listConnections() {
    const result = [];
    for (const [id, adapter] of this.connections) {
      result.push({
        id,
        database: adapter.getDatabaseName(),
        type: adapter.getType(),
        connected: adapter.isConnected(),
      });
    }
    return result;
  }

  /** Disconnect all databases */
  async disconnectAll() {
    for (const adapter of this.connections.values()) {
      await adapter.disconnect();
    }
    this.connections.clear();
  }

  /**
   * Get adapter by connection ID or return the default.
   * @param {string} [connectionId]
   * @returns {import('./base-adapter.js').BaseAdapter}
   */
  getAdapter(connectionId) {
    if (connectionId) {
      const adapter = this.connections.get(connectionId);
      if (!adapter) throw new Error(`Connection not found: ${connectionId}`);
      return adapter;
    }

    const defaultAdapter = this.getDefaultConnection();
    if (!defaultAdapter) throw new Error('No database connections available. Configure a connection first.');
    return defaultAdapter;
  }
}
