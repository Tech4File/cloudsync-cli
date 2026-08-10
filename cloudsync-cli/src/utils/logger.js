/**
 * Logger - Shared operation logging for all CloudSync commands
 * Writes structured JSON logs to .cloudsync/logs/
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';

function getLogsDir() {
  return join(process.cwd(), '.cloudsync', 'logs');
}

function ensureLogsDir() {
  const logsDir = getLogsDir();
  if (!existsSync(logsDir)) {
    mkdirSync(logsDir, { recursive: true });
  }
  return logsDir;
}

/**
 * Log an operation
 */
export function logOperation(type, message, meta = {}) {
  const logsDir = ensureLogsDir();
  
  const timestamp = new Date().toISOString();
  const logEntry = {
    type,
    message,
    timestamp,
    ...meta
  };
  
  const filename = `op-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.json`;
  writeFileSync(join(logsDir, filename), JSON.stringify(logEntry, null, 2));
  
  return logEntry;
}

/**
 * Get recent log entries
 */
export function getRecentLogs(limit = 20, type = 'all') {
  const logsDir = ensureLogsDir();
  
  try {
    const files = readdirSync(logsDir)
      .filter(f => f.endsWith('.json'))
      .sort()
      .reverse()
      .slice(0, limit * 2); // over-fetch to account for type filtering
    
    const logs = [];
    for (const file of files) {
      try {
        const log = JSON.parse(readFileSync(join(logsDir, file), 'utf8')); // Safe: in try-catch
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
