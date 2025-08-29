const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();

// --- Middleware to protect API routes using JWT ---
function ensureAuthenticated(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Not authenticated' });

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // attach user info to req.user
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// --- Twitter login ---
router.get(
  '/twitter',
  passport.authenticate('twitter', { session: true })
);

// --- Twitter callback ---
router.get(
  '/twitter/callback',
  passport.authenticate('twitter', { failureRedirect: process.env.FRONTEND_URL || '/' }),
  async (req, res) => {
    try {
      const user = req.user;
      if (!user) return res.redirect(process.env.FRONTEND_URL || '/');

      // Create JWT token valid for 7 days
      const token = jwt.sign(
        {
          _id: user._id,
          username: user.username,
          displayName: user.displayName,
          photo: user.photo,
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      // Redirect to frontend with token in URL hash
      const redirectUrl = `${process.env.FRONTEND_URL}/dashboard#token=${token}`;
      res.redirect(redirectUrl);
    } catch (err) {
      console.error('Error in Twitter callback:', err);
      res.redirect(process.env.FRONTEND_URL || '/');
    }
  }
);

// --- Logout (frontend can just remove JWT token) ---
router.get('/logout', (req, res) => {
  req.logout(() => {
    res.redirect(process.env.FRONTEND_URL || '/');
  });
});

// --- API: Get current user ---
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

// --- API: Update score ---
router.post('/api/update-score/:userId', ensureAuthenticated, async (req, res) => {
  const { userId } = req.params;
  const { score } = req.body;

  if (typeof score !== 'number' || score <= 0 || score > 30000) {
    return res.status(400).json({ error: 'Invalid score. Max 30,000 per game.' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const now = new Date();
    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(now.getDate() - now.getDay());

    if (!user.weeklyScores) user.weeklyScores = [];
    user.weeklyScores = user.weeklyScores.filter((s) => new Date(s.date) >= weekStart);

    if (user.weeklyScores.length >= 7) {
      return res.status(400).json({ error: 'Weekly play limit reached (7 games max).' });
    }

    user.totalScore = (user.totalScore || 0) + score;
    user.weeklyScores.push({ score, date: now });

    await user.save();

    const gamesThisWeek = user.weeklyScores.length;
    const gamesLeft = Math.max(0, 7 - gamesThisWeek);

    res.json({
      success: true,
      totalScore: user.totalScore,
      gamesThisWeek,
      gamesLeft,
    });
  } catch (err) {
    console.error('Error in /api/update-score:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- API: Leaderboard ---
router.get('/api/leaderboard', ensureAuthenticated, async (req, res) => {
  try {
    const now = new Date();
    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(now.getDate() - now.getDay());

    const users = await User.find().sort({ totalScore: -1 }).limit(50);

    const leaderboard = users.map((user) => {
      const weeklyScores = (user.weeklyScores || []).filter(
        (s) => new Date(s.date) >= weekStart
      );

      const gamesThisWeek = weeklyScores.length;
      const gamesLeft = Math.max(0, 7 - gamesThisWeek);

      return {
        _id: user._id,
        username: user.username,
        displayName: user.displayName || user.username,
        photo: user.photo,
        totalScore: user.totalScore || 0,
        gamesThisWeek,
        gamesLeft,
      };
    });

    res.json({ leaderboard });
  } catch (err) {
    console.error('Error in /api/leaderboard:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
