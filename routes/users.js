const express = require("express");
const router  = express.Router();
const User    = require("../models/User");
const { authenticate, authorize } = require("../middleware/auth");

// GET /api/users/me
router.get("/me", authenticate, (req, res) => res.json(req.user));

// GET /api/users/doctors — any authenticated user
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

// GET /api/users — admin only, filter by role
router.get("/", authenticate, authorize("ADMIN"), async (req, res) => {
  try {
    const filter = req.query.role ? { role: req.query.role } : {};
    const users  = await User.find(filter).select("-passwordHash").sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// PUT /api/users/me/profile — update own profile (all roles)
// Non-sensitive fields update freely.
// Email change requires current password verification.
// Password change requires current password verification.
router.put("/me/profile", authenticate, async (req, res) => {
  try {
    const {
      firstName, lastName, phone, gender, dateOfBirth, bloodGroup,
      // email change
      newEmail, currentPasswordForEmail,
      // password change
      currentPassword, newPassword,
    } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found." });

    // ── Non-sensitive fields — update freely ──────────────────────
    if (firstName    !== undefined) user.firstName    = firstName.trim();
    if (lastName     !== undefined) user.lastName     = lastName.trim();
    if (phone        !== undefined) user.phone        = phone || null;
    if (gender       !== undefined) user.gender       = gender || null;
    if (dateOfBirth  !== undefined) user.dateOfBirth  = dateOfBirth ? new Date(dateOfBirth) : null;
    if (bloodGroup   !== undefined) user.bloodGroup   = bloodGroup || null;

    // ── Email change — requires current password ──────────────────
    if (newEmail) {
      if (!currentPasswordForEmail) {
        return res.status(400).json({ message: "Current password is required to change your email." });
      }
      const match = await require("bcryptjs").compare(currentPasswordForEmail, user.passwordHash);
      if (!match) return res.status(401).json({ message: "Current password is incorrect." });

      const taken = await User.findOne({ email: newEmail.toLowerCase().trim(), _id: { $ne: user._id } });
      if (taken) return res.status(409).json({ message: "That email address is already in use." });

      user.email = newEmail.toLowerCase().trim();
    }

    // ── Password change — requires current password ───────────────
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ message: "Current password is required to set a new password." });
      }
      const match = await require("bcryptjs").compare(currentPassword, user.passwordHash);
      if (!match) return res.status(401).json({ message: "Current password is incorrect." });

      if (newPassword.length < 6) {
        return res.status(400).json({ message: "New password must be at least 6 characters." });
      }
      user.passwordHash = await require("bcryptjs").hash(newPassword, 12);
    }

    await user.save();

    const updated = user.toObject();
    delete updated.passwordHash;

    res.json({ message: "Profile updated successfully.", user: updated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/users/:id/block — admin only (block or unblock)
router.put("/:id/block", authenticate, authorize("ADMIN"), async (req, res) => {
  try {
    const { blocked } = req.body;
    if (typeof blocked !== "boolean") {
      return res.status(400).json({ message: "'blocked' must be a boolean." });
    }
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ message: "You cannot block your own account." });
    }
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isBlocked: blocked },
      { new: true }
    ).select("-passwordHash");
    if (!user) return res.status(404).json({ message: "User not found." });
    res.json({ message: `User ${blocked ? "blocked" : "unblocked"} successfully.`, user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/users/:id — admin only (permanently delete user)
router.delete("/:id", authenticate, authorize("ADMIN"), async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ message: "You cannot delete your own account." });
    }
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found." });
    res.json({ message: `${user.firstName} ${user.lastName} has been permanently deleted.` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
