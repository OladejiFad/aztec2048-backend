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
    req.user = decoded; // attach decoded payload
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// --- Twitter login ---
router.get('/twitter', passport.authenticate('twitter', { session: true }));

// --- Twitter callback (updated with detailed logging) ---
router.get(
  '/twitter/callback',
  passport.authenticate('twitter', { failureRedirect: process.env.FRONTEND_URL || '/' }),
  async (req, res) => {
    try {
      if (!req.user) {
        console.error('Twitter callback: No user returned from Passport');
        return res.redirect(process.env.FRONTEND_URL || '/');
      }

      const user = req.user;
      console.log('Twitter callback: user retrieved:', user);

      // Check required fields
      if (!process.env.JWT_SECRET) {
        console.error('JWT_SECRET not set in .env!');
        return res.status(500).send('Server misconfiguration: JWT_SECRET missing');
      }

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

      console.log('JWT token generated successfully:', token);

      res.redirect(`${process.env.FRONTEND_URL}/dashboard#token=${token}`);
    } catch (err) {
      console.error('Twitter callback ERROR:', err);
      res.status(500).send(`Internal Server Error: ${err.message}`);
    }
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
