const express = require('express');
const passport = require('passport');
const User = require('../models/User');
const router = express.Router();

// Protect routes middleware
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  return res.status(401).json({ error: 'Not authenticated' });
}

// --- Register ---
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, displayName } = req.body;

    // check both username & email
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ error: 'Username or email already in use' });
    }

    const newUser = await User.create({
      username,
      email,
      password,
      displayName: displayName || username,
    });

    // Auto-login after register
    req.logIn(newUser, (err) => {
      if (err) return res.status(500).json({ error: 'Auto login failed' });
      return res.status(201).json({
        message: 'User registered',
        user: { username: newUser.username, email: newUser.email },
      });
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Login ---
router.post('/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) return res.status(500).json({ error: 'Server error' });
    if (!user) return res.status(400).json({ error: info?.message || 'Invalid credentials' });

    req.logIn(user, (err) => {
      if (err) return res.status(500).json({ error: 'Login failed' });
      return res.json({
        message: 'Login successful',
        user: { username: user.username, email: user.email },
      });
    });
  })(req, res, next);
});

// --- Logout ---
router.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    req.session.destroy(() => {
      res.clearCookie('connect.sid'); // remove session cookie
      return res.json({ message: 'Logged out' });
    });
  });
});

// --- Get current user ---
router.get('/api/me', ensureAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      'username displayName photo totalScore weeklyScores'
    );

    if (!user) return res.status(404).json({ error: 'User not found' });

    const now = new Date();
    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(now.getDate() - now.getDay());

    const weeklyScores = (user.weeklyScores || []).filter(
      (s) => new Date(s.date) >= weekStart
    );

    res.json({
      username: user.username,
      displayName: user.displayName,
      photo: user.photo,
      totalScore: user.totalScore || 0,
      gamesThisWeek: weeklyScores.length,
      gamesLeft: Math.max(0, 7 - weeklyScores.length),
    });
  } catch (err) {
    console.error('Error in /api/me:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
