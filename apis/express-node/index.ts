import express, { Request, Response } from 'express';
import Database from 'better-sqlite3';

const app = express();
const PORT = process.env.PORT || 3000;

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
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    framework: 'express',
    runtime: 'node',
    timestamp: Date.now()
  });
});

// Get user by ID
app.get('/users/:id', (req: Request, res: Response) => {
  const user = getUser.get(req.params.id);
  if (user) {
    res.json(user);
  } else {
    res.status(404).json({ error: 'User not found' });
  }
});

// Get all users
app.get('/users', (_req: Request, res: Response) => {
  const users = getAllUsers.all();
  res.json(users);
});

// Create new user
app.post('/users', (req: Request, res: Response) => {
  const { name, email } = req.body;
  if (!name || !email) {
    res.status(400).json({ error: 'Name and email are required' });
    return;
  }

  const result = insertUser.run(name, email);
  res.status(201).json({
    id: result.lastInsertRowid,
    name,
    email
  });
});

app.listen(PORT, () => {
  console.log(`Express (Node.js) server running on port ${PORT}`);
});
