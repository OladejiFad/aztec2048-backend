const mongoose = require('mongoose');

const weeklyScoreSchema = new mongoose.Schema({
  score: { type: Number, default: 0 },
  date: { type: Date, default: Date.now },
});

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  displayName: { type: String },
  photo: { type: String, default: '' },
  totalScore: { type: Number, default: 0 },
  weeklyScores: [weeklyScoreSchema],
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
