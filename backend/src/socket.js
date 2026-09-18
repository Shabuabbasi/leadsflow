import { Server } from 'socket.io';
import { corsOriginDelegate } from './config/cors.js';

let io = null;

/**
 * Attach Socket.IO to an existing HTTP server.
 * Must be called once during startup (server.js).
 */
export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: corsOriginDelegate,
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);
    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

/**
 * Retrieve the Socket.IO instance.
 * Returns null if called before initSocket().
 */
export function getIO() {
  return io;
}
