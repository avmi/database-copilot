// Smoke test: exercises the SQLite adapter directly (without MCP transport)
// to verify all tools work end-to-end.
import { ConnectionManager } from '../src/database/connection-manager.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, '../test-data/sample.db');

const cm = new ConnectionManager();

console.log('═══ MCP Database Copilot — Smoke Test ═══\n');

await cm.addConnection({ type: 'sqlite', database: dbPath });
const adapter = cm.getDefaultConnection();

console.log('1. list_connections:');
console.log(JSON.stringify(cm.listConnections(), null, 2));

console.log('\n2. listSchemas:');
console.log(await adapter.listSchemas());

console.log('\n3. listTables:');
console.log(await adapter.listTables());

console.log('\n4. getColumns(users):');
console.log(await adapter.getColumns('users'));

console.log('\n5. getForeignKeys(orders):');
console.log(await adapter.getForeignKeys('orders'));

console.log('\n6. getIndexes(users):');
console.log(await adapter.getIndexes('users'));

console.log('\n7. getSampleData(users, 2):');
console.log(JSON.stringify(await adapter.getSampleData('users', undefined, 2), null, 2));

console.log('\n8. searchColumns("email"):');
console.log(await adapter.searchColumns('email'));

console.log('\n9. executeQuery (top customers by total):');
const result = await adapter.executeQuery(
  `SELECT u.email, COUNT(o.id) AS order_count, SUM(o.total) AS total_spent
   FROM users u
   JOIN orders o ON o.user_id = u.id
   WHERE o.status = 'completed'
   GROUP BY u.id, u.email
   ORDER BY total_spent DESC`
);
console.log(JSON.stringify(result, null, 2));

console.log('\n10. explainQuery:');
const plan = await adapter.explainQuery("SELECT * FROM users WHERE email = 'alice@example.com'");
console.log(plan);

console.log('\n11. validateReadOnly should reject DELETE:');
try {
  await adapter.executeQuery('DELETE FROM users');
  console.log('  ❌ FAIL: should have rejected');
} catch (e) {
  console.log(`  ✓ rejected: ${e.message}`);
}

await cm.disconnectAll();
console.log('\n═══ All smoke tests passed ═══');
