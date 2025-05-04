const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const session = require('express-session');

// Initialize Express
const app = express();

// Create uploads folder
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(UploadsDir, { recursive: true });
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set to true for HTTPS
}));

// Authentication middleware
const requireLogin = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
};

const requireAdminOrManager = (req, res, next) => {
  if (!req.session.user || !['admin', 'manager'].includes(req.session.user.role)) {
    return res.status(403).send('Access denied');
  }
  next();
};

// Configure multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only images (jpeg, jpg, png, gif) are allowed'));
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Routes
app.get('/', (req, res) => {
  res.redirect('/login');
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const users = fs.existsSync('users.json') ? JSON.parse(fs.readFileSync('users.json')) : [];
  const user = users.find(u => u.username === username && u.password === password);

  if (user) {
    req.session.user = user;
    res.cookie('username', user.username);
    res.redirect('/index');
  } else {
    res.status(401).send('Invalid credentials');
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.clearCookie('username');
  res.redirect('/login');
});

app.get('/index', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', requireLogin, requireAdminOrManager, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/archive', requireLogin, requireAdminOrManager, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'archive.html'));
});

app.get('/staff', requireLogin, requireAdminOrManager, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'staff.html'));
});

app.get('/tasks.json', requireLogin, (req, res) => {
  if (fs.existsSync('tasks.json')) {
    const tasks = JSON.parse(fs.readFileSync('tasks.json'));
    if (!['admin', 'manager'].includes(req.session.user.role)) {
      res.json(tasks.filter(task => task.assignedTo === req.session.user.id && !task.archived));
    } else if (req.path === '/archive') {
      res.json(tasks.filter(task => task.archived));
    } else {
      res.json(tasks);
    }
  } else {
    res.json([]);
  }
});

app.get('/users.json', requireLogin, (req, res) => {
  if (fs.existsSync('users.json')) {
    res.json(JSON.parse(fs.readFileSync('users.json')));
  } else {
    res.json([]);
  }
});

app.post('/tasks', requireLogin, requireAdminOrManager, upload.single('image'), (req, res) => {
  try {
    const { title, dueDate, season, status, type, assignedTo } = req.body;
    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

    if (!title) {
      throw new Error('Title is required');
    }

    const tasks = fs.existsSync('tasks.json') ? JSON.parse(fs.readFileSync('tasks.json')) : [];
    tasks.push({
      id: tasks.length + 1,
      title,
      dueDate: dueDate || null,
      season: season || null,
      status: status || 'pending',
      type: type || 'seasonal',
      assignedTo: parseInt(assignedTo) || null,
      archived: false,
      imagePath,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    fs.writeFileSync('tasks.json', JSON.stringify(tasks, null, 2));

    res.redirect('/admin');
  } catch (err) {
    console.error('Error creating task:', err);
    res.status(400).send(`Error: ${err.message || 'Failed to create task.'}`);
  }
});

app.post('/tasks/:id/complete', requireLogin, (req, res) => {
  const tasks = fs.existsSync('tasks.json') ? JSON.parse(fs.readFileSync('tasks.json')) : [];
  const task = tasks.find(t => t.id === parseInt(req.params.id));
  if (task && (req.session.user.role === 'admin' || req.session.user.role === 'manager' || task.assignedTo === req.session.user.id)) {
    task.status = 'completed';
    task.updatedAt = new Date().toISOString();
    fs.writeFileSync('tasks.json', JSON.stringify(tasks, null, 2));
  }
  res.redirect('/index');
});

app.post('/tasks/:id/delete', requireLogin, requireAdminOrManager, (req, res) => {
  let tasks = fs.existsSync('tasks.json') ? JSON.parse(fs.readFileSync('tasks.json')) : [];
  tasks = tasks.filter(t => t.id !== parseInt(req.params.id));
  fs.writeFileSync('tasks.json', JSON.stringify(tasks, null, 2));
  res.redirect('/admin');
});

app.post('/tasks/:id/archive', requireLogin, requireAdminOrManager, (req, res) => {
  const tasks = fs.existsSync('tasks.json') ? JSON.parse(fs.readFileSync('tasks.json')) : [];
  const task = tasks.find(t => t.id === parseInt(req.params.id));
  if (task) {
    task.archived = true;
    task.updatedAt = new Date().toISOString();
    fs.writeFileSync('tasks.json', JSON.stringify(tasks, null, 2));
  }
  res.redirect('/admin');
});

app.post('/staff', requireLogin, requireAdminOrManager, (req, res) => {
  try {
    const { username, password, name, role } = req.body;
    if (!username || !password || !name || !role) {
      throw new Error('All fields are required');
    }

    const users = fs.existsSync('users.json') ? JSON.parse(fs.readFileSync('users.json')) : [];
    if (users.find(u => u.username === username)) {
      throw new Error('Username already exists');
    }

    users.push({
      id: users.length + 1,
      username,
      password, // TODO: Hash passwords in production
      name,
      role,
    });
    fs.writeFileSync('users.json', JSON.stringify(users, null, 2));

    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/staff/:id', requireLogin, requireAdminOrManager, (req, res) => {
  try {
    let users = fs.existsSync('users.json') ? JSON.parse(fs.readFileSync('users.json')) : [];
    const userId = parseInt(req.params.id);
    if (users.find(u => u.id === userId && u.username === req.session.user.username)) {
      throw new Error('Cannot delete your own account');
    }
    users = users.filter(u => u.id !== userId);
    fs.writeFileSync('users.json', JSON.stringify(users, null, 2));
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});