const jwt = require('jsonwebtoken');

const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET || 'campusarena_secret_key', {
    expiresIn: '7d'
  });
};

const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET || 'campusarena_secret_key');
};

module.exports = { generateToken, verifyToken };
