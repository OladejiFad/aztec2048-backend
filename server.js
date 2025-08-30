require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const passport = require('./config'); // config.js
const authRoutes = require('./routes/auth');
const cors = require('cors');
const session = require('express-session');
const MongoStore = require('connect-mongo');

const app = express();
const PORT = process.env.PORT || 10000;

// --- Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- CORS setup ---
app.use(
  cors({
    origin: process.env.FRONTEND_URL, // must match frontend
    credentials: true, // allow cookies
  })
);

// --- Session (needed for Passport OAuth) ---
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'default_session_secret',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      collectionName: 'sessions',
    }),
    cookie: {
      secure: process.env.NODE_ENV === 'production', // only HTTPS in prod
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    },
  })
);

// --- Passport ---
app.use(passport.initialize());
app.use(passport.session());

// --- Routes ---
app.use('/auth', authRoutes);

// --- Root ---
app.get('/', (req, res) => {
  res.json({ message: '🚀 Aztec2048 Backend running on Render!' });
});

// --- MongoDB connection ---
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected from server.js'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// --- Start server ---
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`✅ FRONTEND_URL set to: ${process.env.FRONTEND_URL}`);
});
