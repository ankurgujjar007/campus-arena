const { generateToken } = require('../utils/jwt');
const { sendResponse } = require('../utils/response');
const { registerUser, loginUser, updateUserRole, getUsers } = require('../services/auth.service');

const register = async (req, res, next) => {
  try {
    const user = await registerUser(req.body);
    const token = generateToken({
      id: user._id,
      email: user.email,
      role: user.role
    });

    return sendResponse(res, 201, true, 'User registered successfully', {
      user,
      token
    });
  } catch (error) {
    return next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const user = await loginUser(req.body);
    const token = generateToken({
      id: user._id,
      email: user.email,
      role: user.role
    });

    return sendResponse(res, 200, true, 'User logged in successfully', {
      user,
      token
    });
  } catch (error) {
    return next(error);
  }
};

const updateUserRoleHandler = async (req, res, next) => {
  try {
    const user = await updateUserRole(req.params.id, req.body.role);
    return sendResponse(res, 200, true, 'User role updated successfully', { user });
  } catch (error) {
    return next(error);
  }
};

const getUsersHandler = async (req, res, next) => {
  try {
    const users = await getUsers();
    return sendResponse(res, 200, true, 'Users fetched successfully', users);
  } catch (error) {
    return next(error);
  }
};

module.exports = { register, login, updateUserRoleHandler, getUsersHandler };
