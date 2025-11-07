// models/User.js
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String },
    googleId: { type: String },
    avatar: { type: String },
    profilePicture: { 
      type: String,
      default: null 
    },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);