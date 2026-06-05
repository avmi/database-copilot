import { createServer, startStdioTransport, startSSETransport } from './server.js';

async function main() {
  try {
    const { server, config } = await createServer();

    if (config.transport === 'stdio') {
      await startStdioTransport(server);
    } else {
      await startSSETransport(server, config.port);
    }

    process.on('SIGINT', () => { console.error('[database-copilot] Shutting down...'); process.exit(0); });
    process.on('SIGTERM', () => { console.error('[database-copilot] Shutting down...'); process.exit(0); });
  } catch (error) {
    console.error('[database-copilot] Fatal error:', error);
    process.exit(1);
  }
}

main();
