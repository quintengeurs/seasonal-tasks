const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');
const session = require('express-session');
const app = express();

// Configure session middleware
app.use(
  session({
    secret: 'seasonal-tasks-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Set secure: true in production with HTTPS
  })
);

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'public', 'uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}${ext}`);
  }
});
const upload = multer({ storage });

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    console.log(`Serving file: ${filePath}`);
    if (filePath.endsWith('.html')) {
      res.setHeader('Content-Type', 'text/html');
    }
    if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    }
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));

// Authentication middleware
const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
};

// Permission middleware
const requireRole = (roles) => (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  if (!roles.includes(req.session.user.accountType)) {
    return res.redirect('/login');
  }
  next();
};

// Load files
async function loadFile(fileName) {
  try {
    const data = await fs.readFile(path.join(__dirname, fileName), 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error(`Error loading ${fileName}:`, err);
    return [];
  }
}

async function saveFile(fileName, data) {
  try {
    await fs.writeFile(
      path.join(__dirname, fileName),
      JSON.stringify(data, null, 2)
    );
  } catch (err) {
    console.error(`Error saving ${fileName}:`, err);
    throw err;
  }
}

// Routes
app.get('/', (req, res) => {
  console.log('GET /');
  res.sendFile(path.join(__dirname, 'public', 'index.html'), {
    headers: { 'Content-Type': 'text/html' }
  }, (err) => {
    if (err) {
      console.error('Error serving index.html:', err);
      res.status(500).send('Failed to load index page');
    }
  });
});

app.get('/admin', requireRole(['manager', 'admin']), (req, res) => {
  console.log('GET /admin');
  res.sendFile(path.join(__dirname, 'public', 'admin.html'), {
    headers: { 'Content-Type': 'text/html' }
  }, (err) => {
    if (err) {
      console.error('Error serving admin.html:', err);
      res.status(500).send('Failed to load admin page');
    }
  });
});

app.get('/archive', requireRole(['manager', 'admin']), (req, res) => {
  console.log('GET /archive');
  res.sendFile(path.join(__dirname, 'public', 'archive.html'), {
    headers: { 'Content-Type': 'text/html' }
  }, (err) => {
    if (err) {
      console.error('Error serving archive.html:', err);
      res.status(500).send('Failed to load archive page');
    }
  });
});

app.get('/staff', requireRole(['admin']), (req, res) => {
  console.log('GET /staff');
  res.sendFile(path.join(__dirname, 'public', 'staff.html'), {
    headers: { 'Content-Type': 'text/html' }
  }, (err) => {
    if (err) {
      console.error('Error serving staff.html:', err);
      res.status(500).send('Failed to load staff page');
    }
  });
});

app.get('/login', (req, res) => {
  console.log('GET /login');
  res.sendFile(path.join(__dirname, 'public', 'login.html'), {
    headers: { 'Content-Type': 'text/html' }
  }, (err) => {
    if (err) {
      console.error('Error serving login.html:', err);
      res.status(500).send('Failed to load login page');
    }
  });
});

app.post('/login', async (req, res) => {
  console.log('POST /login received:', req.body);
  try {
    const users = await loadFile('users.json');
    const user = users.find(
      (u) => u.username === req.body.username && u.password === req.body.password
    );
    if (user) {
      req.session.user = user;
      console.log('Login successful for user:', user.username, 'accountType:', user.accountType);
      res.redirect(user.accountType === 'generic' ? '/' : '/admin');
    } else {
      console.log('Login failed: Invalid credentials');
      res.status(401).send('Invalid credentials');
    }
  } catch (err) {
    console.error('Error in POST /login:', err);
    res.status(500).send('Failed to login');
  }
});

app.get('/logout', (req, res) => {
  console.log('GET /logout');
  req.session.destroy((err) => {
    if (err) {
      console.error('Error logging out:', err);
      res.status(500).send('Failed to logout');
    } else {
      res.redirect('/login');
    }
  });
});

// Check session endpoint
app.get('/api/check-session', (req, res) => {
  console.log('GET /api/check-session');
  if (req.session.user) {
    res.json({ user: req.session.user });
  } else {
    res.status(401).json({ user: null });
  }
});

// Task routes
app.get('/api/tasks', async (req, res) => {
  console.log('GET /api/tasks');
  try {
    const tasks = await loadFile('tasks.json');
    res.json(tasks);
  } catch (err) {
    console.error('Error in GET /api/tasks:', err);
    res.status(500).send('Failed to fetch tasks');
  }
});

app.post('/api/tasks', upload.single('image'), async (req, res) => {
  console.log('POST /api/tasks received with body:', req.body, 'file:', req.file);
  try {
    const tasks = await loadFile('tasks.json');
    const newTask = {
      id: Date.now().toString(),
      title: req.body.title,
      category: req.body.category,
      description: req.body.description,
      dueDate: req.body.dueDate,
      season: req.body.season,
      staff: req.body.staff,
      image: req.file ? `/uploads/${req.file.filename}` : null,
      completed: false,
      archived: false
    };
    tasks.push(newTask);
    console.log('Task assigned to:', newTask.staff);
    await saveFile('tasks.json', tasks);
    console.log('Tasks saved to tasks.json');
    res.status(201).send('Task added');
  } catch (err) {
    console.error('Error in POST /api/tasks:', err);
    res.status(500).send('Failed to add task');
  }
});

app.patch('/api/tasks/:id', async (req, res) => {
  console.log('PATCH /api/tasks/', req.params.id, 'body:', req.body);
  try {
    const tasks = await loadFile('tasks.json');
    const taskIndex = tasks.findIndex((task) => task.id === req.params.id);
    if (taskIndex === -1) {
      console.log('Task not found:', req.params.id);
      return res.status(404).send('Task not found');
    }
    tasks[taskIndex] = { ...tasks[taskIndex], ...req.body };
    await saveFile('tasks.json', tasks);
    console.log('Task updated in tasks.json');
    res.status(200).send('Task updated');
  } catch (err) {
    console.error('Error in PATCH /api/tasks:', err);
    res.status(500).send('Failed to update task');
  }
});

app.delete('/api/tasks/:id', async (req, res) => {
  console.log('DELETE /api/tasks/', req.params.id);
  try {
    const tasks = await loadFile('tasks.json');
    const filteredTasks = tasks.filter((task) => task.id !== req.params.id);
    await saveFile('tasks.json', filteredTasks);
    res.status(200).send('Task deleted');
  } catch (err) {
    console.error('Error in DELETE /api/tasks:', err);
    res.status(500).send('Failed to delete task');
  }
});

// Staff routes
app.get('/api/staff', async (req, res) => {
  console.log('GET /api/staff');
  try {
    const staff = await loadFile('staff.json');
    res.json(staff);
  } catch (err) {
    console.error('Error in GET /api/staff:', err);
    res.status(500).send('Failed to fetch staff');
  }
});

app.post('/api/staff', async (req, res) => {
  console.log('POST /api/staff', req.body);
  try {
    const staff = await loadFile('staff.json');
    const newStaff = {
      id: Date.now().toString(),
      name: req.body.name
    };
    staff.push(newStaff);
    await saveFile('staff.json', staff);
    res.status(201).send('Staff added');
  } catch (err) {
    console.error('Error in POST /api/staff:', err);
    res.status(500).send('Failed to add staff');
  }
});

app.patch('/api/staff/:id', async (req, res) => {
  console.log('PATCH /api/staff/', req.params.id, 'body:', req.body);
  try {
    const staff = await loadFile('staff.json');
    const staffIndex = staff.findIndex((s) => s.id === req.params.id);
    if (staffIndex === -1) {
      console.log('Staff not found:', req.params.id);
      return res.status(404).send('Staff not found');
    }
    staff[staffIndex] = { ...staff[staffIndex], ...req.body };
    await saveFile('staff.json', staff);
    res.status(200).send('Staff updated');
  } catch (err) {
    console.error('Error in PATCH /api/staff:', err);
    res.status(500).send('Failed to update staff');
  }
});

app.delete('/api/staff/:id', async (req, res) => {
  console.log('DELETE /api/staff/', req.params.id);
  try {
    const staff = await loadFile('staff.json');
    const filteredStaff = staff.filter((s) => s.id !== req.params.id);
    await saveFile('staff.json', filteredStaff);
    res.status(200).send('Staff deleted');
  } catch (err) {
    console.error('Error in DELETE /api/staff:', err);
    res.status(500).send('Failed to delete staff');
  }
});

// User routes
app.get('/api/users', async (req, res) => {
  console.log('GET /api/users');
  try {
    const users = await loadFile('users.json');
    res.json(users);
  } catch (err) {
    console.error('Error in GET /api/users:', err);
    res.status(500).send('Failed to fetch users');
  }
});

app.post('/api/users', async (req, res) => {
  console.log('POST /api/users', req.body);
  try {
    const users = await loadFile('users.json');
    const newUser = {
      id: Date.now().toString(),
      username: req.body.username,
      password: req.body.password,
      accountType: req.body.accountType
    };
    users.push(newUser);
    await saveFile('users.json', users);
    res.status(201).send('User added');
  } catch (err) {
    console.error('Error in POST /api/users:', err);
    res.status(500).send('Failed to add user');
  }
});

app.patch('/api/users/:id', async (req, res) => {
  console.log('PATCH /api/users/', req.params.id, 'body:', req.body);
  try {
    const users = await loadFile('users.json');
    const userIndex = users.findIndex((u) => u.id === req.params.id);
    if (userIndex === -1) {
      console.log('User not found:', req.params.id);
      return res.status(404).send('User not found');
    }
    users[userIndex] = { ...users[userIndex], ...req.body };
    await saveFile('users.json', users);
    res.status(200).send('User updated');
  } catch (err) {
    console.error('Error in PATCH /api/users:', err);
    res.status(500).send('Failed to update user');
  }
});

app.delete('/api/users/:id', async (req, res) => {
  console.log('DELETE /api/users/', req.params.id);
  try {
    const users = await loadFile('users.json');
    const filteredUsers = users.filter((u) => u.id !== req.params.id);
    await saveFile('users.json', filteredUsers);
    res.status(200).send('User deleted');
  } catch (err) {
    console.error('Error in DELETE /api/users:', err);
    res.status(500).send('Failed to delete user');
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).send('Internal server error');
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});