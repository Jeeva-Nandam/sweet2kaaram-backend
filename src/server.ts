import app from './app';
import { env } from './config/env';
import { connectDB } from './config/db';

async function start() {
  try {
    await connectDB();
    console.log('MongoDB connected');
    app.listen(env.port, () => console.log(`API running on http://localhost:${env.port}`));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('MongoDB connection failed:', message);
    process.exitCode = 1;
  }
}

void start();
