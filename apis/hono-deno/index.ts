import { Hono } from 'hono';
import { Database } from '@db/sqlite';

const app = new Hono();
const PORT = Number(Deno.env.get('PORT')) || 3000;

// Initialize SQLite database
const db = new Database(':memory:');
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Prepare statements for better performance
const insertUser = db.prepare('INSERT INTO users (name, email) VALUES (?, ?)');
const getUser = db.prepare('SELECT * FROM users WHERE id = ?');
const getAllUsers = db.prepare('SELECT * FROM users LIMIT 100');

// Seed some initial data
for (let i = 1; i <= 100; i++) {
  insertUser.run(`User ${i}`, `user${i}@example.com`);
}

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    framework: 'hono',
    runtime: 'deno',
    timestamp: Date.now()
  });
});

// Get user by ID
app.get('/users/:id', (c) => {
  const user = getUser.get(c.req.param('id'));
  if (user) {
    return c.json(user);
  }
  return c.json({ error: 'User not found' }, 404);
});

// Get all users
app.get('/users', (c) => {
  const users = getAllUsers.all();
  return c.json(users);
});

// Create new user
app.post('/users', async (c) => {
  const { name, email } = await c.req.json();
  if (!name || !email) {
    return c.json({ error: 'Name and email are required' }, 400);
  }

  insertUser.run(name, email);
  const user = getUser.get(db.lastInsertRowId);
  return c.json(user, 201);
});

console.log(`Hono (Deno) server running on port ${PORT}`);
Deno.serve({ port: PORT }, app.fetch);
