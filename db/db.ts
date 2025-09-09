// src/db/db.ts
import mongoose from "mongoose";

const MONGODB_URI = process.env.DB!;
const DB_NAME = process.env.MAINDBNAME;

if (!MONGODB_URI) throw new Error("Missing env DB");
if (!DB_NAME) throw new Error("Missing env MAINDBNAME");

// Declare a global cache to survive HMR / route reuses
declare global {
  // eslint-disable-next-line no-var
  var _mongoose: { 
    conn: typeof mongoose | null; 
    promise: Promise<typeof mongoose> | null } | undefined;
}

let cached = global._mongoose;
if (!cached) {
  cached = global._mongoose = { conn: null, promise: null };
}

export default async function dbConnect() {
  if (cached!.conn) return cached!.conn;

  if (!cached!.promise) {
    cached!.promise = mongoose
      .connect(MONGODB_URI, {
        dbName: DB_NAME,
        bufferCommands: false,
      })
      .then((m) => m);
  }

  cached!.conn = await cached!.promise;
  return cached!.conn;
}
