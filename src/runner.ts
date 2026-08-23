import type { PiExecContext } from "./types.js";

export const DEFAULT_TIMEOUT_MS = 10000;

/**
 * Strips ANSI color/control codes and trims whitespace
 */
export function stripAnsi(text: string): string {
  return text.replace(/\u001b\[[0-9;]*m/g, "").trim();
}

/**
 * Sanitizes context output for injection (alias for stripAnsi)
 */
export function sanitizeContext(text: string): string {
  return stripAnsi(text);
}

/**
 * Executes openspec CLI command and returns output or null on failure
 */
export async function runOpenSpec(
  pi: PiExecContext,
  args: string[],
  cwd: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<string | null> {
  try {
    const result = await pi.exec("openspec", args, {
      timeout: timeoutMs,
      cwd,
    });

    // Return null if exit code is not 0
    if (result.code !== 0) {
      return null;
    }

    // Strip ANSI codes and trim
    const cleaned = stripAnsi(result.stdout);

    // Return null if output is empty
    if (!cleaned) {
      return null;
    }

    return cleaned;
  } catch {
    // Catch all exceptions (ENOENT, timeout, etc.) and return null
    return null;
  }
}
