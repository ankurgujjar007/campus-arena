const bcrypt = require('bcryptjs');
const { ObjectId } = require('mongodb');
const { getDB } = require('../config/db');

const USER_ROLES = ['player', 'admin', 'referee', 'event_manager'];

const registerUser = async ({ name, email, password } = {}) => {
  if (
    typeof name !== 'string' ||
    !name.trim() ||
    typeof email !== 'string' ||
    !email.trim() ||
    typeof password !== 'string' ||
    !password
  ) {
    const error = new Error('Name, email and password are required.');
    error.statusCode = 400;
    throw error;
  }

  const db = getDB();
  const normalizedEmail = email.trim().toLowerCase();

  const existingUser = await db.collection('users').findOne({
    email: normalizedEmail
  });

  if (existingUser) {
    const error = new Error('Email is already registered.');
    error.statusCode = 409;
    throw error;
  }

  const user = {
    name: name.trim(),
    email: normalizedEmail,
    passwordHash: await bcrypt.hash(password, 12),
    role: 'player',
    createdAt: new Date()
  };

  const result = await db.collection('users').insertOne(user);
  const { passwordHash, ...safeUser } = user;

  return {
    ...safeUser,
    _id: result.insertedId
  };
};

const loginUser = async ({ email, password } = {}) => {
  if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password) {
    const error = new Error('Email and password are required.');
    error.statusCode = 400;
    throw error;
  }

  const db = getDB();
  const user = await db.collection('users').findOne({
    email: email.trim().toLowerCase()
  });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    const error = new Error('Invalid email or password.');
    error.statusCode = 401;
    throw error;
  }

  const { passwordHash, ...safeUser } = user;
  return safeUser;
};

const updateUserRole = async (userId, role) => {
  if (!ObjectId.isValid(userId)) {
    const error = new Error('Valid user ID is required.');
    error.statusCode = 400;
    throw error;
  }

  if (!USER_ROLES.includes(role)) {
    const error = new Error(`Role must be one of: ${USER_ROLES.join(', ')}.`);
    error.statusCode = 400;
    throw error;
  }

  const db = getDB();
  const users = db.collection('users');
  const existingUser = await users.findOne({ _id: new ObjectId(userId) });
  if (!existingUser) {
    const error = new Error('User not found.');
    error.statusCode = 404;
    throw error;
  }

  if (existingUser.role === 'admin' && role !== 'admin') {
    const adminCount = await users.countDocuments({ role: 'admin' });
    if (adminCount <= 1) {
      const error = new Error('At least one admin account must remain active.');
      error.statusCode = 409;
      throw error;
    }
  }

  const result = await users.findOneAndUpdate(
    { _id: new ObjectId(userId) },
    { $set: { role, updatedAt: new Date() } },
    { returnDocument: 'after', projection: { passwordHash: 0 } }
  );

  return result;
};

const getUserAuthById = async (userId) => {
  if (!ObjectId.isValid(userId)) return null;

  const user = await getDB()
    .collection('users')
    .findOne({ _id: new ObjectId(userId) }, { projection: { name: 1, email: 1, role: 1 } });

  if (!user) return null;
  return { id: String(user._id), name: user.name, email: user.email, role: user.role };
};

const getUsers = async () => {
  const db = getDB();
  return db
    .collection('users')
    .find({}, { projection: { passwordHash: 0 } })
    .sort({ createdAt: -1 })
    .toArray();
};

module.exports = { registerUser, loginUser, updateUserRole, getUserAuthById, getUsers };
