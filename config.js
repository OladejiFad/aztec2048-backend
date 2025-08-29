require('dotenv').config();
const mongoose = require('mongoose');
const passport = require('passport');
const TwitterStrategy = require('passport-twitter').Strategy;
const jwt = require('jsonwebtoken');
const User = require('./models/User');

// --- Connect to MongoDB ---
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected from config.js'))
  .catch((err) => console.log('❌ MongoDB connection error:', err));

// --- Passport Twitter strategy ---
passport.use(
  new TwitterStrategy(
    {
      consumerKey: process.env.TWITTER_CONSUMER_KEY,
      consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
      callbackURL: process.env.TWITTER_CALLBACK_URL,
    },
    async (token, tokenSecret, profile, done) => {
      try {
        let user = await User.findOne({ twitterId: profile.id });

        if (!user) {
          user = await User.create({
            twitterId: profile.id,
            username: profile.username,
            displayName: profile.displayName,
            photo: profile.photos[0]?.value,
          });
        }

        // Generate JWT token
        const jwtToken = jwt.sign(
          { id: user._id, username: user.username },
          process.env.JWT_SECRET,
          { expiresIn: '7d' }
        );

        // Attach token to user object
        user.jwtToken = jwtToken;

        done(null, user);
      } catch (err) {
        done(err, null);
      }
    }
  )
);

// --- Serialize / Deserialize user (for session) ---
passport.serializeUser((user, done) => done(null, user._id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

module.exports = passport;
