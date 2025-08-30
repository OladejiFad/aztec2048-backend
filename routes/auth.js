const express = require('express');
const passport = require('passport');
const User = require('../models/User');
const router = express.Router();

// --- Middleware to protect API routes using session ---
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  return res.status(401).json({ error: 'Not authenticated' });
}

// --- Twitter login ---
router.get('/twitter', passport.authenticate('twitter', { session: true }));

// --- Twitter callback ---
router.get(
  '/twitter/callback',
  passport.authenticate('twitter', { failureRedirect: process.env.FRONTEND_URL || '/' }),
  (req, res) => {
    if (!req.user) {
      console.error('Twitter callback: No user returned from Passport');
      return res.redirect(process.env.FRONTEND_URL || '/');
    }

    console.log('Twitter callback: user retrieved:', req.user);

    // Redirect to frontend dashboard (session is stored server-side)
    res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
  }
);

// --- Logout ---
router.get('/logout', (req, res) => {
  req.logout(() => {
    res.redirect(process.env.FRONTEND_URL || '/');
  });
});

// --- API: Get current user ---
router.get('/api/me', ensureAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('username displayName photo totalScore weeklyScores');
    if (!user) return res.status(404).json({ error: 'User not found' });

    const now = new Date();
    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(now.getDate() - now.getDay());

    const weeklyScores = (user.weeklyScores || []).filter((s) => new Date(s.date) >= weekStart);

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
