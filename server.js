require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const passport = require('./config'); // your updated passport config
const authRoutes = require('./routes/auth');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 10000;

// --- Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS setup to allow frontend requests with credentials
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })
);

// --- Passport initialization ---
app.use(passport.initialize()); // no session() needed for JWT

// --- Routes ---
app.use('/auth', authRoutes);

// --- Simple root test route ---
app.get('/', (req, res) => {
  res.json({ message: 'Aztec2048 Backend is running!' });
});

// --- Connect MongoDB ---
mongoose
  .connect(process.env.MONGO_URI, {
    // useNewUrlParser and useUnifiedTopology are optional in v4+
  })
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// --- Start server ---
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`✅ Available at frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
});
