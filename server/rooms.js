// rooms.js
// Manages game "rooms" so multiple independent games can run at once and
// players from different computers can join the same one via a room code.

const { GameEngine } = require('./gameEngine');

function generateRoomCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I/O to avoid confusion
  let code = '';
  for (let i = 0; i < 4; i++) code += letters[Math.floor(Math.random() * letters.length)];
  return code;
}

class RoomManager {
  constructor() {
    this.rooms = new Map(); // code -> Room
  }

  createRoom(hostSocketId, hostName) {
    let code;
    do { code = generateRoomCode(); } while (this.rooms.has(code));

    const room = {
      code,
      players: [{ socketId: hostSocketId, id: hostSocketId, name: hostName }],
      engine: null,
      started: false
    };
    this.rooms.set(code, room);
    return room;
  }

  joinRoom(code, socketId, name) {
    const room = this.rooms.get(code);
    if (!room) throw new Error('חדר לא נמצא');
    if (room.started) throw new Error('המשחק כבר התחיל');
    if (room.players.length >= 4) throw new Error('החדר מלא (4 שחקנים מקסימום)');
    room.players.push({ socketId, id: socketId, name });
    return room;
  }

  startGame(code, numSuspects) {
    const room = this.rooms.get(code);
    if (!room) throw new Error('חדר לא נמצא');
    if (room.players.length < 1) throw new Error('צריך לפחות שחקן אחד');
    room.engine = new GameEngine({
      numSuspects: numSuspects || 25,
      playerIds: room.players.map(p => p.id)
    });
    room.started = true;
    return room;
  }

  getRoomBySocket(socketId) {
    for (const room of this.rooms.values()) {
      if (room.players.some(p => p.socketId === socketId)) return room;
    }
    return null;
  }

  removePlayer(socketId) {
    const room = this.getRoomBySocket(socketId);
    if (!room) return null;
    room.players = room.players.filter(p => p.socketId !== socketId);
    if (room.players.length === 0) this.rooms.delete(room.code);
    return room;
  }
}

module.exports = { RoomManager };
