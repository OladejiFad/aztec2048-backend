require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('./config/passport');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const gameRoutes = require('./routes/game');
const leaderboardRoutes = require('./routes/leaderboard');

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
  stringify: false, // store as BSON to prevent JSON parse errors
});

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'secret-key',
    resave: false,
    saveUninitialized: false,
    store,
    cookie: {
      secure: isProd, // only true in production
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
app.use('/game', gameRoutes);
app.use('/leaderboard', leaderboardRoutes);

// --- MongoDB ---
mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('✅ MongoDB connected');

    // --- Selective cleanup of corrupted sessions ---
    try {
      const db = mongoose.connection.db;
      const sessions = db.collection('sessions');

      const allSessions = await sessions.find({}).toArray();
      let deleted = 0;

      for (const sess of allSessions) {
        try {
          // Some drivers already store sessions as objects (no need to parse)
          if (typeof sess.session === 'string') {
            JSON.parse(sess.session);
          }
        } catch (err) {
          await sessions.deleteOne({ _id: sess._id });
          deleted++;
        }
      }

      if (deleted > 0) {
        console.log(`🧹 Cleaned up ${deleted} corrupted sessions`);
      } else {
        console.log('✅ No corrupted sessions found');
      }
    } catch (err) {
      console.error('⚠️ Could not check/clean sessions:', err.message);
    }
  })
  .catch((err) => console.error(err));

// --- Start server ---
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
