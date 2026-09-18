import { createServer } from 'node:http';
import 'dotenv/config';
import app from './src/app.js';
import { connectDatabase } from './src/config/database.js';
import { initSocket } from './src/socket.js';

async function start() {
  try {
    await connectDatabase();
    const port = Number(process.env.PORT) || 5000;
    const httpServer = createServer(app);
    initSocket(httpServer);
    httpServer.listen(port, '0.0.0.0', () => {
      console.log(`LeadFlow API listening on http://localhost:${port}`);
    });
  } catch (error) {
    console.error(`Unable to start LeadFlow API: ${error.message}`);
    process.exit(1);
  }
}

start();
