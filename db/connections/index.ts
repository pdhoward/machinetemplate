
//////////////////////////////////////////////////////
////////   mongoDB connection manager         ///////
////////////////////////////////////////////////////

import { MongoClient, Db } from 'mongodb';
import { LRUCache } from 'lru-cache';

// Maintain up to x socket connections  
const dbOptions = {
  maxConnecting: 10       
};

const cacheOptions = {
  max: 500,    
  ttl: 1000 * 60 * 10,   // ttl in milliseconds
  updateAgeOnGet: true
};

const cache = new LRUCache<string, MongoClient>(cacheOptions);

const log = console;

// Function to get MongoDB connection (now returns { client, db } for closeability, with types)
async function getMongoConnection(url: string, dbName: string): Promise<{ client: MongoClient; db: Db }> {
  try {
      let client = cache.get(url);
      
      if (!client) {
          console.info('Creating new connection for ' + url);
          client = new MongoClient(url, dbOptions);
          await client.connect();
          console.info('MongoDB server connection live');
          cache.set(url, client);
      } else {
          console.info('Reusing existing MongoDB connection');
          // noop if the connection is in fact available
          await client.connect()
      }

      const db = client.db(dbName);
      return { client, db }; // Return both for .close() access
  } catch (err) {
      console.error('Error connecting to MongoDB:', err);
      throw err;
  }
}

export default getMongoConnection;