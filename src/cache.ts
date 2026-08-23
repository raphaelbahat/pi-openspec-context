import * as path from "path";
import type { OpenSpecTarget } from "./types.js";

export function targetToKey(target: OpenSpecTarget): string {
  switch (target.type) {
    case "root":
      return "root:" + path.resolve(target.path);
    case "store":
      return "store:" + target.id;
    default:
      // Exhaustiveness check: if we reach here, there's an unhandled case
      const exhaustiveCheck: never = target;
      throw new Error(`Unknown target type: ${exhaustiveCheck}`);
  }
}

export class OpenSpecContextCache {
  private map: Map<string, string> = new Map();

  get(target: OpenSpecTarget): string | null {
    const key = targetToKey(target);
    return this.map.get(key) ?? null;
  }

  set(target: OpenSpecTarget, context: string): void {
    const key = targetToKey(target);
    this.map.set(key, context);
  }

  has(target: OpenSpecTarget): boolean {
    const key = targetToKey(target);
    return this.map.has(key);
  }

  delete(target: OpenSpecTarget): boolean {
    const key = targetToKey(target);
    return this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  size(): number {
    return this.map.size;
  }
}
