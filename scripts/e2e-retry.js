// Retry the 3 calls that used the wrong arg name.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

const client = new Client({ name: 'mcp-retry', version: '1.0.0' }, { capabilities: {} });
await client.connect(new SSEClientTransport(new URL('http://localhost:3100/sse')));

async function call(name, args) {
  console.log(`\n─── tools/call: ${name} ───`);
  console.log(`   args: ${JSON.stringify(args)}`);
  const res = await client.callTool({ name, arguments: args });
  console.log(res.content?.[0]?.text ?? '(no content)');
}

await call('execute_query', {
  sql: "SELECT u.full_name, COUNT(o.id) AS orders FROM users u LEFT JOIN orders o ON o.user_id = u.id GROUP BY u.id, u.full_name ORDER BY orders DESC",
});

await call('explain_query', {
  sql: "SELECT * FROM users WHERE email = 'alice@example.com'",
});

await call('execute_query', { sql: 'DELETE FROM users' });

await client.close();
