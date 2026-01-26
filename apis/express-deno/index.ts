import express from 'express';
import { Database } from '@db/sqlite';

const app = express();
const PORT = Number(Deno.env.get('PORT')) || 3000;

app.use(express.json());

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
app.get('/health', (_req: express.Request, res: express.Response) => {
  res.json({
    status: 'ok',
    framework: 'express',
    runtime: 'deno',
    timestamp: Date.now()
  });
});

// Get user by ID
app.get('/users/:id', (req: express.Request, res: express.Response) => {
  const user = getUser.get(req.params.id);
  if (user) {
    res.json(user);
  } else {
    res.status(404).json({ error: 'User not found' });
  }
});

// Get all users
app.get('/users', (_req: express.Request, res: express.Response) => {
  const users = getAllUsers.all();
  res.json(users);
});

// Create new user
app.post('/users', (req: express.Request, res: express.Response) => {
  const { name, email } = req.body;
  if (!name || !email) {
    res.status(400).json({ error: 'Name and email are required' });
    return;
  }

  const result = insertUser.run(name, email);
  const user = getUser.get(result.lastInsertRowId);
  res.status(201).json(user);
});

app.listen(PORT, () => {
  console.log(`Express (Deno) server running on port ${PORT}`);
});
