const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  // Check for token in cookies
  token = req.cookies.token;
  console.log('Cookies received:', req.cookies);
  console.log('Token from cookies:', token);
  
  // Also check for token in header (fallback)
  if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      console.log('Token from header:', token);
    } catch (error) {
      // Ignore header token if malformed
      console.log('Error getting token from header:', error.message);
    }
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
      console.log('User authenticated:', req.user._id);
      next();
    } catch (error) {
      console.log('Token verification failed:', error.message);
      res.status(401).json({ message: 'Not authorized, token failed' });
    }
  } else {
    console.log('No token found in cookies or headers');
    res.status(401).json({ message: 'Not authorized, no token' });
  }
};

module.exports = { protect };