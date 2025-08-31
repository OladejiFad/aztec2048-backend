require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const passport = require('./config'); // Passport config (Twitter strategy)
const authRoutes = require('./routes/auth');
const cors = require('cors');
const session = require('express-session');

const app = express();

// ✅ Render provides PORT automatically
const PORT = process.env.PORT || 5000;

// --- Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- CORS ---
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true, // allow cookies
  })
);

// --- Session (simplified version you asked for) ---
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'secret',
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    },
  })
);

// --- Passport ---
app.use(passport.initialize());
app.use(passport.session());

// --- Routes ---
app.use('/auth', authRoutes);

// --- Root route ---
app.get('/', (req, res) => {
  res.json({ message: '🚀 Aztec2048 Backend running on Render with Sessions!' });
});

// --- MongoDB connection ---
mongoose
  .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// --- Start server ---
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server listening on port ${PORT}`);
  console.log(`✅ FRONTEND_URL: ${process.env.FRONTEND_URL}`);
});
