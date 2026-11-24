const { MongoClient } = require('mongodb');
const client = new MongoClient(process.env.MONGODB_URI);
let db;
const connectDB = async () => {
  try {
    await client.connect();
    db = client.db(process.env.DB_NAME);
    await db
      .collection('players')
      .createIndex({ username: 1 }, { unique: true, sparse: true, name: 'unique_player_username' });
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    process.exit(1);
  }
};
const getDB = () => {
  if (!db) {
    throw new Error('Database not connected');
  }
  return db;
};

const closeDB = async () => {
  await client.close();
  db = undefined;
};
module.exports = {
  connectDB,
  getDB,
  closeDB
};
