require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('./config'); // passport configuration
const authRoutes = require('./routes/auth');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

// --- Trust proxy for Railway / reverse proxies ---
app.set('trust proxy', 1);

// --- Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- CORS ---
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true, // allow cookies across origins
  })
);

// --- Session setup ---
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'secret-key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      collectionName: 'sessions',
      crypto: { secret: process.env.SESSION_SECRET },
    }),
    cookie: {
      secure: process.env.NODE_ENV === 'production', // must be true for HTTPS
      httpOnly: true,
      sameSite: 'none', // allow cross-site OAuth
      maxAge: 24 * 60 * 60 * 1000, // 1 day
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
  res.json({ message: '🚀 Aztec2048 Backend running with Sessions!' });
});

// --- MongoDB connection ---
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// --- Start server ---
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server listening on port ${PORT}`);
  console.log(`✅ FRONTEND_URL: ${process.env.FRONTEND_URL}`);
});
