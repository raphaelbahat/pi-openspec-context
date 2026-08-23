import * as path from "path";
import * as fs from "fs";
import {
  OpenSpecTarget,
  OpenSpecStoreListOutput,
} from "./types";
import { runOpenSpec } from "./runner";

/**
 * Finds the OpenSpec root directory by traversing upwards from cwd
 * looking for openspec/config.yaml
 */
export function findOpenSpecRoot(
  cwd: string,
  existsFn = fs.existsSync
): string | null {
  let current = path.resolve(cwd);

  while (true) {
    const configPath = path.join(current, "openspec", "config.yaml");
    if (existsFn(configPath)) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      // Reached root directory (/ on Unix, C:\ on Windows)
      break;
    }
    current = parent;
  }

  return null;
}

/**
 * Finds a store ID that matches the given cwd by querying openspec store list
 */
export async function findStoreId(
  pi: { exec: (cmd: string, args: string[], opts?: any) => Promise<any> },
  cwd: string
): Promise<string | null> {
  // Execute openspec store list --json command
  const output = await runOpenSpec(pi, ["store", "list", "--json"], cwd);

  if (output === null) {
    return null;
  }

  // Parse JSON output
  let parsed: OpenSpecStoreListOutput;
  try {
    parsed = JSON.parse(output);
  } catch {
    return null;
  }

  // Verify stores is an array
  if (!Array.isArray(parsed.stores)) {
    return null;
  }

  // Resolve cwd to absolute path
  const resolvedCwd = path.resolve(cwd);

  // Match against each store's root/path/dir
  for (const store of parsed.stores) {
    const storeRoot = store.root || store.path || store.dir;
    if (!storeRoot) continue;

    const resolvedRoot = path.resolve(storeRoot);

    // Check for exact match or subdirectory match
    if (
      resolvedCwd === resolvedRoot ||
      resolvedCwd.startsWith(resolvedRoot + path.sep)
    ) {
      return store.id || null;
    }
  }

  return null;
}

/**
 * Detects the OpenSpec target (root or store) for the given directory
 */
export async function detectOpenSpecTarget(
  pi: { exec: (cmd: string, args: string[], opts?: any) => Promise<any> },
  cwd: string
): Promise<OpenSpecTarget | null> {
  // First try to find an OpenSpec root
  const root = findOpenSpecRoot(cwd);
  if (root) {
    return {
      type: "root",
      path: root,
    };
  }

  // Then try to find a store ID
  const storeId = await findStoreId(pi, cwd);
  if (storeId) {
    return {
      type: "store",
      id: storeId,
      cwd,
    };
  }

  return null;
}
