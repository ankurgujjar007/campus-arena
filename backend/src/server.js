require('dotenv').config();

const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const { connectDB } = require('./config/db');
const { connectRedis } = require('./config/redis');
const authRoutes = require('./routes/auth.routes');
const teamRoutes = require('./routes/team.routes');
const playerRoutes = require('./routes/player.routes');
const tournamentRoutes = require('./routes/tournament.routes');
const matchRoutes = require('./routes/match.routes');
const errorMiddleware = require('./middleware/error.middleware');
const registerMatchSocket = require('./sockets/match.socket');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*'
  }
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'CampusArena API is running',
    data: {
      version: '1.0.0'
    }
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/players', playerRoutes);
app.use('/api/matches', matchRoutes);

registerMatchSocket(io);

app.use(errorMiddleware);

const PORT = process.env.PORT || 5001;

const startServer = async () => {
  try {
    await connectDB();
    await connectRedis();

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();

module.exports = app;
