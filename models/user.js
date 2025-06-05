const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  role: {
    type: String,
    enum: ["user", "admin"], //Restricts roles to known types and reduces typos.
    default: "user"
  },
  refreshTokens: [String],
}, {
  timestamps: true  // Automatically adds createdAt and updatedAt fields
});

module.exports = mongoose.model("User", userSchema);
