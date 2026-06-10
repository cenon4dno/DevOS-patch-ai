/**
 * @file database/sqlite.ts
 * @satisfies [REQ-PAT-001], [REQ-PAT-002]
 */

import sqlite3 from 'sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import logger from '../utils/logger';

class Database {
  private db: sqlite3.Database | null = null;
  private dbPath: string;

  constructor() {
    this.dbPath =
      process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'patch-agent.db');
    this.ensureDataDir();
  }

  private ensureDataDir(): void {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  public initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          logger.error('Database connection failed', { error: err.message });
          reject(err);
        } else {
          logger.info('Database connected', { path: this.dbPath });
          this.createTables().then(resolve).catch(reject);
        }
      });
    });
  }

  private createTables(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = `
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS patches (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          patch_id      TEXT UNIQUE NOT NULL,
          target_agent  TEXT NOT NULL,
          github_repo   TEXT NOT NULL,
          type          TEXT NOT NULL CHECK(type IN ('bug_fix', 'feature', 'update')),
          title         TEXT NOT NULL,
          description   TEXT NOT NULL,
          status        TEXT NOT NULL DEFAULT 'pending'
                          CHECK(status IN ('pending','analyzing','implementing','testing','pr_created','completed','failed','clarification_required')),
          branch_name   TEXT,
          pr_url        TEXT,
          pr_number     INTEGER,
          error_message TEXT,
          priority      TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('critical','high','medium','low')),
          reported_by   TEXT NOT NULL,
          created_at    TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS patch_files (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          patch_id      TEXT NOT NULL REFERENCES patches(patch_id),
          file_path     TEXT NOT NULL,
          action        TEXT NOT NULL CHECK(action IN ('modified','added','deleted')),
          lines_added   INTEGER DEFAULT 0,
          lines_removed INTEGER DEFAULT 0
        );

        CREATE INDEX IF NOT EXISTS idx_patches_status    ON patches(status);
        CREATE INDEX IF NOT EXISTS idx_patches_type      ON patches(type);
        CREATE INDEX IF NOT EXISTS idx_patch_files_patch ON patch_files(patch_id);
      `;

      this.db.exec(sql, (err) => {
        if (err) {
          logger.error('Table creation failed', { error: err.message });
          reject(err);
        } else {
          logger.info('Schema ensured');
          resolve();
        }
      });
    });
  }

  public run(sql: string, params: unknown[] = []): Promise<{ lastID?: number; changes?: number }> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }
      this.db.run(sql, params, function (err) {
        if (err) {
          logger.error('Database run failed', { error: err.message, sql });
          reject(err);
        } else {
          resolve({ lastID: this.lastID, changes: this.changes });
        }
      });
    });
  }

  public get(sql: string, params: unknown[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }
      this.db.get(sql, params, (err, row) => {
        if (err) {
          logger.error('Database get failed', { error: err.message, sql });
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  public all(sql: string, params: unknown[] = []): Promise<any[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          logger.error('Database all failed', { error: err.message, sql });
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  public close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve();
        return;
      }
      this.db.close((err) => {
        if (err) {
          logger.error('Database close failed', { error: err.message });
          reject(err);
        } else {
          logger.info('Database closed');
          resolve();
        }
      });
    });
  }
}

export default new Database();
