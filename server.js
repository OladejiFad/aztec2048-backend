require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('./config'); // your passport config
const authRoutes = require('./routes/auth'); // auth routes (with Twitter login)
const cors = require('cors');
const mongoose = require('mongoose');
const User = require('./models/User');

const app = express();
const PORT = process.env.PORT || 5000;

// --- MongoDB connection ---
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1); // crash if DB connection fails
  });

// --- Enable CORS for frontend ---
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// --- Body parser ---
app.use(express.json());

// --- Session setup ---
app.use(session({
  secret: process.env.SESSION_SECRET || 'secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // set true if using HTTPS
}));

// --- Initialize passport ---
app.use(passport.initialize());
app.use(passport.session());

// --- Routes ---
app.get('/', (req, res) => {
  res.send('Welcome! <a href="/auth/twitter">Login with Twitter</a>');
});
app.use('/auth', authRoutes);

// --- Protected dashboard page ---
app.get('/dashboard', (req, res) => {
  if (!req.isAuthenticated()) return res.redirect('/');
  const user = req.user;
  res.send(`
    <h1>Welcome, ${user.displayName || user.username}!</h1>
    <p>Username: ${user.username}</p>
    <p>Twitter ID: ${user.twitterId}</p>
    ${user.photo ? `<img src="${user.photo}" width="100"/>` : ''}
    <br/><br/>
    <a href="/auth/logout">Logout</a>
  `);
});

// --- API: Get current user ---
app.get('/api/me', (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });
  const { _id, twitterId, username, displayName, photo, totalScore, weeklyScores } = req.user;

  let gamesLeft = 7;
  if (weeklyScores && Array.isArray(weeklyScores)) {
    const now = new Date();
    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(now.getDate() - now.getDay());
    const thisWeek = weeklyScores.filter(s => new Date(s.date) >= weekStart);
    gamesLeft = Math.max(0, 7 - thisWeek.length);
  }

  res.json({ _id, twitterId, username, displayName, photo, totalScore, weeklyScores, gamesLeft });
});

// --- API: Update score ---
app.post('/api/update-score/:userId', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });
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
      return res.status(400).json({ error: 'Weekly game limit reached (7 games).', gamesLeft: 0 });
    }

    const weeklyTotal = user.weeklyScores.reduce((sum, s) => sum + s.score, 0);
    if (weeklyTotal + score > 210000) {
      return res.status(400).json({ error: 'Weekly max points exceeded (210,000).', gamesLeft: 7 - user.weeklyScores.length });
    }

    user.totalScore = (user.totalScore || 0) + score;
    user.weeklyScores.push({ score, date: now });
    await user.save();

    res.json({
      success: true,
      totalScore: user.totalScore,
      gamesLeft: 7 - user.weeklyScores.length,
      weeklyScores: user.weeklyScores
    });
  } catch (err) {
    console.error('Error in /api/update-score:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- API: Leaderboard ---
app.get('/api/leaderboard', async (req, res) => {
  try {
    const all = req.query.all === 'true';
    const query = User.find().sort({ totalScore: -1 }).select('username displayName photo totalScore weeklyScores');
    if (!all) query.limit(20);
    const users = await query.exec();

    const now = new Date();
    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(now.getDate() - now.getDay());

    const result = users.map(u => {
      let gamesLeft = 7;
      if (u.weeklyScores && Array.isArray(u.weeklyScores)) {
        const thisWeek = u.weeklyScores.filter(s => new Date(s.date) >= weekStart);
        gamesLeft = Math.max(0, 7 - thisWeek.length);
      }
      return {
        _id: u._id,
        displayName: u.displayName || u.username,
        photo: u.photo,
        totalScore: u.totalScore,
        gamesLeft
      };
    });

    res.json(result);
  } catch (err) {
    console.error('Error in /api/leaderboard:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Catch-all error handler ---
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// --- Start server ---
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
