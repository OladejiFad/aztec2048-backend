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

// --- Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })
);

// --- Session ---
const store = MongoStore.create({
  mongoUrl: process.env.MONGO_URI,
  stringify: false,
});

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'secret-key',
    resave: false,
    saveUninitialized: false,
    store,
    cookie: {
      secure: isProd,
      httpOnly: true,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

// --- Passport ---
app.use(passport.initialize());
app.use(passport.session());

// --- Routes ---
app.use('/auth', authRoutes);

// --- Serve frontend build ---
const frontendBuildPath = path.join(__dirname, 'frontend', 'build');
app.use(express.static(frontendBuildPath));

app.get(/.*/, (req, res) => {
  res.sendFile(path.join(frontendBuildPath, 'index.html'));
});

// --- MongoDB ---
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error(err));

// --- Start server ---
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
