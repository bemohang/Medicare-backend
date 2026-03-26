const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema(
  {
    patient:      
       { type: mongoose.Schema.Types.ObjectId,
         ref: "User",
          required: true 
        },
    doctor:          
    { type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      default: null
     },
    // Patient's requested doctor 
    doctorRequest: 
      { type: String, 
        default: null
       },
    appointmentDate: 
    { type: Date,   
      required: true
     },
    appointmentTime: 
    { type: String, 
      required: true
     },
    reason:          
    { type: String, 
      trim: true, 
      default: "" 
    },
    status: {
      type:    String,
      enum:    ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"],
      default: "PENDING",
    },
    
    completedAt: { 
      type: Date, 
      default: null 
    },
    
    cancelledBy:     
    { type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      default: null
     },
    cancelledByRole: 
    { type: String, 
      enum: ["PATIENT", "DOCTOR", "ADMIN", null], 
      default: null
     },
    cancelReason:    
    { type: String, 
      default: null 
    },
    cancelledAt:     
    { type: Date,   
      default: null 
    },
  },
  { timestamps: true }
);

// Prevent double-booking: same doctor + date + time (active slots only)
appointmentSchema.index(
  { doctor: 1, appointmentDate: 1, appointmentTime: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ["PENDING", "CONFIRMED"] },
      doctor: { $ne: null },
    },
  }
);

module.exports = mongoose.model("Appointment", appointmentSchema);
