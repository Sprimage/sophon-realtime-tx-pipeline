import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

export const sqlite = new Database(process.env.DATABASE_URL ?? '../../sophon-demo.sqlite');
export const db = drizzle(sqlite);
