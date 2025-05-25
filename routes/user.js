// routes/user.js
import express from "express";
const User = require("./models/user")

const router = express.Router();

router.post("/auth/google", async (req, res) => {
  const { email, name } = req.body;

  try {
    let user = await User.findOne({email});

    if (!user) {
      user = await User.create({ email, name });
    }

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ error: "User creation failed" });
  }
});

export default router;
