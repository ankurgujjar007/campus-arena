const { verifyToken } = require('../utils/jwt');
const { getUserAuthById } = require('../services/auth.service');

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Authentication token is required.'
    });
  }

  let decodedUser;
  try {
    decodedUser = verifyToken(token);
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token.'
    });
  }

  try {
    const currentUser = await getUserAuthById(decodedUser.id);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: 'User account no longer exists.'
      });
    }

    req.user = currentUser;
    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = authMiddleware;
