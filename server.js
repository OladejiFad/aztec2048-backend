require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('./config'); // Twitter passport config
const authRoutes = require('./routes/auth'); // auth routes
const cors = require('cors');
const mongoose = require('mongoose');
const MongoStore = require('connect-mongo');
const User = require('./models/User');

const app = express();
const PORT = process.env.PORT || 5000;

/* --- Global unhandled rejection/exception logging --- */
process.on('unhandledRejection', (reason, promise) => {
  console.error('[UNHANDLED REJECTION]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err);
});

/* --- Debug environment variables --- */
console.log('[DEBUG] FRONTEND_URL:', process.env.FRONTEND_URL);
console.log('[DEBUG] MONGO_URI:', process.env.MONGO_URI ? '✅ Present' : '❌ Missing');
console.log('[DEBUG] SESSION_SECRET:', process.env.SESSION_SECRET ? '✅ Present' : '❌ Missing');

/* --- MongoDB connection --- */
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

/* --- Middleware --- */
app.use(express.json());

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Debug request logs
app.use((req, res, next) => {
  console.log(`[DEBUG] ${req.method} ${req.url}`);
  if (['POST', 'PUT'].includes(req.method)) console.log('[DEBUG] Body:', req.body);
  next();
});

/* --- TRUST PROXY (fixes secure cookies on Render/Heroku/NGINX) --- */
app.set("trust proxy", 1);

/* --- Session setup with MongoDB (persistent sessions) --- */
app.use(session({
  secret: process.env.SESSION_SECRET || 'secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    collectionName: 'sessions',
  }),
  cookie: {
    secure: true,          // required on Render (HTTPS)
    httpOnly: true,        // prevent JS access
    sameSite: "none",      // allow cross-site cookies (Vercel <-> Render)
    maxAge: 1000 * 60 * 60 * 24 // 1 day
  }
}));

/* --- Passport init --- */
app.use(passport.initialize());
app.use(passport.session());

/* --- Routes --- */
app.get('/', (req, res) => {
  res.send('Welcome! <a href="/auth/twitter">Login with Twitter</a>');
});

app.use('/auth', authRoutes);

/* --- Protected dashboard page --- */
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

/* --- API: Get current user --- */
app.get('/api/me', async (req, res) => {
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

/* --- API: Update score --- */
app.post('/api/update-score/:userId', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });

  const { userId } = req.params;
  const { score } = req.body;

  if (typeof score !== 'number' || score <= 0 || score > 30000) {
    return res.status(400).json({ error: 'Invalid score. Max 30,000 per game.' });
  }

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
    return res.status(400).json({
      error: 'Weekly max points exceeded (210,000).',
      gamesLeft: 7 - user.weeklyScores.length
    });
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
});

/* --- API: Leaderboard --- */
app.get('/api/leaderboard', async (req, res) => {
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
});

/* --- Test DB route --- */
app.get('/test', async (req, res) => {
  const count = await User.countDocuments();
  res.json({ success: true, count });
});

/* --- Catch-all error handler --- */
app.use((err, req, res, next) => {
  console.error('[ERROR] Unhandled error:', err.stack);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

/* --- Start server --- */
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
