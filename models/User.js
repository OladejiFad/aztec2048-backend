const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  twitterId: { type: String, required: true, unique: true },
  username: { type: String },
  displayName: { type: String },
  photo: { type: String },
  totalScore: { type: Number, default: 0 }, // existing field
  weeklyScores: [ // track weekly scores for anti-cheat
    {
      score: Number,
      date: { type: Date, default: Date.now },
    }
  ],
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('User', UserSchema);
