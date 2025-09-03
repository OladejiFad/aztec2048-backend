const express = require('express');
const User = require('../models/User');
const router = express.Router();

// Middleware
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  return res.status(401).json({ error: 'Not authenticated' });
}

// --- Submit score ---
router.post('/score', ensureAuthenticated, async (req, res) => {
  try {
    const { score } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.totalScore += score;
    user.weeklyScores.push({ score });
    await user.save();

    res.json({ message: 'Score submitted', totalScore: user.totalScore });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
