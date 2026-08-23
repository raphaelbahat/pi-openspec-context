import * as path from "path";
import type { OpenSpecTarget } from "./types.js";

export function targetToKey(target: OpenSpecTarget): string {
  if (target.type === "root") {
    return "root:" + path.resolve(target.path);
  } else if (target.type === "store") {
    return "store:" + target.id;
  }
  throw new Error(`Unknown target type: ${(target as any).type}`);
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
