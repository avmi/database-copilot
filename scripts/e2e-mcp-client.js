// End-to-end test: connects to the running MCP SSE server using the official
// MCP client SDK, lists tools, and invokes representative ones.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

const SSE_URL = new URL('http://localhost:3100/sse');

const client = new Client(
  { name: 'mcp-e2e-tester', version: '1.0.0' },
  { capabilities: {} }
);

const transport = new SSEClientTransport(SSE_URL);
await client.connect(transport);
console.log('═══ Connected to MCP server over SSE ═══\n');

const { tools } = await client.listTools();
console.log(`✓ Discovered ${tools.length} tools:`);
for (const t of tools) console.log(`   • ${t.name} — ${t.description?.slice(0, 80) || ''}`);

async function call(name, args = {}) {
  console.log(`\n─── tools/call: ${name} ───`);
  console.log(`   args: ${JSON.stringify(args)}`);
  const res = await client.callTool({ name, arguments: args });
  const text = res.content?.[0]?.text ?? '(no content)';
  const truncated = text.length > 1500 ? text.slice(0, 1500) + '\n...[truncated]' : text;
  console.log(truncated);
}

await call('list_connections');
await call('list_tables');
await call('describe_table', { table: 'orders' });
await call('get_relationships', {});
await call('schema_overview', {});
await call('sample_data', { table: 'products', limit: 3 });
await call('execute_query', {
  query: "SELECT u.full_name, COUNT(o.id) AS orders FROM users u LEFT JOIN orders o ON o.user_id = u.id GROUP BY u.id, u.full_name ORDER BY orders DESC",
});
await call('explain_query', { query: "SELECT * FROM users WHERE email = 'alice@example.com'" });
await call('search_schema', { pattern: 'user' });
await call('suggest_indexes', { table: 'orders' });

await call('execute_query', { query: 'DELETE FROM users' }).catch(e => {
  console.log(`   (expected) write blocked: ${e.message}`);
});

await client.close();
console.log('\n═══ End-to-end MCP test complete ═══');
