import { app } from './app.js';
import { connectDatabase } from './config/db.js';
import { env } from './config/env.js';

async function start() {
  await connectDatabase();
  app.listen(env.PORT, () => console.log(`Harshit Education Center API listening on ${env.PORT}`));
}
start().catch((error) => { console.error('Unable to start server', error); process.exit(1); });
