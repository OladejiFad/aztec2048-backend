const express = require('express');
const passport = require('passport');
const User = require('../models/User');
const router = express.Router();

// --- Middleware to protect API routes ---
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  return res.status(401).json({ error: 'Not authenticated' });
}

// --- Twitter login ---
router.get('/twitter', passport.authenticate('twitter', { session: true }));

// --- Twitter callback ---
router.get('/twitter/callback', (req, res, next) => {
  passport.authenticate('twitter', (err, user, info) => {
    console.log('Twitter callback debug:', { err, user, info });

    if (err) {
      console.error('Twitter callback error:', err);
      return res.status(500).send('Twitter callback failed');
    }

    if (!user) {
      console.warn('No user returned from Twitter strategy');
      return res.redirect(process.env.FRONTEND_URL || '/');
    }

    req.logIn(user, (err) => {
      if (err) {
        console.error('Login error:', err);
        return res.status(500).send('Login failed');
      }
      console.log('User logged in via Twitter:', user.username);
      return res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
    });
  })(req, res, next);
});

// --- Logout ---
router.get('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
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

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.totalScore = (user.totalScore || 0) + (score || 0);
    user.weeklyScores.push({ score: score || 0, date: new Date() });
    await user.save();

    const now = new Date();
    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(now.getDate() - now.getDay());

    const weeklyScores = (user.weeklyScores || []).filter(
      (s) => new Date(s.date) >= weekStart
    );

    res.json({
      totalScore: user.totalScore,
      gamesLeft: Math.max(0, 7 - weeklyScores.length),
    });
  } catch (err) {
    console.error('Error in /api/update-score:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- API: Leaderboard ---
router.get('/api/leaderboard', ensureAuthenticated, async (req, res) => {
  try {
    const users = await User.find({})
      .select('username displayName photo totalScore')
      .sort({ totalScore: -1 })
      .limit(100);

    res.json({ leaderboard: users });
  } catch (err) {
    console.error('Error in /api/leaderboard:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
