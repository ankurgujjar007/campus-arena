require('dotenv').config();

const bcrypt = require('bcryptjs');
const { connectDB, getDB, closeDB } = require('../config/db');

const bootstrapAdmin = async () => {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

  if (!email || !password || password.length < 12) {
    throw new Error(
      'Set BOOTSTRAP_ADMIN_EMAIL and a BOOTSTRAP_ADMIN_PASSWORD of at least 12 characters in backend/.env.'
    );
  }

  await connectDB();
  const users = getDB().collection('users');
  const existingUser = await users.findOne({ email });

  if (existingUser) {
    await users.updateOne(
      { _id: existingUser._id },
      { $set: { role: 'admin', updatedAt: new Date() } }
    );
    console.log(`Promoted ${email} to admin. The existing password was kept.`);
    return;
  }

  await users.insertOne({
    name: 'CampusArena Administrator',
    email,
    passwordHash: await bcrypt.hash(password, 12),
    role: 'admin',
    createdAt: new Date()
  });
  console.log(`Created admin account for ${email}.`);
};

bootstrapAdmin()
  .catch((error) => {
    console.error('Admin bootstrap failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDB();
  });
