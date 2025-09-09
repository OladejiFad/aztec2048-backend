const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'SuperSecretJWTKey123!';

// --- Middleware to protect routes ---
function ensureAuthenticated(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid token' });
  }
}

// --- Register ---
router.post('/register', async (req, res) => {
  try {
    const { email, password, displayName } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password required' });

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ error: 'Email already in use' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const avatarUrl = `https://avatars.dicebear.com/v2/bottts/${encodeURIComponent(email)}.svg`;

    const newUser = await User.create({
      email,
      password: hashedPassword,
      displayName: displayName || '',
      photo: avatarUrl,
      totalScore: 0,
      weeklyScores: [],
    });

    const token = jwt.sign({ id: newUser._id, email: newUser.email }, JWT_SECRET, { expiresIn: '1d' });

    res.status(201).json({
      message: 'User registered',
      user: {
        _id: newUser._id,
        displayName: newUser.displayName,
        email: newUser.email,
        photo: newUser.photo,
        totalScore: newUser.totalScore,
      },
      token,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Login ---
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '1d' });

    res.json({
      message: 'Login successful',
      user: {
        _id: user._id,
        displayName: user.displayName,
        email: user.email,
        totalScore: user.totalScore || 0,
        photo: user.photo,
      },
      token,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Get current user info ---
router.get('/api/me', ensureAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('displayName email totalScore weeklyScores photo');
    if (!user) return res.status(404).json({ error: 'User not found' });

    const now = new Date();
    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(now.getDate() - now.getDay());

    const weeklyScores = (user.weeklyScores || []).filter(s => new Date(s.date) >= weekStart);

    res.json({
      _id: user._id,
      displayName: user.displayName,
      email: user.email,
      photo: user.photo,
      totalScore: user.totalScore || 0,
      gamesThisWeek: weeklyScores.length,
      gamesLeft: Math.max(0, 7 - weeklyScores.length),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Update score ---
router.post('/api/update-score/:id', ensureAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const { score } = req.body;

    if (String(req.user.id) !== id) return res.status(403).json({ error: 'Forbidden' });

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.totalScore = (user.totalScore || 0) + score;
    user.weeklyScores = user.weeklyScores || [];
    user.weeklyScores.push({ score, date: new Date() });
    await user.save();

    const now = new Date();
    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(now.getDate() - now.getDay());
    const weeklyScores = (user.weeklyScores || []).filter(s => new Date(s.date) >= weekStart);

    res.json({ totalScore: user.totalScore, gamesLeft: Math.max(0, 7 - weeklyScores.length) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Leaderboard ---
router.get('/leaderboard', ensureAuthenticated, async (req, res) => {
  try {
    const users = await User.find()
      .select('displayName photo totalScore')
      .sort({ totalScore: -1 })
      .limit(50);

    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
