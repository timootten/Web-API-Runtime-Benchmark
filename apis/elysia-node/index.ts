import { Elysia } from 'elysia';
import { node } from '@elysiajs/node';
import Database from 'better-sqlite3';

const PORT = Number(process.env.PORT) || 3000;

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

const app = new Elysia({ adapter: node() })
  // Health check endpoint
  .get('/health', () => ({
    status: 'ok',
    framework: 'elysia',
    runtime: 'node',
    timestamp: Date.now()
  }))

  // Get all users
  .get('/users', () => {
    return getAllUsers.all();
  })

  // Get user by ID
  .get('/users/:id', ({ params, set }) => {
    const user = getUser.get(params.id);
    if (user) {
      return user;
    }
    set.status = 404;
    return { error: 'User not found' };
  })

  // Create new user
  .post('/users', ({ body, set }) => {
    const { name, email } = body as { name: string; email: string };
    if (!name || !email) {
      set.status = 400;
      return { error: 'Name and email are required' };
    }

    const result = insertUser.run(name, email);
    set.status = 201;
    return {
      id: result.lastInsertRowid,
      name,
      email
    };
  })

  .listen(PORT);

console.log(`Elysia (Node.js) server running on port ${PORT}`);
