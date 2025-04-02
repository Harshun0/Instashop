const express = require("express");
const { OAuth2Client } = require("google-auth-library");
const mongoose = require("mongoose");
const User = require("../models/User"); // Ensure this points to the correct User model
const router = express.Router();
const jwt = require("jsonwebtoken");
require("dotenv").config();
const JWT_SECRET = process.env.JWT_SECRET;
// Replace with your actual Google Client ID
const GOOGLE_CLIENT_ID = "91993078765-0lceomm0s2eadih3thuedhms49jbfevl.apps.googleusercontent.com";
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

router.post("/api/auth/google", async (req, res) => {
    const token = req.body.token || req.body.credential;

    if (!token) {
        return res.status(400).json({ success: false, error: "Authentication token is required" });
    }

    try {
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        if (!payload) {
            return res.status(400).json({ success: false, error: "Invalid token payload" });
        }

        const { email, name, picture, sub } = payload;

        if (!email) {
            return res.status(400).json({ success: false, error: "Email not provided in Google authentication" });
        }

        // Check if the user exists, else create a new one
        let user = await User.findOne({ email });

        if (!user) {
            user = new User({
                name: name, // Ensure correct field name
                email: email,
                profilePic: picture,
                googleId: sub // Store Google's user ID
            });
            await user.save();
            console.log(`✅ New user created via Google auth: ${email}`);
        } else {
            console.log(`✅ Existing user logged in via Google: ${email}`);
        }
        const authToken = jwt.sign({ userId: user._id, email: user.email }, JWT_SECRET, {
            expiresIn: "7d", // Token valid for 7 days
        });
        console.log("Generated JWT Token:", authToken);
        // Return user info (excluding sensitive fields)
        res.json({
            success: true,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                profilePic: user.profilePic
            },token: authToken,
        });
    } catch (error) {
        console.error("❌ Google Auth Error:", error.message);
        res.status(500).json({ success: false, error: "Authentication failed" });
    }
});

module.exports = router;