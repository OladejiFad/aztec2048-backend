require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('./config/passport');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const isProd = NODE_ENV === 'production';

// --- Trust proxy for correct HTTPS detection behind Railway / Heroku ---
if (isProd) app.set('trust proxy', 1);

// --- Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- CORS ---
app.use(
  cors({
    origin: process.env.FRONTEND_URL, // e.g. "https://aztec2048.space"
    credentials: true,                // allow cookies/sessions
  })
);

// --- Session store ---
const store = MongoStore.create({
  mongoUrl: process.env.MONGO_URI,
  stringify: false,
});

// --- Sessions ---
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'fallback-secret',
    resave: false,
    saveUninitialized: false,
    store,
    cookie: {
      secure: isProd,              // only send cookies over HTTPS
      httpOnly: true,              // prevent JS access
      sameSite: 'none',            // REQUIRED for cross-site cookies
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    },
  })
);

// --- Passport ---
app.use(passport.initialize());
app.use(passport.session());

// --- Routes ---
app.use('/auth', authRoutes);

// --- Serve frontend build in production ---
if (isProd) {
  const frontendBuildPath = path.join(__dirname, 'frontend', 'build');
  app.use(express.static(frontendBuildPath));

  app.get(/.*/, (req, res) => {
    res.sendFile(path.join(frontendBuildPath, 'index.html'));
  });
}

// --- MongoDB ---
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('[ERROR] MongoDB connection failed:', err));

// --- Start server ---
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
