const express = require('express');
const User = require('../models/User');
const router = express.Router();

// --- Get top 10 users ---
router.get('/', async (req, res) => {
  try {
    const topUsers = await User.find()
      .sort({ totalScore: -1 })
      .limit(10)
      .select('username displayName totalScore photo');
    res.json(topUsers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
