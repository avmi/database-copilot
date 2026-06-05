// Creates a sample SQLite database with seed data for testing the MCP server.
// Usage: node scripts/setup-test-db.js
import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, '../test-data');
mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'sample.db');
const db = new Database(dbPath);

db.exec(`
  DROP TABLE IF EXISTS order_items;
  DROP TABLE IF EXISTS orders;
  DROP TABLE IF EXISTS products;
  DROP TABLE IF EXISTS users;

  CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL DEFAULT 'active'
  );

  CREATE TABLE products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    total REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price REAL NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
  );

  CREATE INDEX idx_users_email ON users(email);
  CREATE INDEX idx_orders_user_id ON orders(user_id);
`);

const insertUser = db.prepare('INSERT INTO users (email, full_name, status) VALUES (?, ?, ?)');
insertUser.run('alice@example.com', 'Alice Anderson', 'active');
insertUser.run('bob@example.com', 'Bob Brown', 'active');
insertUser.run('charlie@example.com', 'Charlie Chen', 'inactive');

const insertProduct = db.prepare('INSERT INTO products (name, price, stock) VALUES (?, ?, ?)');
const widget = insertProduct.run('Widget', 9.99, 100);
const gadget = insertProduct.run('Gadget', 19.99, 50);
const gizmo = insertProduct.run('Gizmo', 29.99, 25);

const insertOrder = db.prepare('INSERT INTO orders (user_id, total, status) VALUES (?, ?, ?)');
const order1 = insertOrder.run(1, 29.98, 'completed');
const order2 = insertOrder.run(1, 19.99, 'completed');
const order3 = insertOrder.run(2, 49.97, 'pending');

const insertItem = db.prepare('INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)');
insertItem.run(order1.lastInsertRowid, widget.lastInsertRowid, 2, 9.99);
insertItem.run(order1.lastInsertRowid, widget.lastInsertRowid, 1, 9.99);
insertItem.run(order2.lastInsertRowid, gadget.lastInsertRowid, 1, 19.99);
insertItem.run(order3.lastInsertRowid, gizmo.lastInsertRowid, 1, 29.99);
insertItem.run(order3.lastInsertRowid, gadget.lastInsertRowid, 1, 19.99);

db.close();
console.log(`Created sample DB at: ${dbPath}`);
console.log('Tables: users (3), products (3), orders (3), order_items (5)');
