import { describe, it, expect, beforeEach } from "vitest";
import * as path from "path";
import { OpenSpecContextCache, targetToKey } from "../src/cache.js";
import type { OpenSpecTarget } from "../src/types.js";

describe("targetToKey", () => {
  it("generates key for root targets with absolute path", () => {
    const target: OpenSpecTarget = { type: "root", path: "/home/user/project" };
    const key = targetToKey(target);
    expect(key).toBe("root:" + path.resolve("/home/user/project"));
  });

  it("normalizes relative paths to absolute for root targets", () => {
    const target: OpenSpecTarget = { type: "root", path: "./project" };
    const key = targetToKey(target);
    expect(key).toBe("root:" + path.resolve("./project"));
  });

  it("generates key for store targets", () => {
    const target: OpenSpecTarget = {
      type: "store",
      id: "my-store-id",
      cwd: "/home/user",
    };
    const key = targetToKey(target);
    expect(key).toBe("store:my-store-id");
  });
});

describe("OpenSpecContextCache", () => {
  let cache: OpenSpecContextCache;

  beforeEach(() => {
    cache = new OpenSpecContextCache();
  });

  describe("get", () => {
    it("returns null when key is not present", () => {
      const target: OpenSpecTarget = { type: "root", path: "/tmp/test" };
      expect(cache.get(target)).toBeNull();
    });

    it("returns cached context string when present", () => {
      const target: OpenSpecTarget = { type: "root", path: "/tmp/test" };
      const context = "test context data";
      cache.set(target, context);
      expect(cache.get(target)).toBe(context);
    });

    it("returns correct context for store targets", () => {
      const target: OpenSpecTarget = {
        type: "store",
        id: "store-123",
        cwd: "/tmp",
      };
      const context = "store context";
      cache.set(target, context);
      expect(cache.get(target)).toBe(context);
    });
  });

  describe("set", () => {
    it("stores context for root targets", () => {
      const target: OpenSpecTarget = { type: "root", path: "/tmp/test" };
      const context = "my context";
      cache.set(target, context);
      expect(cache.get(target)).toBe(context);
    });

    it("stores context for store targets", () => {
      const target: OpenSpecTarget = {
        type: "store",
        id: "store-456",
        cwd: "/tmp",
      };
      const context = "store data";
      cache.set(target, context);
      expect(cache.get(target)).toBe(context);
    });

    it("overwrites existing context", () => {
      const target: OpenSpecTarget = { type: "root", path: "/tmp/test" };
      cache.set(target, "first");
      cache.set(target, "second");
      expect(cache.get(target)).toBe("second");
    });
  });

  describe("has", () => {
    it("returns false for absent entries", () => {
      const target: OpenSpecTarget = { type: "root", path: "/tmp/test" };
      expect(cache.has(target)).toBe(false);
    });

    it("returns true for present entries", () => {
      const target: OpenSpecTarget = { type: "root", path: "/tmp/test" };
      cache.set(target, "context");
      expect(cache.has(target)).toBe(true);
    });
  });

  describe("delete", () => {
    it("returns false when entry does not exist", () => {
      const target: OpenSpecTarget = { type: "root", path: "/tmp/test" };
      expect(cache.delete(target)).toBe(false);
    });

    it("returns true when entry is deleted", () => {
      const target: OpenSpecTarget = { type: "root", path: "/tmp/test" };
      cache.set(target, "context");
      expect(cache.delete(target)).toBe(true);
    });

    it("removes entry from cache", () => {
      const target: OpenSpecTarget = { type: "root", path: "/tmp/test" };
      cache.set(target, "context");
      cache.delete(target);
      expect(cache.has(target)).toBe(false);
    });

    it("returns false on second delete", () => {
      const target: OpenSpecTarget = { type: "root", path: "/tmp/test" };
      cache.set(target, "context");
      cache.delete(target);
      expect(cache.delete(target)).toBe(false);
    });
  });

  describe("clear", () => {
    it("removes all entries from cache", () => {
      const target1: OpenSpecTarget = { type: "root", path: "/tmp/test1" };
      const target2: OpenSpecTarget = {
        type: "store",
        id: "store-1",
        cwd: "/tmp",
      };
      cache.set(target1, "context1");
      cache.set(target2, "context2");
      cache.clear();
      expect(cache.has(target1)).toBe(false);
      expect(cache.has(target2)).toBe(false);
    });

    it("results in size of 0", () => {
      const target: OpenSpecTarget = { type: "root", path: "/tmp/test" };
      cache.set(target, "context");
      cache.clear();
      expect(cache.size()).toBe(0);
    });
  });

  describe("size", () => {
    it("returns 0 for empty cache", () => {
      expect(cache.size()).toBe(0);
    });

    it("returns number of entries", () => {
      const target1: OpenSpecTarget = { type: "root", path: "/tmp/test1" };
      const target2: OpenSpecTarget = {
        type: "store",
        id: "store-1",
        cwd: "/tmp",
      };
      cache.set(target1, "context1");
      expect(cache.size()).toBe(1);
      cache.set(target2, "context2");
      expect(cache.size()).toBe(2);
    });

    it("decreases on delete", () => {
      const target: OpenSpecTarget = { type: "root", path: "/tmp/test" };
      cache.set(target, "context");
      expect(cache.size()).toBe(1);
      cache.delete(target);
      expect(cache.size()).toBe(0);
    });
  });

  describe("path normalization", () => {
    it("treats relative and absolute paths as same key", () => {
      const relTarget: OpenSpecTarget = { type: "root", path: "./test" };
      const absTarget: OpenSpecTarget = {
        type: "root",
        path: path.resolve("./test"),
      };
      const context = "test context";
      cache.set(relTarget, context);
      expect(cache.get(absTarget)).toBe(context);
    });
  });
});
