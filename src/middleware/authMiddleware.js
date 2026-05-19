import jwt from "jsonwebtoken";
import User from "../models/User.js";

// Legacy middleware kept compatible with tokens minted by the new
// modules/auth pipeline. Those tokens use `sub` (standard JWT claim) and
// are signed with JWT_ACCESS_SECRET when present.
export const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(
        token,
        process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET
      );
      // Accept either `sub` (new module) or `id` (legacy controllers) so
      // tokens from both signing paths work during the transition.
      const userId = decoded.sub || decoded.id;
      if (!userId) {
        return res
          .status(401)
          .json({ message: "Not authorized, invalid token payload" });
      }
      req.user = await User.findById(userId).select("-password");
      if (!req.user) {
        return res
          .status(401)
          .json({ message: "Not authorized, user not found" });
      }
      return next();
    } catch (err) {
      return res
        .status(401)
        .json({ message: "Not authorized, token failed" });
    }
  }

  return res.status(401).json({ message: "Not authorized, no token" });
};
