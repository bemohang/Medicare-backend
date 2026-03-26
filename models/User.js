const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    firstName:      { 
      type: String, 
      required: true, 
      trim: true
     },
    lastName:       { 
      type: String,
       required: true,
        trim: true
       },
    email:          {
       type: String, 
       required: true, 
       unique: true, 
       lowercase: true, 
       trim: true 
      },
    passwordHash:   { 
      type: String,
       required: true 
      },
    role:           { 
      type: String, 
      enum: ["PATIENT", "DOCTOR", "ADMIN"], 
      required: true 
    },
    isBlocked:      { 
      type: Boolean, 
      default: false 
    },

    // Doctor fields — only set by admin
    specialization: {
       type: String, 
       default: null
       },
    licenseNumber:  { 
      type: String, 
      default: null 
    },
    // Patient fields
    bloodGroup: {
      type: String,
      enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", null],
      default: null,
    },
    phone:       { 
      type: String, 
      default: null 
    },
    dateOfBirth: { 
      type: Date,   
      default: null 
    },
    gender:      { 
      type: String, 
      enum: ["Male", "Female", "Other", null], 
      default: null 
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
