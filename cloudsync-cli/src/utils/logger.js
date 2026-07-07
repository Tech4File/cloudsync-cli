/**
 * Logger - Shared operation logging for all CloudSync commands
 * Writes structured JSON logs to .cloudsync/logs/
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const LOGS_DIR = join(process.cwd(), '.cloudsync', 'logs');

function ensureLogsDir() {
  if (!existsSync(LOGS_DIR)) {
    mkdirSync(LOGS_DIR, { recursive: true });
  }
}

/**
 * Log an operation
 */
export function logOperation(type, message, meta = {}) {
  ensureLogsDir();
  
  const timestamp = new Date().toISOString();
  const logEntry = {
    type,
    message,
    timestamp,
    ...meta
  };
  
  const filename = `op-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.json`;
  writeFileSync(join(LOGS_DIR, filename), JSON.stringify(logEntry, null, 2));
  
  return logEntry;
}

/**
 * Get recent log entries
 */
export function getRecentLogs(limit = 20, type = 'all') {
  ensureLogsDir();
  
  try {
    const files = readdirSync(LOGS_DIR)
      .filter(f => f.endsWith('.json'))
      .sort()
      .reverse()
      .slice(0, limit * 2); // over-fetch to account for type filtering
    
    const logs = [];
    for (const file of files) {
      try {
        const log = JSON.parse(readFileSync(join(LOGS_DIR, file), 'utf8'));
        if (type === 'all' || log.type === type) {
          logs.push(log);
        }
        if (logs.length >= limit) break;
      } catch (e) { /* skip */ }
    }
    return logs;
  } catch (e) {
    return [];
  }
}

export default { logOperation, getRecentLogs };
