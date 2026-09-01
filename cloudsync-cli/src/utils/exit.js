/**
 * exit.js - Standardized process-exit helpers for CloudSync-CLI
 *
 * Every command sets its exit code through these helpers so scripts and CI
 * pipelines can reliably distinguish success from failure:
 * - okWith()    → resets exit code to 0 at command start.
 * - failWith()  → prints the error to stderr and marks exit code 1.
 *
 * process.exitCode is used instead of process.exit() so pending I/O
 * (logs, stream flushes) can drain before the process terminates.
 */

/**
 * Mark the current process as failed and emit a structured error line.
 * Does NOT call process.exit(); the event loop drains first.
 *
 * @param {string} message - Human-readable failure reason
 * @param {number} [code=1] - Exit code (defaults to 1)
 * @param {object} [meta] - Optional structured metadata (verbose only)
 */
export function failWith(message, code = 1, meta = null) {
  try {
    // Use stderr so a downstream `>` redirect on stdout doesn't swallow the error
    process.stderr.write(`\u274C ${message}\n`);
    if (meta && process.argv.includes('--verbose')) {
      try {
        process.stderr.write(`   ${JSON.stringify(meta)}\n`);
      } catch (_) { /* circular refs etc. — ignore */ }
    }
  } catch (_) {
    // Last-ditch: fall back to console
    try { console.error(message); } catch (__) {}
  }
  process.exitCode = code;
}

/**
 * Reset exit code to 0 — call at the very start of a successful command.
 * This handles cases where a previous handler left a non-zero code lingering.
 */
export function okWith() {
  process.exitCode = 0;
}
