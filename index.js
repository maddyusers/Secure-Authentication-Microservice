require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, Candidate } = require('./db');

const app = express();
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET;

// Register endpoint
app.post('/api/register', async (req, res) => {
  const { first_name, last_name, email, password } = req.body;
  const password_hash = await bcrypt.hash(password, 10);

  try {
    const user = await User.create({ first_name, last_name, email, password_hash });
    res.status(201).json({ message: 'User registered successfully', user });
  } catch (err) {
    console.error('Error registering user:', err);
    if (err.name === 'SequelizeValidationError') {
      const messages = err.errors.map(e => e.message);
      res.status(400).json({ message: 'Validation error', errors: messages });
    } else {
      res.status(500).json({ message: 'Error registering user', error: err.message });
    }
  }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ where: { email } });

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  const isMatch = await bcrypt.compare(password, user.password_hash);

  if (!isMatch) {
    return res.status(401).json({ message: 'Incorrect password' });
  }

  const token = jwt.sign({ user_id: user.id }, JWT_SECRET, { expiresIn: '1h' });
  res.json({ message: 'Login successful', token });
});

// Middleware to verify JWT
const verifyToken = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ message: 'Access denied' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user_id = decoded.user_id;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// Protected route example
app.post('/api/protected', verifyToken, (req, res) => {
  res.json({ message: 'This is a protected route' });
});

// Add candidate endpoint
app.post('/api/candidate', verifyToken, async (req, res) => {
  const { first_name, last_name, email } = req.body;

  try {
    const candidate = await Candidate.create({ first_name, last_name, email, user_id: req.user_id });
    res.status(201).json({ message: 'Candidate added successfully', candidate });
  } catch (err) {
    console.error('Error adding candidate:', err);
    res.status(500).json({ message: 'Error adding candidate', error: err.message });
  }
});

// Get candidates endpoint
app.get('/api/candidate', verifyToken, async (req, res) => {
  try {
    const candidates = await Candidate.findAll({ where: { user_id: req.user_id } });
    res.json(candidates);
  } catch (err) {
    console.error('Error retrieving candidates:', err);
    res.status(500).json({ message: 'Error retrieving candidates', error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
