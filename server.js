const express = require('express');
const session = require('express-session');
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');
const app = express();

app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

const upload = multer({ dest: 'public/uploads/' });

app.get('/', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
    if (req.session.user) {
        return res.redirect('/');
    }
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const users = JSON.parse(await fs.readFile('users.json'));
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
        req.session.user = user;
        res.json({ success: true });
    } else {
        res.json({ success: false, message: 'Invalid credentials' });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

app.get('/admin', (req, res) => {
    if (!req.session.user || !['admin', 'manager'].includes(req.session.user.role)) {
        return res.redirect('/login');
    }
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/archive', (req, res) => {
    if (!req.session.user || !['admin', 'manager'].includes(req.session.user.role)) {
        return res.redirect('/login');
    }
    res.sendFile(path.join(__dirname, 'public', 'archive.html'));
});

app.get('/staff', (req, res) => {
    if (!req.session.user || !['admin', 'manager'].includes(req.session.user.role)) {
        return res.redirect('/login');
    }
    res.sendFile(path.join(__dirname, 'public', 'staff.html'));
});

app.get('/api/tasks', async (req, res) => {
    const tasks = JSON.parse(await fs.readFile('tasks.json'));
    res.json(tasks);
});

app.post('/api/tasks', upload.single('image'), async (req, res) => {
    if (!req.session.user || !['admin', 'manager'].includes(req.session.user.role)) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    const tasks = JSON.parse(await fs.readFile('tasks.json'));
    const newTask = {
        id: tasks.length ? Math.max(...tasks.map(t => t.id)) + 1 : 1,
        title: req.body.title,
        type: req.body.type,
        description: req.body.description,
        dueDate: req.body.dueDate,
        urgency: req.body.urgency,
        image: req.file ? `uploads/${req.file.filename}` : null,
        completed: false,
        archived: false
    };
    tasks.push(newTask);
    await fs.writeFile('tasks.json', JSON.stringify(tasks, null, 2));
    res.json(newTask);
});

app.post('/api/tasks/:id/complete', async (req, res) => {
    const tasks = JSON.parse(await fs.readFile('tasks.json'));
    const task = tasks.find(t => t.id === parseInt(req.params.id));
    if (task) {
        task.completed = true;
        await fs.writeFile('tasks.json', JSON.stringify(tasks, null, 2));
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Task not found' });
    }
});

app.post('/api/tasks/:id/archive', async (req, res) => {
    const tasks = JSON.parse(await fs.readFile('tasks.json'));
    const task = tasks.find(t => t.id === parseInt(req.params.id));
    if (task) {
        task.archived = true;
        await fs.writeFile('tasks.json', JSON.stringify(tasks, null, 2));
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Task not found' });
    }
});

app.delete('/api/tasks/:id', async (req, res) => {
    if (!req.session.user || !['admin', 'manager'].includes(req.session.user.role)) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    let tasks = JSON.parse(await fs.readFile('tasks.json'));
    tasks = tasks.filter(t => t.id !== parseInt(req.params.id));
    await fs.writeFile('tasks.json', JSON.stringify(tasks, null, 2));
    res.json({ success: true });
});

app.get('/api/staff', async (req, res) => {
    const users = JSON.parse(await fs.readFile('users.json'));
    res.json(users);
});

app.post('/api/staff', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    const users = JSON.parse(await fs.readFile('users.json'));
    const newUser = {
        id: users.length ? Math.max(...users.map(u => u.id)) + 1 : 1,
        username: req.body.username,
        password: req.body.password,
        role: req.body.role
    };
    users.push(newUser);
    await fs.writeFile('users.json', JSON.stringify(users, null, 2));
    res.json(newUser);
});

app.post('/api/staff/:id', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    const users = JSON.parse(await fs.readFile('users.json'));
    const user = users.find(u => u.id === parseInt(req.params.id));
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    user.username = req.body.username || user.username;
    user.password = req.body.password || user.password;
    user.role = req.body.role || user.role;
    await fs.writeFile('users.json', JSON.stringify(users, null, 2));
    res.json({ success: true });
});

app.delete('/api/staff/:id', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    let users = JSON.parse(await fs.readFile('users.json'));
    users = users.filter(u => u.id !== parseInt(req.params.id));
    await fs.writeFile('users.json', JSON.stringify(users, null, 2));
    res.json({ success: true });
});

app.listen(process.env.PORT || 3000, () => {
    console.log('Server running on port 3000');
});