const express = require("express");
const router  = express.Router();
const bcrypt  = require("bcryptjs");
const jwt     = require("jsonwebtoken");
const User    = require("../models/User");
const { authenticate, authorize } = require("../middleware/auth");

// PATIENTS ONLY
router.post("/register", async (req, res) => {
  try {
    const { firstName, lastName, email, password, bloodGroup, phone, dateOfBirth, gender } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ message: "First name, last name, email and password are required." });
    }

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ message: "An account with this email already exists." });

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters." });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = new User({
      firstName, lastName, email, passwordHash,
      role: "PATIENT",   
      bloodGroup: bloodGroup || null,
      phone:      phone      || null,
      dateOfBirth: dateOfBirth || null,
      gender:     gender     || null,
    });

    await user.save();
    res.status(201).json({ message: "Account created successfully. You can now log in." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// login  — all roles
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email and password are required." });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: "Invalid email or password." });

    if (user.isBlocked) {
      return res.status(403).json({ message: "Your account has been blocked. Please contact the administrator." });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(401).json({ message: "Invalid email or password." });

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "8h" });

    res.json({
      token,
      user: {
        id:             user._id,
        firstName:      user.firstName,
        lastName:       user.lastName,
        email:          user.email,
        role:           user.role,
        specialization: user.specialization,
        bloodGroup:     user.bloodGroup,
        phone:          user.phone,
        gender:         user.gender,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// create doctor  — ADMIN only creates doctor accounts
router.post("/create-doctor", authenticate, authorize("ADMIN"), async (req, res) => {
  try {
    const { firstName, lastName, email, password, specialization, licenseNumber, phone } = req.body;

    if (!firstName || !lastName || !email || !password || !specialization) {
      return res.status(400).json({ message: "First name, last name, email, password and specialization are required." });
    }

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ message: "An account with this email already exists." });

    const passwordHash = await bcrypt.hash(password, 12);
    const doctor = new User({
      firstName, lastName, email, passwordHash,
      role: "DOCTOR",
      specialization,
      licenseNumber: licenseNumber || null,
      phone:         phone         || null,
    });

    await doctor.save();
    const saved = doctor.toObject();
    delete saved.passwordHash;
    res.status(201).json({ message: "Doctor account created successfully.", doctor: saved });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// create admin  — ADMIN only creates additional admin accounts
router.post("/create-admin", authenticate, authorize("ADMIN"), async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ message: "First name, last name, email and password are required." });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters." });
    }

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ message: "An account with this email already exists." });

    const passwordHash = await bcrypt.hash(password, 12);
    const admin = new User({
      firstName, lastName, email, passwordHash,
      role: "ADMIN",
    });

    await admin.save();
    const saved = admin.toObject();
    delete saved.passwordHash;
    res.status(201).json({ message: "Admin account created successfully.", admin: saved });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// seed-admin  — one-time only, creates first admin if none exists
router.post("/seed-admin", async (req, res) => {
  try {
    const existing = await User.findOne({ role: "ADMIN" });
    if (existing) {
      return res.status(409).json({ message: "An admin account already exists. Use the dashboard to create more." });
    }
    const passwordHash = await bcrypt.hash("Admin@123", 12);
    const admin = new User({
      firstName: "System", lastName: "Admin",
      email: "admin@medicare.com", passwordHash,
      role: "ADMIN",
    });
    await admin.save();
    res.status(201).json({
      message: "Seed admin created. Email: admin@medicare.com  Password: Admin@123 — Change this immediately after login.",
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
