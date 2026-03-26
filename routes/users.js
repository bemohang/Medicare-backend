const express = require("express");
const router  = express.Router();
const User    = require("../models/User");
const { authenticate, authorize } = require("../middleware/auth");

//users
router.get("/me", authenticate, (req, res) => res.json(req.user));

// doctors  — any authenticated user
router.get("/doctors", authenticate, async (req, res) => {
  try {
    const doctors = await User.find({ role: "DOCTOR", isBlocked: false })
      .select("firstName lastName specialization phone")
      .sort({ firstName: 1 });
    res.json(doctors);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/users  — admin only, filter by role
router.get("/", authenticate, authorize("ADMIN"), async (req, res) => {
  try {
    const filter = req.query.role ? { role: req.query.role } : {};
    const users  = await User.find(filter).select("-passwordHash").sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/users/:id/block  — admin only
router.put("/:id/block", authenticate, authorize("ADMIN"), async (req, res) => {
  try {
    const { blocked } = req.body;
    if (typeof blocked !== "boolean") return res.status(400).json({ message: "'blocked' must be a boolean." });
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ message: "You cannot block your own account." });
    }
    const user = await User.findByIdAndUpdate(req.params.id, { isBlocked: blocked }, { new: true }).select("-passwordHash");
    if (!user) return res.status(404).json({ message: "User not found." });
    res.json({ message: `User ${blocked ? "blocked" : "unblocked"} successfully.`, user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
