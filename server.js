require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('./config'); // Passport Twitter strategy
const authRoutes = require('./routes/auth');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

// --- Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- CORS ---
app.use(
  cors({
    origin: process.env.FRONTEND_URL, // https://aztec2048.space
    credentials: true,
  })
);

// --- Session ---
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
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
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

// --- Root route ---
app.get('/', (req, res) => {
  res.json({ message: '🚀 Aztec2048 Backend running with Sessions!' });
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
