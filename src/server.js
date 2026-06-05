import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import express from 'express';

import { getConfig } from './config.js';
import { ConnectionManager } from './database/connection-manager.js';
import { registerSchemaTools } from './tools/schema.js';
import { registerRelationshipTools } from './tools/relationships.js';
import { registerQueryTools } from './tools/query.js';
import { registerIndexTools } from './tools/indexes.js';

export async function createServer() {
  const config = getConfig();
  const connectionManager = new ConnectionManager();

  const server = new McpServer({
    name: 'database-copilot',
    version: '2.0.0',
  });

  // Register all tool groups
  registerSchemaTools(server, connectionManager);
  registerRelationshipTools(server, connectionManager);
  registerQueryTools(server, connectionManager);
  registerIndexTools(server, connectionManager);

  // Register resources
  server.resource(
    'database-info',
    'db://connections',
    async (uri) => ({
      contents: [{
        uri: uri.href,
        mimeType: 'application/json',
        text: JSON.stringify(connectionManager.listConnections(), null, 2),
      }],
    })
  );

  // Connect to configured databases
  for (const dbConfig of config.databases) {
    try {
      const id = await connectionManager.addConnection(dbConfig);
      console.error(`[database-copilot] ✓ Connected: ${id}`);
    } catch (error) {
      console.error(`[database-copilot] ✗ Failed to connect ${dbConfig.type}://${dbConfig.host}:${dbConfig.port}/${dbConfig.database}: ${error.message}`);
    }
  }

  return { server, connectionManager, config };
}

export async function startStdioTransport(server) {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[database-copilot] MCP server running on stdio');
}

export async function startSSETransport(server, port) {
  const app = express();
  const transports = new Map();

  app.get('/sse', async (req, res) => {
    const transport = new SSEServerTransport('/messages', res);
    transports.set(transport.sessionId, transport);
    res.on('close', () => transports.delete(transport.sessionId));
    await server.connect(transport);
  });

  app.post('/messages', async (req, res) => {
    const sessionId = req.query.sessionId;
    const transport = transports.get(sessionId);
    if (!transport) { res.status(404).json({ error: 'Session not found' }); return; }
    await transport.handlePostMessage(req, res);
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', server: 'database-copilot', version: '2.0.0' });
  });

  app.listen(port, () => {
    console.error(`[database-copilot] MCP SSE server: http://localhost:${port}`);
    console.error(`[database-copilot] SSE endpoint:   http://localhost:${port}/sse`);
    console.error(`[database-copilot] Health check:   http://localhost:${port}/health`);
  });
}
