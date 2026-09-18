import { Server } from 'socket.io';

let io = null;

/**
 * Attach Socket.IO to an existing HTTP server.
 * Must be called once during startup (server.js).
 */
export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: [
        process.env.CLIENT_URL || 'http://localhost:5173',
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:4200',
        'http://127.0.0.1:4200',
      ],
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
