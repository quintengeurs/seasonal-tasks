const express = require('express');
const session = require('express-session');
const pg = require('pg');
const PGSession = require('connect-pg-simple')(session);
const path = require('path');
const multer = require('multer');
const app = express();

// PostgreSQL connection
const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://seasonal_tasks_user:l4aIVK3pj5FHvOQpCap4I7hGu2FPH6Vq@dpg-d0bkieruibrs73deh2ug-a.frankfurt-postgres.render.com/seasonal_tasks',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    store: new PGSession({
        pool: pool,
        tableName: 'sessions'
    }),
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production' }
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
    const { rows } = await pool.query('SELECT * FROM users WHERE username = $1 AND password = $2', [username, password]);
    if (rows.length > 0) {
        req.session.user = rows[0];
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

app.get('/api/current-user', (req, res) => {
    if (req.session.user) {
        res.json(req.session.user);
    } else {
        res.json(null);
    }
});

app.get('/api/tasks', async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM tasks');
    res.json(rows);
});

app.post('/api/tasks', upload.single('image'), async (req, res) => {
    if (!req.session.user || !['admin', 'manager'].includes(req.session.user.role)) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    const { title, type, description, dueDate, urgency, allocatedTo } = req.body;
    const image = req.file ? `uploads/${req.file.filename}` : null;
    const { rows } = await pool.query(
        'INSERT INTO tasks (title, type, description, due_date, urgency, allocated_to, image, completed, archived) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
        [title, type, description, dueDate, urgency, allocatedTo || null, image, false, false]
    );
    res.json(rows[0]);
});

app.post('/api/tasks/:id/complete', async (req, res) => {
    const { rows } = await pool.query('UPDATE tasks SET completed = TRUE WHERE id = $1 RETURNING *', [req.params.id]);
    if (rows.length > 0) {
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Task not found' });
    }
});

app.post('/api/tasks/:id/archive', async (req, res) => {
    const { rows } = await pool.query('UPDATE tasks SET archived = TRUE WHERE id = $1 RETURNING *', [req.params.id]);
    if (rows.length > 0) {
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Task not found' });
    }
});

app.delete('/api/tasks/:id', async (req, res) => {
    if (!req.session.user || !['admin', 'manager'].includes(req.session.user.role)) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    const { rowCount } = await pool.query('DELETE FROM tasks WHERE id = $1', [req.params.id]);
    res.json({ success: rowCount > 0 });
});

app.get('/api/staff', async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM users');
    res.json(rows);
});

app.post('/api/staff', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    const { username, password, role } = req.body;
    const { rows } = await pool.query(
        'INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING *',
        [username, password, role]
    );
    res.json(rows[0]);
});

app.post('/api/staff/:id', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    const { username, password, role } = req.body;
    const updates = [];
    const values = [req.params.id];
    if (username) {
        updates.push(`username = $${values.length + 1}`);
        values.push(username);
    }
    if (password) {
        updates.push(`password = $${values.length + 1}`);
        values.push(password);
    }
    if (role) {
        updates.push(`role = $${values.length + 1}`);
        values.push(role);
    }
    if (updates.length === 0) {
        return res.status(400).json({ error: 'No updates provided' });
    }
    const { rows } = await pool.query(
        `UPDATE users SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
        values
    );
    if (rows.length > 0) {
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'User not found' });
    }
});

app.delete('/api/staff/:id', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    const { rowCount } = await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ success: rowCount > 0 });
});

app.listen(process.env.PORT || 3000, () => {
    console.log('Server running on port 3000');
});