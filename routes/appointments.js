const express     = require("express");
const router      = express.Router();
const Appointment = require("../models/Appointment");
const User        = require("../models/User");
const { authenticate, authorize } = require("../middleware/auth");

// check slot taken
const isSlotTaken = async (doctorId, date, time, excludeId = null) => {
  if (!doctorId) return false;
  const query = {
    doctor:          doctorId,
    appointmentDate: new Date(date),
    appointmentTime: time,
    status:          { $in: ["PENDING", "CONFIRMED"] },
  };
  if (excludeId) query._id = { $ne: excludeId };
  return !!(await Appointment.findOne(query));
};

// scoped by role
router.get("/", authenticate, async (req, res) => {
  try {
    let filter = {};
    if (req.user.role === "PATIENT") filter.patient = req.user._id;
    if (req.user.role === "DOCTOR")  filter.doctor  = req.user._id;

    const appointments = await Appointment.find(filter)
      .populate("patient",     "firstName lastName email bloodGroup phone gender")
      .populate("doctor",      "firstName lastName specialization")
      .populate("cancelledBy", "firstName lastName")
      .sort({ appointmentDate: -1, appointmentTime: -1 });

    res.json(appointments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// GET /api/appointments/slots?doctorId=X&date=YYYY-MM-DD
// Returns booked time slots for a doctor on a given date
// Accessible by ADMIN and DOCTOR
router.get("/slots", authenticate, async (req, res) => {
  try {
    const { doctorId, date } = req.query;
    if (!doctorId || !date) {
      return res.status(400).json({ message: "doctorId and date are required." });
    }

    // Doctors can only query their own slots
    if (req.user.role === "DOCTOR" && req.user._id.toString() !== doctorId) {
      return res.status(403).json({ message: "You can only view your own slots." });
    }

    const startOfDay = new Date(`${date}T00:00:00.000Z`);
    const endOfDay   = new Date(`${date}T23:59:59.999Z`);

    const booked = await Appointment.find({
      doctor:          doctorId,
      appointmentDate: { $gte: startOfDay, $lte: endOfDay },
      status:          { $in: ["PENDING", "CONFIRMED"] },
    }).select("appointmentTime status patient").populate("patient", "firstName lastName");

    // Generate all 30-minute slots 08:00 – 17:30
    const allSlots = [];
    for (let h = 8; h <= 17; h++) {
      for (let m of [0, 30]) {
        if (h === 17 && m === 30) break;
        const time = `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
        const bookedAppt = booked.find((b) => b.appointmentTime === time);
        allSlots.push({
          time,
          available: !bookedAppt,
          appointment: bookedAppt || null,
        });
      }
    }

    res.json({ date, doctorId, slots: allSlots, bookedCount: booked.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATIENT books 
router.post("/", authenticate, authorize("PATIENT"), async (req, res) => {
  try {
    const { appointmentDate, appointmentTime, reason, doctorRequest } = req.body;

    if (!appointmentDate || !appointmentTime) {
      return res.status(400).json({ message: "Date and time are required." });
    }

    const apptDateTime = new Date(`${appointmentDate}T${appointmentTime}`);
    if (apptDateTime < new Date()) {
      return res.status(400).json({ message: "Cannot book an appointment in the past." });
    }

    const appointment = new Appointment({
      patient:         req.user._id,
      doctor:          null,           // Admin will assign
      doctorRequest:   doctorRequest || null,
      appointmentDate: new Date(appointmentDate),
      appointmentTime,
      reason:          reason || "",
      status:          "PENDING",
    });

    await appointment.save();
    await appointment.populate("patient", "firstName lastName email");
    res.status(201).json(appointment);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

//Admin assigns doctor — optionally updates the appointment time slot
router.put("/:id/assign", authenticate, authorize("ADMIN"), async (req, res) => {
  try {
    const { doctorId, appointmentTime } = req.body;
    if (!doctorId) return res.status(400).json({ message: "doctorId is required." });

    const appt = await Appointment.findById(req.params.id);
    if (!appt)     return res.status(404).json({ message: "Appointment not found." });
    if (["CANCELLED", "COMPLETED"].includes(appt.status)) {
      return res.status(400).json({ message: "Cannot modify a closed appointment." });
    }

    const doctor = await User.findById(doctorId);
    if (!doctor || doctor.role !== "DOCTOR") return res.status(404).json({ message: "Doctor not found." });

    // Use the admin-selected slot if provided, otherwise keep the original time
    const finalTime = appointmentTime || appt.appointmentTime;

    const taken = await isSlotTaken(
      doctorId,
      appt.appointmentDate.toISOString().split("T")[0],
      finalTime,
      appt._id
    );
    if (taken) return res.status(409).json({ message: "This doctor is already booked at that time. Choose another slot." });

    appt.doctor          = doctorId;
    appt.appointmentTime = finalTime;
    appt.status          = "CONFIRMED";
    await appt.save();
    await appt.populate("doctor",  "firstName lastName specialization");
    await appt.populate("patient", "firstName lastName email");
    res.json(appt);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DOCTOR marks complete — requires diagnosis + medication
router.put("/:id/complete", authenticate, authorize("DOCTOR"), async (req, res) => {
  try {
    const { diagnosis, medication, followUpDate, referralNotes } = req.body;

    if (!diagnosis || !diagnosis.trim()) {
      return res.status(400).json({ message: "Diagnosis is required to complete an appointment." });
    }
    if (!medication || !medication.trim()) {
      return res.status(400).json({ message: "Medication / treatment notes are required to complete an appointment." });
    }

    const appt = await Appointment.findById(req.params.id);
    if (!appt) return res.status(404).json({ message: "Appointment not found." });
    if (appt.doctor?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "This is not your appointment." });
    }
    if (appt.status === "CANCELLED") return res.status(400).json({ message: "Cannot complete a cancelled appointment." });
    if (appt.status === "COMPLETED") return res.status(400).json({ message: "Appointment is already completed." });

    appt.status        = "COMPLETED";
    appt.completedAt   = new Date();
    appt.diagnosis     = diagnosis.trim();
    appt.medication    = medication.trim();
    appt.followUpDate  = followUpDate ? new Date(followUpDate) : null;
    appt.referralNotes = referralNotes ? referralNotes.trim() : null;

    await appt.save();
    await appt.populate("doctor",  "firstName lastName specialization");
    await appt.populate("patient", "firstName lastName email");
    res.json(appt);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// cancel  — patient / doctor / admin
router.put("/:id/cancel", authenticate, async (req, res) => {
  try {
    const { cancelReason } = req.body;
    const appt = await Appointment.findById(req.params.id);
    if (!appt) return res.status(404).json({ message: "Appointment not found." });
    if (appt.status === "CANCELLED") return res.status(400).json({ message: "Appointment is already cancelled." });
    if (appt.status === "COMPLETED") return res.status(400).json({ message: "Cannot cancel a completed appointment." });

    const uid  = req.user._id.toString();
    const role = req.user.role;
    if (role === "PATIENT" && appt.patient.toString() !== uid) {
      return res.status(403).json({ message: "This is not your appointment." });
    }
    if (role === "DOCTOR" && appt.doctor?.toString() !== uid) {
      return res.status(403).json({ message: "This is not your appointment." });
    }

    appt.status          = "CANCELLED";
    appt.cancelledBy     = req.user._id;
    appt.cancelledByRole = role;
    appt.cancelReason    = cancelReason || "No reason provided.";
    appt.cancelledAt     = new Date();
    await appt.save();
    await appt.populate("doctor",      "firstName lastName specialization");
    await appt.populate("patient",     "firstName lastName email");
    await appt.populate("cancelledBy", "firstName lastName");
    res.json(appt);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
