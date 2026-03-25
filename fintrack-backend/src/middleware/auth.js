const jwt = require('jsonwebtoken');

const generateToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '10d' }
  );
};

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Token topilmadi'
      });
    }
    const token = authHeader.split(' ')[1];
    if (!token || token === 'undefined' || token === 'null') {
      return res.status(401).json({
        success: false,
        error: "Token noto'g'ri formatda"
      });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role || 'user'
    };
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token muddati tugagan'
      });
    }
    return res.status(401).json({
      success: false,
      error: "Token noto'g'ri yoki sessiya tugagan",
      message: error.message
    });
  }
};

module.exports = { authenticate, generateToken };