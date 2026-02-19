// server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", require("./src/routes/auth"));

// Test route
app.get("/", (req, res) => {
  res.send("Backend is working!");
});

// Start server
app.listen(process.env.PORT, () => {
  console.log(` Server running on port ${process.env.PORT}`);
});
