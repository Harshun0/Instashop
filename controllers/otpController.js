const nodemailer = require('nodemailer');
const twilio = require('twilio');
const crypto = require('crypto');

// Store OTPs temporarily (in production, use Redis or a database)
const otpStore = new Map();

// Configure email transporter
const emailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'your-email@gmail.com',
        pass: 'your-app-specific-password'
    }
});

// Configure Twilio client
console.log('TWILIO_ACCOUNT_SID:', process.env.TWILIO_ACCOUNT_SID);  // Debug line

const twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

// Generate OTP
function generateOTP() {
    return crypto.randomInt(100000, 999999).toString();
}

// Send OTP via email
async function sendEmailOTP(email, otp) {
    const mailOptions = {
        from: 'your-email@gmail.com',
        to: email,
        subject: 'Your OTP for Registration',
        text: `Your OTP is: ${otp}. Valid for 5 minutes.`
    };

    await emailTransporter.sendMail(mailOptions);
}

// Send OTP via SMS
async function sendSMSOTP(phone, otp) {
    await twilioClient.messages.create({
        body: `Your OTP is: ${otp}. Valid for 5 minutes.`,
        from: 'your_twilio_phone_number',
        to: phone
    });
}

// Controller for sending OTP
exports.sendOTP = async (req, res) => {
    try {
        const { contactMethod, email, phone } = req.body;
        const otp = generateOTP();
        
        // Store OTP with timestamp
        const otpData = {
            otp,
            timestamp: Date.now(),
            attempts: 0
        };

        if (contactMethod === 'email') {
            await sendEmailOTP(email, otp);
            otpStore.set(email, otpData);
        } else {
            await sendSMSOTP(phone, otp);
            otpStore.set(phone, otpData);
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
};

// Controller for verifying OTP
exports.verifyOTP = async (req, res) => {
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
            otpStore.delete(identifier); // Remove OTP after successful verification
            return res.json({ success: true, message: 'OTP verified successfully' });
        }

        res.json({ success: false, error: 'Invalid OTP' });
    } catch (error) {
        console.error('Error verifying OTP:', error);
        res.status(500).json({ success: false, error: 'Failed to verify OTP' });
    }
}; 