import { Elysia } from 'elysia';
import { Database } from '@db/sqlite';

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

const app = new Elysia()
  // Health check endpoint
  .get('/health', () => ({
    status: 'ok',
    framework: 'elysia',
    runtime: 'deno',
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
    const user = getUser.get(result.lastInsertRowId);
    set.status = 201;
    return user;
  });

console.log(`Elysia (Deno) server running on port ${PORT}`);

// Use Deno.serve as Elysia's native server doesn't work in Deno
Deno.serve({ port: PORT }, app.fetch);
