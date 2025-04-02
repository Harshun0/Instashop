const express = require("express");
const router = express.Router();
const nodemailer = require("nodemailer");
const twilio = require("twilio");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
require("dotenv").config();

// In-memory OTP storage (for testing)
const otpStore = {};

// Configure Nodemailer for Email OTP
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// Configure Twilio for SMS OTP
const twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

// Generate OTP Function
const generateOTP = () => crypto.randomInt(100000, 999999).toString();

// Route: Send OTP (Email & SMS)
router.post("/send-otp", async (req, res) => {
    const { email, mobileNumber } = req.body;
    
    if (!email || !mobileNumber) {
        return res.status(400).json({ success: false, message: "Email and mobile number are required." });
    }

    const otp = generateOTP();
    otpStore[email] = otp;
    otpStore[mobileNumber] = otp;

    try {
        // Send OTP via Email
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: "Your OTP for Registration",
            text: `Your OTP is: ${otp}`,
        });

        // Send OTP via SMS
        await twilioClient.messages.create({
            body: `Your OTP is: ${otp}`,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: `+91${mobileNumber}`, // Change country code if needed
        });

        res.json({ success: true, message: "OTP sent successfully." });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error sending OTP.", error });
    }
});

// Route: Verify OTP
router.post("/verify-otp", (req, res) => {
    const { email, mobileNumber, otp } = req.body;

    if (otpStore[email] === otp && otpStore[mobileNumber] === otp) {
        delete otpStore[email];
        delete otpStore[mobileNumber];
        res.json({ success: true, message: "OTP verified successfully." });
    } else {
        res.status(400).json({ success: false, message: "Invalid OTP." });
    }
});

// Route: Register User (After OTP Verification)
router.post("/register", async (req, res) => {
    const { fullName, email, password, mobileNumber } = req.body;

    if (!fullName || !email || !password || !mobileNumber) {
        return res.status(400).json({ success: false, message: "All fields are required." });
    }

    // Here, you should hash the password and store the user in MongoDB (not included in this snippet)
    // For now, let's assume registration is successful
    const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: "1h" });

    res.json({ success: true, message: "User registered successfully.", token });
});

module.exports = router;
