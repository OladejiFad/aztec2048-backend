require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const passport = require('./config'); // your updated passport config
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
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })
);

// --- Session middleware (needed for Twitter OAuth) ---
app.use(session({
  secret: process.env.JWT_SECRET || 'default_secret',
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    maxAge: 24 * 60 * 60 * 1000, // 1 day
  }
}));

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
  .catch(err => console.error('❌ MongoDB connection error:', err));

// --- Start server ---
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`✅ Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
});
