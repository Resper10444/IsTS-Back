import express from 'express';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import User from '../model/User.js';
import { protect } from '../auth/middleware.js';

import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// ฟังก์ชันสร้าง JWT Token
const generateToken = (userId) => {
    
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

// Email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,  // ใช้จาก .env
    pass: process.env.EMAIL_PASS,  // ใช้จาก .env
  },
  port: 587,  // พอร์ต SMTP มาตรฐานสำหรับ Gmail
  secure: false,  // ใช้ false สำหรับพอร์ต 587, true สำหรับพอร์ต 465
});

// ตรวจสอบการเชื่อมต่อ Nodemailer (optional)
transporter.verify((error, success) => {

  if (error) {
    console.error('Nodemailer connection error:', error);
  } else {
    console.log('Nodemailer is ready to send emails');
  }
});

// Route สำหรับการลงทะเบียน (Register)
router.post('/register', async (req, res) => {
  try {
    const body = req.body;

    if (
      !body.firstName ||
      !body.lastName ||
      !body.employeeId ||
      !body.department ||
      !body.position ||
      !body.email ||
      !body.password ||
      !body.confirmPassword ||
      !body.phoneNumber
    ) {
      return res.status(400).json({
        message: 'All fields are required',
      });
    }

    const user = await User.create({
      firstName: body.firstName,
      lastName: body.lastName,
      employeeId: body.employeeId,
      department: body.department,
      position: body.position,
      email: body.email,
      password: body.password,
      confirmPassword: body.confirmPassword,
      phoneNumber: body.phoneNumber,
    });

    const token = generateToken(user._id);

    const userResponse = {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      employeeId: user.employeeId,
      department: user.department,
      position: user.position,
      email: user.email,
      phoneNumber: user.phoneNumber,
      role: user.role,
      createdAt: user.createdAt,
    };

    return res.status(201).json({
      message: 'Register Success',
      data: userResponse,
      token: token,
      success:true
    });
  } catch (error) {
    if (error.name === 'MongoServerError' && error.code === 11000) {
      return res.status(400).json({
        message: 'Email or Employee ID already exists',
      });
    } else if (error.name === 'ValidationError') {
      return res.status(400).json({
        message: error.message,
      });
    }

    return res.status(500).json({
      message: 'Internal Server Error',
      error: error.message,
    });
  }
});

// Route สำหรับการล็อกอิน (Login)
router.post('/login', async (req, res) => {
  try {
    const { employeeId, password } = req.body;

    if (!employeeId || !password) {
      return res.status(400).json({
        message: 'Employee ID and password are required',
      });
    }

    const user = await User.findOne({ employeeId }).select('+password');

    if (!user) {
      return res.status(401).json({
        message: 'Invalid employeeId or password',
      });
    }

    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({
        message: 'Invalid employeeId or password',
      });
    }

    const token = generateToken(user._id);

    const userResponse = {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      employeeId: user.employeeId,
      department: user.department,
      position: user.position,
      email: user.email,
      phoneNumber: user.phoneNumber,
      role: user.role,
      createdAt: user.createdAt,
    };

    return res.status(200).json({
      message: 'Login Success',
      success: true,
      data: userResponse,
      token: token,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Internal Server Error',
      error: error.message,
    });
  }
});

// Route ส่งคำขอรีเซ็ตรหัสผ่าน (Forgot Password)
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const resetToken = generateToken(user._id);
    const resetLink = `http://localhost:5173/reset-password?token=${resetToken}`;

    console.log('Sending email to:', user.email);
    console.log('Reset Link:', resetLink);

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: 'Password Reset Request',
      html: `<p>Click <a href="${resetLink}">here</a> to reset your password. This link expires in 24 hours.</p>`,
    });

    return res.status(200).json({ message: 'Reset link sent to your email' });
  } catch (error) {
    console.error('Email sending error:', error);
    return res.status(500).json({
      message: 'Internal Server Error',
      error: error.message,
    });
  }
});

// Route รีเซ็ตรหัสผ่าน (Reset Password)
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body;

    if (!token || !password || !confirmPassword) {
      return res.status(400).json({
        message: 'Token, password, and confirm password are required',
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(400).json({ message: 'Invalid token YOK' });
    }

    user.password = password;
    user.confirmPassword = confirmPassword;
    await user.save();

    return res.status(200).json({ message: 'Password reset successfully' });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(400).json({ message: 'Reset token has expired' });
    }
    return res.status(500).json({
      message: 'Internal Server Error',
      error: error.message,
    });
  }
});

router.post('/change-password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmNewPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return res.status(400).json({
        message: 'Current password, new password, and confirm new password are required',
      });
    }

    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({ message: 'New passwords do not match' });
    }

    const user = await User.findById(req.user.id).select('+password');

    const isMatch = await user.matchPassword(currentPassword);

    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    return res.status(200).json({ message: 'Password changed successfully' });
  } catch (error) {
    return res.status(500).json({
      message: 'Internal Server Error',
      error: error.message,
    });
  }
});

export default router;