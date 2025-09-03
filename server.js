require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('./config'); // passport setup
const authRoutes = require('./routes/auth');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

// --- Trust proxy for Railway ---
app.set('trust proxy', 1);

// --- Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- CORS ---
app.use(
  cors({
    origin: process.env.FRONTEND_URL, // e.g., https://aztec2048.space
    credentials: true,
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
      secure: true,     // true for HTTPS
      httpOnly: true,
      sameSite: 'none', // allow cross-site cookies
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

// --- Passport ---
app.use(passport.initialize());
app.use(passport.session());

// --- API routes ---
app.use('/auth', authRoutes);

// --- MongoDB connection ---
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// --- Start server ---
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server listening on port ${PORT}`);
  console.log(`✅ FRONTEND_URL: ${process.env.FRONTEND_URL}`);
});

// --- Graceful shutdown ---
const shutdown = () => {
  console.log('⚠️  Shutting down server...');
  server.close(() => {
    mongoose.connection.close(false, () => {
      console.log('✅ MongoDB connection closed');
      process.exit(0);
    });
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
