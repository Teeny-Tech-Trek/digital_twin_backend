import  asyncHandler  from "../middleware/asyncHandler.js";

import * as authService from "../services/authService.js";

export const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  const { user, token } = await authService.register({ name, email, password });
  res.status(201).json({ user, token });
});

export const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const { user, token } = await authService.login({ email, password });
  res.json({ user, token });
});

export const googleAuth = asyncHandler(async (req, res) => {
  const { googleId, name, email, avatar } = req.body;
  const { user, token } = await authService.googleLogin({
    googleId,
    name,
    email,
    avatar,
  });
  res.json({ user, token });
});
