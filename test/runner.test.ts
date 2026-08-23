import { describe, it, expect, vi, beforeEach } from "vitest";
import { stripAnsi, sanitizeContext, runOpenSpec, DEFAULT_TIMEOUT_MS } from "../src/runner";

describe("stripAnsi", () => {
  it("should strip ANSI color codes", () => {
    const input = "\u001b[32mgreen\u001b[0m text";
    const result = stripAnsi(input);
    expect(result).toBe("green text");
  });

  it("should strip ANSI control codes", () => {
    const input = "\u001b[1;32mBold Green\u001b[0m";
    const result = stripAnsi(input);
    expect(result).toBe("Bold Green");
  });

  it("should trim whitespace", () => {
    const input = "  \n  text  \n  ";
    const result = stripAnsi(input);
    expect(result).toBe("text");
  });

  it("should handle empty strings", () => {
    const result = stripAnsi("");
    expect(result).toBe("");
  });

  it("should handle strings with only whitespace", () => {
    const result = stripAnsi("   \n\t  ");
    expect(result).toBe("");
  });
});

describe("sanitizeContext", () => {
  it("should clean context output", () => {
    const input = "\u001b[32mstore-001\u001b[0m";
    const result = sanitizeContext(input);
    expect(result).toBe("store-001");
  });

  it("should handle multiple ANSI codes", () => {
    const input = "\u001b[1;32mBold\u001b[0m \u001b[33mYellow\u001b[0m";
    const result = sanitizeContext(input);
    expect(result).toBe("Bold Yellow");
  });
});

describe("runOpenSpec", () => {
  it("should return null when exit code is not 0", async () => {
    const mockExec = vi.fn().mockResolvedValue({
      code: 1,
      stdout: "some output",
      stderr: "error",
    });
    const pi = { exec: mockExec };

    const result = await runOpenSpec(pi as any, ["list"], "/tmp");
    expect(result).toBeNull();
    expect(mockExec).toHaveBeenCalledWith("openspec", ["list"], {
      timeout: DEFAULT_TIMEOUT_MS,
      cwd: "/tmp",
    });
  });

  it("should return trimmed stdout on successful execution", async () => {
    const mockExec = vi.fn().mockResolvedValue({
      code: 0,
      stdout: "  \u001b[32mstore-001\u001b[0m  \n",
      stderr: "",
    });
    const pi = { exec: mockExec };

    const result = await runOpenSpec(pi as any, ["list"], "/tmp");
    expect(result).toBe("store-001");
  });

  it("should return null if stdout is empty after stripping", async () => {
    const mockExec = vi.fn().mockResolvedValue({
      code: 0,
      stdout: "   \n  ",
      stderr: "",
    });
    const pi = { exec: mockExec };

    const result = await runOpenSpec(pi as any, ["list"], "/tmp");
    expect(result).toBeNull();
  });

  it("should return null on ENOENT (binary not found)", async () => {
    const mockExec = vi.fn().mockRejectedValue(new Error("ENOENT"));
    const pi = { exec: mockExec };

    const result = await runOpenSpec(pi as any, ["list"], "/tmp");
    expect(result).toBeNull();
  });

  it("should return null on timeout", async () => {
    const mockExec = vi.fn().mockRejectedValue(new Error("timeout"));
    const pi = { exec: mockExec };

    const result = await runOpenSpec(pi as any, ["list"], "/tmp", 5000);
    expect(result).toBeNull();
  });

  it("should use custom timeout when provided", async () => {
    const mockExec = vi.fn().mockResolvedValue({
      code: 0,
      stdout: "output",
      stderr: "",
    });
    const pi = { exec: mockExec };

    await runOpenSpec(pi as any, ["list"], "/tmp", 30000);
    expect(mockExec).toHaveBeenCalledWith("openspec", ["list"], {
      timeout: 30000,
      cwd: "/tmp",
    });
  });

  it("should use DEFAULT_TIMEOUT_MS when timeout not provided", async () => {
    const mockExec = vi.fn().mockResolvedValue({
      code: 0,
      stdout: "output",
      stderr: "",
    });
    const pi = { exec: mockExec };

    await runOpenSpec(pi as any, ["list"], "/tmp");
    expect(mockExec).toHaveBeenCalledWith("openspec", ["list"], {
      timeout: DEFAULT_TIMEOUT_MS,
      cwd: "/tmp",
    });
  });
});
