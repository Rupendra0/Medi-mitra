import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

export const getMe = async (req, res) => {
  try {
    let token = req.cookies.token;
    if (!token) {
      const authHeader = req.headers.authorization || '';
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      }
    }

    if (!token) {
      return res.status(401).json({ message: 'Not authenticated.' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        uniqueId: user.uniqueId,
        age: user.age,
        gender: user.gender,
        bloodGroup: user.bloodGroup,
        address: user.address,
        emergencyContact: user.emergencyContact,
        specialization: user.specialization
      }
    });
  } catch (err) {
    res.status(401).json({ message: 'Invalid token.' });
  }
};

export const signup = async (req, res) => {
  try {
    const { name, email, phone, password, role, specialization, age, gender, bloodGroup, address, emergencyContact } = req.body;

    // required core fields
    if (!name || !email || !phone || !password || !role) {
      return res.status(400).json({ message: 'Name, email, phone, password and role are required.' });
    }

    if (role === 'doctor' && !specialization) {
      return res.status(400).json({ message: 'Specialization is required for doctors.' });
    }

    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) {
      return res.status(409).json({ message: 'User already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const randomStr = Math.floor(1000 + Math.random() * 9000);
    const prefix = role === "doctor" ? "D" : "P";
    const uniqueId = `${prefix}-${dateStr}-${randomStr}`;

    const userData = {
      name,
      email,
      phone,
      password: hashedPassword,
      role,
      uniqueId,
      ...(role === 'doctor' && { specialization }),
      // only set patient fields when role is patient
      ...(role === 'patient' && { age, gender, bloodGroup, address, emergencyContact }),
    };

    const user = new User(userData);

    await user.save();

    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    // ✅ MODIFIED COOKIE SETTINGS
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // true in production
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // 'none' for cross-site
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.status(201).json({
      user: {
        id: user._id,
        name,
        email,
        phone,
        role,
        uniqueId,
        age: user.age,
        gender: user.gender,
        bloodGroup: user.bloodGroup,
        address: user.address,
        emergencyContact: user.emergencyContact,
        specialization: user.specialization
      },
      token,
    });
  } catch (err) {
    res.status(500).json({ message: 'Signup failed.' });
  }
};

// Update profile (protected route)
export const updateProfile = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Not authenticated.' });

    const allowed = ['name', 'age', 'gender', 'bloodGroup', 'address', 'emergencyContact', 'phone', 'email'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const user = await User.findByIdAndUpdate(userId, updates, { new: true });
    if (!user) return res.status(404).json({ message: 'User not found.' });

    res.json({ user: {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      uniqueId: user.uniqueId,
      age: user.age,
      gender: user.gender,
      bloodGroup: user.bloodGroup,
      address: user.address,
      emergencyContact: user.emergencyContact,
      specialization: user.specialization
    }});
  } catch (err) {
    console.error('UPDATE PROFILE FAILED', err);
    res.status(500).json({ message: 'Update failed.' });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    // ✅ MODIFIED COOKIE SETTINGS
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // true in production
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // 'none' for cross-site
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
    
    res.status(200).json({ user: { id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role }, token });
    
  } catch (err) {
    console.error("LOGIN FAILED:", err);
    res.status(500).json({ message: 'Login failed.' });
  }
};

export const logout = (req, res) => {
  res.cookie('token', '', {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    expires: new Date(0)
  });
  res.status(200).json({ message: 'Logged out successfully.' });
};