const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const authRoutes        = require("./routes/auth");
const userRoutes        = require("./routes/users");
const appointmentRoutes = require("./routes/appointments");

const server = express();
const PORT   = process.env.PORT || 5000;

server.use(cors({ origin: "*" }));
server.use(express.json());
server.use(express.urlencoded({ extended: true }));

server.use("/api/auth",         authRoutes);
server.use("/api/users",        userRoutes);
server.use("/api/appointments", appointmentRoutes);

server.get("/", (_req, res) => res.json({ message: "MediCare API running" }));

server.use((_req, res) => res.status(404).json({ message: "Route not found" }));
server.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Internal server error" });
});

mongoose
  .connect(process.env.DB_URI)
  .then(() => {
    console.log("Connected to MongoDB ");
    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("DB connection failed:", err.message);
    process.exit(1);
  });
