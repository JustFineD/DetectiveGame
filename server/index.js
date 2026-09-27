// index.js
// Express + Socket.io server: serves the client and synchronizes game state
// between 1-4 players connecting from different computers.

const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { RoomManager } = require('./rooms');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const rooms = new RoomManager();

app.use(express.static(path.join(__dirname, '..', 'public')));

function broadcastState(room) {
  if (!room.engine) return;
  const state = room.engine.getState();
  const playerNames = Object.fromEntries(room.players.map(p => [p.id, p.name]));
  for (const p of room.players) {
    io.to(p.socketId).emit('state', { ...state, playerNames, you: p.id });
  }
}

function sendError(socket, message) {
  socket.emit('errorMsg', { message });
}

io.on('connection', (socket) => {
  socket.on('createRoom', ({ name }) => {
    const room = rooms.createRoom(socket.id, name || 'שחקן');
    socket.join(room.code);
    socket.emit('roomCreated', {
      code: room.code,
      players: room.players.map(p => ({ id: p.id, name: p.name }))
    });
  });

  socket.on('joinRoom', ({ code, name }) => {
    try {
      const room = rooms.joinRoom(code.toUpperCase(), socket.id, name || 'שחקן');
      socket.join(room.code);
      io.to(room.code).emit('roomUpdate', {
        code: room.code,
        players: room.players.map(p => ({ id: p.id, name: p.name }))
      });
    } catch (e) {
      sendError(socket, e.message);
    }
  });

  socket.on('startGame', ({ numSuspects }) => {
    const room = rooms.getRoomBySocket(socket.id);
    if (!room) return sendError(socket, 'חדר לא נמצא');
    try {
      rooms.startGame(room.code, numSuspects);
      io.to(room.code).emit('gameStarted');
      broadcastState(room);
    } catch (e) {
      sendError(socket, e.message);
    }
  });

  function withRoomEngine(handler) {
    return (payload) => {
      const room = rooms.getRoomBySocket(socket.id);
      if (!room || !room.engine) return sendError(socket, 'המשחק לא התחיל');
      try {
        handler(room, payload || {});
        broadcastState(room);
      } catch (e) {
        sendError(socket, e.message);
      }
    };
  }

  socket.on('declareGoal', withRoomEngine((room, { goal }) => {
    room.engine.declareGoal(socket.id, goal);
  }));

  socket.on('rollDice', withRoomEngine((room) => {
    room.engine.rollDice(socket.id);
  }));

  socket.on('toggleLock', withRoomEngine((room, { dieIndex }) => {
    room.engine.toggleLock(socket.id, dieIndex);
  }));

  socket.on('acknowledgeRoll', withRoomEngine((room) => {
    room.engine.acknowledgeRoll(socket.id);
  }));

  socket.on('moveTo', withRoomEngine((room, { x, y }) => {
    room.engine.moveAdjacent(socket.id, { x, y });
  }));

  socket.on('disconnect', () => {
    const room = rooms.removePlayer(socket.id);
    if (room && room.players.length > 0) {
      io.to(room.code).emit('roomUpdate', {
        code: room.code,
        players: room.players.map(p => ({ id: p.id, name: p.name }))
      });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Windows Detective Game server listening on http://localhost:${PORT}`);
});
