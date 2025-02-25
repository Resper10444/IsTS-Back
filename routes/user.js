import express from 'express';
import User from '../model/User.js';
import { protect, authorizeHeadAdmin } from '../auth/middleware.js';

const router = express.Router();

// Route สำหรับอัปเดตบทบาท (เฉพาะ HeadAdmin)
router.put('/:id/role', protect, authorizeHeadAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const { role } = req.body;

    // ตรวจสอบว่า role ใหม่ถูกต้อง
    if (!['HeadAdmin', 'Admin', 'User'].includes(role)) {
      return res.status(400).json({
        message: 'Invalid role. Role must be HeadAdmin, Admin, or User',
      });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({
        message: 'User not found',
      });
    }

    if (targetUser.role === 'HeadAdmin') {
      return res.status(403).json({
        message: 'Cannot update the role of a HeadAdmin',
      });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { role: role },
      { new: true, runValidators: true }
    );

    const userResponse = {
      id: updatedUser._id,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      employeeId: updatedUser.employeeId,
      department: updatedUser.department,
      position: updatedUser.position,
      email: updatedUser.email,
      phoneNumber: updatedUser.phoneNumber,
      role: updatedUser.role,
      createdAt: updatedUser.createdAt,
    };

    return res.status(200).json({
      message: 'User role updated successfully',
      data: userResponse,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Internal Server Error',
      error: error.message,
    });
  }
});

export default router;