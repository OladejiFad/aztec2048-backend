require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const passport = require('./config'); // passport config.js
const authRoutes = require('./routes/auth');
const cors = require('cors');
const session = require('express-session');
const MongoStore = require('connect-mongo');

const app = express();

// ✅ Always let Render set the port
const PORT = process.env.PORT || 5000;

// --- Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- CORS ---
app.use(
  cors({
    origin: process.env.FRONTEND_URL, // e.g. https://aztec2048-frontend.vercel.app
    credentials: true,
  })
);

// --- Session ---
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'default_secret',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      collectionName: 'sessions',
    }),
    cookie: {
      secure: process.env.NODE_ENV === 'production', // cookie over HTTPS only in prod
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000,
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
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// --- Start server ---
// 🔑 Important: bind to 0.0.0.0 for Render
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server listening on port ${PORT}`);
  console.log(`✅ FRONTEND_URL set to: ${process.env.FRONTEND_URL}`);
});
