const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const mongoose = require('mongoose');
const twilio = require('twilio');
const { Resend } = require('resend');

// Initialize Twilio client
const twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

// Initialize Resend client
const resend = new Resend('re_Kvij3oTu_49WWphYA3wrh3RMYPwH18jXM');

// Store OTPs in memory (in production, use Redis or similar)
const otpStore = new Map();

// User Schema
const userSchema = new mongoose.Schema({
    fullName: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    mobileNumber: {
        type: String,
        trim: true,
        sparse: true
    },
    firebaseUID: {
        type: String,
        required: true,
        unique: true
    },
    emailVerified: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const User = mongoose.model('User', userSchema);

// Generate OTP
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send SMS using Twilio
async function sendSMSOTP(phone, otp) {
    try {
        const message = await twilioClient.messages.create({
            body: `Your InstaShop verification code is: ${otp}. Valid for 15 minutes.`,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: `+91${phone}` // Adding India country code
        });

        console.log('Twilio Message SID:', message.sid);
        return message;
    } catch (error) {
        console.error('Twilio Error:', error);
        throw new Error('Failed to send OTP');
    }
}

// Add this function to send verification email
async function sendVerificationEmail(email, verificationCode) {
    try {
        await resend.emails.send({
            from: 'InstaShop <onboarding@resend.dev>',
            to: email,
            subject: 'Verify your InstaShop account',
            html: `
                <h2>Welcome to InstaShop!</h2>
                <p>Your verification code is: <strong>${verificationCode}</strong></p>
                <p>This code will expire in 15 minutes.</p>
            `
        });
        return true;
    } catch (error) {
        console.error('Resend Error:', error);
        throw new Error('Failed to send verification email');
    }
}

// Modify the send-otp route to add more error handling and logging
router.post('/send-otp', async (req, res) => {
    try {
        const { phone, email, contactMethod } = req.body;
        console.log('Received request:', { phone, email, contactMethod }); // Debug log

        if (!contactMethod) {
            return res.status(400).json({
                success: false,
                error: 'Contact method is required'
            });
        }

        // Check if we have the required data based on contact method
        if (contactMethod === 'email' && !email) {
            return res.status(400).json({
                success: false,
                error: 'Email is required for email verification'
            });
        }

        if (contactMethod === 'phone' && !phone) {
            return res.status(400).json({
                success: false,
                error: 'Phone number is required for phone verification'
            });
        }

        // Generate OTP first
        const otp = generateOTP();
        console.log('Generated OTP:', otp); // Debug log

        if (contactMethod === 'email') {
            try {
                // Store verification code
                otpStore.set(email, {
                    otp,
                    timestamp: Date.now(),
                    attempts: 0
                });

                // Send verification email
                await sendVerificationEmail(email, otp);
                console.log('Email sent successfully to:', email); // Debug log

                return res.json({
                    success: true,
                    message: 'Verification code sent successfully'
                });
            } catch (emailError) {
                console.error('Email sending error:', emailError);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to send verification email: ' + emailError.message
                });
            }
        } else if (contactMethod === 'phone') {
            try {
                // Store OTP
                otpStore.set(phone, {
                    otp,
                    timestamp: Date.now(),
                    attempts: 0
                });

                // Send OTP via Twilio
                await sendSMSOTP(phone, otp);
                console.log('SMS sent successfully to:', phone); // Debug log

                return res.json({
                    success: true,
                    message: 'OTP sent successfully'
                });
            } catch (smsError) {
                console.error('SMS sending error:', smsError);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to send SMS OTP: ' + smsError.message
                });
            }
        }

    } catch (error) {
        console.error('Error in send-otp route:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
});

// Verify OTP route
router.post('/verify-otp', async (req, res) => {
    try {
        const { phone, otp } = req.body;

        // Get stored OTP data
        const storedData = otpStore.get(phone);
        
        if (!storedData) {
            return res.status(400).json({
                success: false,
                error: 'No OTP found. Please request a new one.'
            });
        }

        // Check if OTP is expired (15 minutes)
        if (Date.now() - storedData.timestamp > 15 * 60 * 1000) {
            otpStore.delete(phone);
            return res.status(400).json({
                success: false,
                error: 'OTP expired. Please request a new one.'
            });
        }

        // Verify OTP
        if (storedData.otp !== otp) {
            storedData.attempts += 1;
            
            if (storedData.attempts >= 3) {
                otpStore.delete(phone);
                return res.status(400).json({
                    success: false,
                    error: 'Too many incorrect attempts. Please request a new OTP.'
                });
            }

            return res.status(400).json({
                success: false,
                error: 'Invalid OTP'
            });
        }

        // OTP verified successfully
        otpStore.delete(phone);
        res.json({
            success: true,
            message: 'OTP verified successfully'
        });

    } catch (error) {
        console.error('Error verifying OTP:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to verify OTP'
        });
    }
});

// Register user endpoint
router.post('/register', async (req, res) => {
    try {
        const { fullName, email, mobileNumber, firebaseUID } = req.body;

        // Create new user in MongoDB
        const user = new User({
            fullName,
            email,
            mobileNumber,
            firebaseUID,
            emailVerified: true
        });

        await user.save();

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            user: {
                fullName: user.fullName,
                email: user.email,
                mobileNumber: user.mobileNumber,
                emailVerified: user.emailVerified
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Registration failed'
        });
    }
});

module.exports = router;