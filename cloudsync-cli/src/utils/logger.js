/**
 * Logger - Shared operation logging for all CloudSync commands
 * Writes structured JSON logs to .cloudsync/logs/
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, unlinkSync } from 'fs';
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
 * Log an operation (with automatic rotation — keeps last 500 entries)
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
  
  // Automatic log rotation — keep only the most recent 500 entries
  try {
    const MAX_LOGS = 500;
    const files = readdirSync(logsDir).filter(f => f.endsWith('.json')).sort();
    if (files.length > MAX_LOGS) {
      const toDelete = files.slice(0, files.length - MAX_LOGS);
      for (const f of toDelete) {
        try { unlinkSync(join(logsDir, f)); } catch (e) { /* skip */ }
      }
    }
  } catch (e) { /* rotation is best-effort */ }
  
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
