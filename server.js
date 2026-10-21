const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static Folders
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Folders & Data File auto-create logic
const uploadsDir = path.join(__dirname, 'uploads');
const dataDir = path.join(__dirname, 'data');
const dataFilePath = path.join(dataDir, 'notes.json');

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
if (!fs.existsSync(dataFilePath)) fs.writeFileSync(dataFilePath, JSON.stringify([]));

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Unique timestamped filename to prevent overwriting
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const cleanOriginalName = file.originalname.replace(/\s+/g, '_');
    cb(null, uniqueSuffix + '-' + cleanOriginalName);
  }
});

// File filter (PDF, Docs, PPT, Images)
const fileFilter = (req, file, cb) => {
  const allowedExtensions = /pdf|doc|docx|ppt|pptx|txt|png|jpg|jpeg/;
  const extname = allowedExtensions.test(path.extname(file.originalname).toLowerCase());
  if (extname) {
    return cb(null, true);
  }
  cb(new Error('Only document files (PDF, DOC, PPT, TXT, Images) are allowed!'));
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: fileFilter
});

// Helper: Read Notes
function getNotes() {
  try {
    const rawData = fs.readFileSync(dataFilePath, 'utf-8');
    return JSON.parse(rawData);
  } catch (err) {
    return [];
  }
}

// Helper: Save Notes
function saveNotes(notes) {
  fs.writeFileSync(dataFilePath, JSON.stringify(notes, null, 2));
}

// ---------------- ROUTES ---------------- //

// 1. Get all notes (For Student Page)
app.get('/api/notes', (req, res) => {
  const notes = getNotes();
  res.status(200).json(notes);
});

// 2. Upload a new note (For Teacher Page)
app.post('/api/upload', upload.single('noteFile'), (req, res) => {
  try {
    const { subject, title, description } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'Please select a file to upload.' });
    }
    if (!subject || !title) {
      return res.status(400).json({ error: 'Subject and Title are required.' });
    }

    const newNote = {
      id: Date.now().toString(),
      subject: subject.trim(),
      title: title.trim(),
      description: description ? description.trim() : '',
      originalFileName: req.file.originalname,
      storedFileName: req.file.filename,
      fileSize: (req.file.size / (1024 * 1024)).toFixed(2) + ' MB',
      fileUrl: `/uploads/${req.file.filename}`,
      uploadDate: new Date().toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      })
    };

    const notes = getNotes();
    notes.unshift(newNote); // Naye notes sabse upar dikhenge
    saveNotes(notes);

    res.status(201).json({
      message: 'Note uploaded successfully!',
      note: newNote
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to upload note.' });
  }
});

// Global error handler for Multer file size / type errors
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  } else if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
});

// Start Server
app.listen(PORT, () => {
  console.log(`==========================================`);
  console.log(` NotesHub Server running on localhost:${PORT}`);
  console.log(` Student Page : http://localhost:${PORT}`);
  console.log(` Teacher Page : http://localhost:${PORT}/upload.html`);
  console.log(`==========================================`);
});