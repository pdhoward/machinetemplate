// scripts/setup-indexes.ts
import 'dotenv/config';
import getMongoConnection from '../db/connections/index.js'; 

async function main() {

  const url = process.env.DB; 
  const dbName = process.env.MAINDBNAME; 

  if (!url || !dbName) {
      console.log({ error: 'Missing database configuration' }, { status: 500 });
      return
  }
 
  const { client, db } = await getMongoConnection(url, dbName);

   console.log('Connected to MongoDB');

   try {
     await db.collection("ratelimits")
    .createIndex({ createdAt: 1 }, { expireAfterSeconds: 120 });

    await db.collection("usage_daily")
        .createIndex({ emailHash: 1, date: 1 }, { unique: true });

    await db.collection("realtime_sessions")
        .createIndex({ emailHash: 1, active: 1 });

   } catch(e) {
     console.error('Error creating indexes:', e);

   } finally {
     await client.close();
     console.log('MongoDB connection closed');
   }
 
}

main().catch(e => { console.error(e); process.exit(1); });
