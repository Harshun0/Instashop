const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const twilio = require('twilio');

// Configure email transporter (replace with your email credentials)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    requireTLS: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD
    },
    debug: true // This will help us see detailed errors
});

// Add this to test the connection
transporter.verify(function(error, success) {
    if (error) {
        console.log("Email setup error:", error);
    } else {
        console.log("Email server is ready");
    }
});

// Configure Twilio (replace with your Twilio credentials)
const twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

// Store OTPs temporarily (in production, use Redis or a database)
const otpStore = new Map();

// Generate 6-digit OTP
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send OTP route
router.post('/send-otp', async (req, res) => {
    try {
        const { contactMethod, email, phone } = req.body;
        const otp = generateOTP();
        
        if (contactMethod === 'email') {
            // Send email OTP
            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: email,
                subject: 'Your OTP for Registration',
                text: `Your OTP is: ${otp}. Valid for 5 minutes.`
            });

            // Store OTP
            otpStore.set(email, {
                otp,
                timestamp: Date.now(),
                attempts: 0
            });
        } else if (contactMethod === 'phone') {
            // Send SMS OTP
            await twilioClient.messages.create({
                body: `Your OTP is: ${otp}. Valid for 5 minutes.`,
                from: process.env.TWILIO_PHONE_NUMBER,
                to: phone
            });

            // Store OTP
            otpStore.set(phone, {
                otp,
                timestamp: Date.now(),
                attempts: 0
            });
        }

        // Delete OTP after 5 minutes
        setTimeout(() => {
            otpStore.delete(contactMethod === 'email' ? email : phone);
        }, 5 * 60 * 1000);

        res.json({ success: true, message: 'OTP sent successfully' });
    } catch (error) {
        console.error('Error sending OTP:', error);
        res.status(500).json({ success: false, error: 'Failed to send OTP' });
    }
});

// Verify OTP route
router.post('/verify-otp', (req, res) => {
    try {
        const { contactMethod, email, phone, otp } = req.body;
        const identifier = contactMethod === 'email' ? email : phone;
        const storedData = otpStore.get(identifier);

        if (!storedData) {
            return res.json({ success: false, error: 'OTP expired or not found' });
        }

        // Increment attempts
        storedData.attempts += 1;

        // Check if too many attempts
        if (storedData.attempts > 3) {
            otpStore.delete(identifier);
            return res.json({ success: false, error: 'Too many attempts. Please request new OTP' });
        }

        // Check if OTP is expired (5 minutes)
        if (Date.now() - storedData.timestamp > 5 * 60 * 1000) {
            otpStore.delete(identifier);
            return res.json({ success: false, error: 'OTP expired' });
        }

        // Verify OTP
        if (storedData.otp === otp) {
            otpStore.delete(identifier);
            return res.json({ success: true, message: 'OTP verified successfully' });
        }

        res.json({ success: false, error: 'Invalid OTP' });
    } catch (error) {
        console.error('Error verifying OTP:', error);
        res.status(500).json({ success: false, error: 'Failed to verify OTP' });
    }
});

module.exports = router; 