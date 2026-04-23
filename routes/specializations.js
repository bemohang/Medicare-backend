const express        = require("express");
const router         = express.Router();
const Specialization = require("../models/Specialization");
const { authenticate, authorize } = require("../middleware/auth");

// GET /api/specializations — all authenticated users (needed by Add Doctor form)
router.get("/", authenticate, async (req, res) => {
  try {
    const specs = await Specialization.find().sort({ name: 1 });
    res.json(specs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/specializations — admin only
router.post("/", authenticate, authorize("ADMIN"), async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Specialization name is required." });
    }
    const existing = await Specialization.findOne({
      name: { $regex: `^${name.trim()}$`, $options: "i" },
    });
    if (existing) {
      return res.status(409).json({ message: "This specialization already exists." });
    }
    const spec = await Specialization.create({ name: name.trim() });
    res.status(201).json(spec);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/specializations/:id — admin only
router.put("/:id", authenticate, authorize("ADMIN"), async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Specialization name is required." });
    }
    const existing = await Specialization.findOne({
      name: { $regex: `^${name.trim()}$`, $options: "i" },
      _id:  { $ne: req.params.id },
    });
    if (existing) {
      return res.status(409).json({ message: "A specialization with that name already exists." });
    }
    const spec = await Specialization.findByIdAndUpdate(
      req.params.id,
      { name: name.trim() },
      { new: true }
    );
    if (!spec) return res.status(404).json({ message: "Specialization not found." });
    res.json(spec);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/specializations/:id — admin only
router.delete("/:id", authenticate, authorize("ADMIN"), async (req, res) => {
  try {
    const spec = await Specialization.findByIdAndDelete(req.params.id);
    if (!spec) return res.status(404).json({ message: "Specialization not found." });
    res.json({ message: `"${spec.name}" deleted successfully.` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
