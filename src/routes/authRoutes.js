    import express from "express";
    import passport from "passport";
    import {
    registerUser,
    loginUser,
    googleAuth,
    } from "../controllers/authController.js";

    const router = express.Router();

    // Manual Auth
    router.post("/signup", registerUser);
    router.post("/login", loginUser);

    // Google OAuth (REST)
    router.post("/google", googleAuth);

    // Google OAuth (redirect flow)
    router.get(
    "/google",
    passport.authenticate("google", { scope: ["profile", "email"] })
    );

    router.get(
    "/google/callback",
    passport.authenticate("google", { failureRedirect: "/" }),
    (req, res) => {
        res.redirect(`${process.env.CLIENT_URL}/dashboard`);
    }
    );

    export default router;
