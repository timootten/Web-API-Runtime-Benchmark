import { Elysia } from 'elysia';
import { Database } from 'bun:sqlite';

const PORT = Number(process.env.PORT) || 3000;

// Initialize SQLite database using Bun's native SQLite
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
    runtime: 'bun',
    timestamp: Date.now()
  }))

  // Get all users
  .get('/users', () => {
    return getAllUsers.all();
  })

  // Get user by ID
  .get('/users/:id', ({ params }) => {
    const user = getUser.get(params.id);
    if (user) {
      return user;
    }
    return new Response(JSON.stringify({ error: 'User not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  })

  // Create new user
  .post('/users', ({ body }) => {
    const { name, email } = body as { name: string; email: string };
    if (!name || !email) {
      return new Response(JSON.stringify({ error: 'Name and email are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    insertUser.run(name, email);
    const lastId = db.query('SELECT last_insert_rowid() as id').get() as { id: number };
    return new Response(JSON.stringify({
      id: lastId.id,
      name,
      email
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  })

  .listen(PORT);

console.log(`Elysia (Bun) server running on port ${PORT}`);
