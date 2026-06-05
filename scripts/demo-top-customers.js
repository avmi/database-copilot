import { ConnectionManager } from '../src/database/connection-manager.js';

const cm = new ConnectionManager();
await cm.addConnection({ type: 'sqlite', database: './test-data/sample.db' });
const a = cm.getDefaultConnection();

const sql = `
  SELECT
    u.full_name,
    u.email,
    COUNT(o.id)                 AS order_count,
    COALESCE(SUM(o.total), 0)   AS total_spent
  FROM users u
  LEFT JOIN orders o ON o.user_id = u.id
  GROUP BY u.id, u.full_name, u.email
  ORDER BY total_spent DESC
`;

const r = await a.executeQuery(sql);
console.table(r.rows);
console.log(`Rows: ${r.rowCount} | Time: ${r.executionTimeMs}ms`);
await cm.disconnectAll();
