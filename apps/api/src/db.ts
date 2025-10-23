import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { CFG } from './config';

export const sqlite = new Database(CFG.dbPath);
export const db = drizzle(sqlite);


