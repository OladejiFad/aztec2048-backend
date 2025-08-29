const express = require('express');
const passport = require('passport');
const User = require('../models/User');
const router = express.Router();

// Middleware to protect API routes
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ error: 'Not authenticated' });
}

// --- Twitter login ---
router.get('/twitter', passport.authenticate('twitter'));

// --- Twitter callback ---
router.get(
  '/twitter/callback',
  passport.authenticate('twitter', { failureRedirect: '/' }),
  (req, res) => {
    // Force redirect to frontend dashboard after successful login
    const redirectUrl = process.env.FRONTEND_URL
      ? `${process.env.FRONTEND_URL}/dashboard`
      : 'http://localhost:3000/dashboard';

    // Use cookie-based session persistence (already in your session setup)
    res.redirect(redirectUrl);
  }
);

// --- Logout ---
router.get('/logout', (req, res, next) => {
  req.logout(err => {
    if (err) return next(err);
    res.redirect(process.env.FRONTEND_URL || 'http://localhost:3000');
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
      s => new Date(s.date) >= weekStart
    );

    res.json({
      username: user.username,
      displayName: user.displayName,
      photo: user.photo,
      totalScore: user.totalScore || 0,
      gamesThisWeek: weeklyScores.length,
      gamesLeft: Math.max(0, 7 - weeklyScores.length)
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
    user.weeklyScores = user.weeklyScores.filter(s => new Date(s.date) >= weekStart);

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
      gamesLeft
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

    const leaderboard = users.map(user => {
      const weeklyScores = (user.weeklyScores || []).filter(
        s => new Date(s.date) >= weekStart
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
        gamesLeft
      };
    });

    res.json({ leaderboard });
  } catch (err) {
    console.error('Error in /api/leaderboard:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
