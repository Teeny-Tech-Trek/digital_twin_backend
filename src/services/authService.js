// services/authService.js
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { generateToken } from "../utils/generateToken.js";

export const register = async ({ name, email, password }) => {
  const existing = await User.findOne({ email });
  if (existing) throw new Error("User already exists");

  const hashed = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, password: hashed });
  const token = generateToken(user._id);
  return { user, token };
};

export const login = async ({ email, password }) => {
  const user = await User.findOne({ email });
  if (!user) throw new Error("User not found");

  const match = await bcrypt.compare(password, user.password);
  if (!match) throw new Error("Invalid password");

  const token = generateToken(user._id);
  return { user, token };
};

export const googleLogin = async ({ googleId, name, email, avatar }) => {
  let user = await User.findOne({ email });
  if (!user) user = await User.create({ googleId, name, email, avatar });

  const token = generateToken(user._id);
  return { user, token };
};

export const updateProfilePicture = async (userId, profilePictureUrl) => {
  const user = await User.findByIdAndUpdate(
    userId,
    { profilePicture: profilePictureUrl },
    { new: true }
  );
  if (!user) throw new Error("User not found");
  return user;
};

export const getUserProfile = async (userId) => {
  const user = await User.findById(userId).select('-password');
  if (!user) throw new Error("User not found");
  return user;
};