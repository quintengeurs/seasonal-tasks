const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Initialize Express
const app = express();

// Create uploads folder dynamically (lowercase)
const uploadsDir = path.join(__dirname, 'public', 'Uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'public', 'Uploads'));
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
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve tasks.json for client-side display
app.get('/tasks.json', (req, res) => {
  if (fs.existsSync('tasks.json')) {
    res.json(JSON.parse(fs.readFileSync('tasks.json')));
  } else {
    res.json([]);
  }
});

// Task creation with image upload
app.post('/tasks', upload.single('image'), (req, res) => {
  try {
    const { title, dueDate, season, status } = req.body;
    const imagePath = req.file ? `/Uploads/${req.file.filename}` : null;

    if (!title) {
      throw new Error('Title is required');
    }

    // Load existing tasks
    const tasks = fs.existsSync('tasks.json') ? JSON.parse(fs.readFileSync('tasks.json')) : [];
    // Add new task
    tasks.push({
      id: tasks.length + 1,
      title,
      dueDate: dueDate || null,
      season: season || null,
      status: status || 'pending',
      archived: false,
      imagePath,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    // Save tasks
    fs.writeFileSync('tasks.json', JSON.stringify(tasks, null, 2));

    res.redirect('/');
  } catch (err) {
    console.error('Error creating task:', err);
    res.status(400).send(`Error: ${err.message || 'Failed to create task. Ensure the image is a valid jpeg, jpg, png, or gif under 5MB.'}`);
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});