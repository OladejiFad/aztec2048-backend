require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const passport = require('./config'); // Passport config
const authRoutes = require('./routes/auth');
const cors = require('cors');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 10000;

// --- Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- CORS setup ---
app.use(
  cors({
    origin: process.env.FRONTEND_URL, // frontend must match exactly
    credentials: true, // allow cookies
  })
);

// --- Session middleware (required for Twitter OAuth) ---
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'default_session_secret',
    resave: false,
    saveUninitialized: false, // only create session if needed
    cookie: {
      secure: process.env.NODE_ENV === 'production', // HTTPS only in prod
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // cross-site for Vercel frontend
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    },
  })
);

// --- Passport initialization ---
app.use(passport.initialize());
app.use(passport.session()); // enable session support for OAuth

// --- Routes ---
app.use('/auth', authRoutes);

// --- Root test route ---
app.get('/', (req, res) => {
  res.json({ message: 'Aztec2048 Backend is running!' });
});

// --- Connect MongoDB ---
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// --- Start server ---
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`✅ Frontend URL: ${process.env.FRONTEND_URL}`);
});
