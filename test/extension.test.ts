import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  ExtensionAPI,
  BeforeAgentStartEvent,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import extensionDefault, { createExtension, contextCache } from "../src/index";
import { OpenSpecContextCache } from "../src/cache";
import * as detector from "../src/detector";
import type { OpenSpecTarget } from "../src/types";

describe("extension entrypoint", () => {
  let mockPi: any;
  let eventListeners: Map<string, Function[]>;

  beforeEach(() => {
    // Reset cache before each test
    contextCache.clear();

    // Clear all spies
    vi.clearAllMocks();

    // Create event listener tracking
    eventListeners = new Map();

    // Create mock PI API
    mockPi = {
      on: vi.fn((eventName: string, handler: Function) => {
        if (!eventListeners.has(eventName)) {
          eventListeners.set(eventName, []);
        }
        eventListeners.get(eventName)!.push(handler);
      }),
      exec: vi.fn(),
    };
  });

  function getBeforeAgentStartHandlers(): Function[] {
    return eventListeners.get("before_agent_start") || [];
  }

  it("should register listener on before_agent_start event", () => {
    extensionDefault(mockPi);
    expect(getBeforeAgentStartHandlers().length).toBe(1);
  });

  it("should initialize extension with cache", () => {
    const ext = createExtension();
    expect(ext).toBeDefined();
    expect(typeof ext).toBe("function");
  });

  it("should inject OpenSpec context into systemPrompt when in OpenSpec root", async () => {
    mockPi.exec = vi.fn().mockResolvedValue({
      code: 0,
      stdout: "test context data",
      stderr: "",
    });

    // Mock detectOpenSpecTarget to return a root target
    vi.spyOn(detector, "detectOpenSpecTarget").mockResolvedValue({
      type: "root",
      path: "/tmp/openspec-root",
    });

    // Initialize extension with mock PI
    extensionDefault(mockPi);

    // Get the handler
    const handlers = getBeforeAgentStartHandlers();
    const handler = handlers[0];

    const event: Partial<BeforeAgentStartEvent> = {
      systemPrompt: "You are a helpful assistant.",
      systemPromptOptions: { cwd: "/tmp/openspec-root" },
    };

    const result = await handler(event, {});

    expect(result).toBeDefined();
    expect(result.systemPrompt).toContain("[OpenSpec context]");
    expect(result.systemPrompt).toContain("test context data");
  });

  it("should return empty object when not in OpenSpec root or store", async () => {
    // Mock no OpenSpec project found
    mockPi.exec = vi.fn().mockResolvedValue({
      code: 1,
      stdout: "",
      stderr: "",
    });

    extensionDefault(mockPi);
    const handlers = getBeforeAgentStartHandlers();
    const handler = handlers[0];

    const event: Partial<BeforeAgentStartEvent> = {
      systemPrompt: "You are a helpful assistant.",
      systemPromptOptions: { cwd: "/tmp/random-dir" },
    };

    const result = await handler(event, {});

    expect(result).toEqual({});
  });

  it("should cache context for root targets", async () => {
    const contextData = "cached root context";
    mockPi.exec = vi
      .fn()
      .mockResolvedValueOnce({
        code: 0,
        stdout: contextData,
        stderr: "",
      })
      .mockResolvedValueOnce({
        code: 1, // Second call should not happen
        stdout: "",
        stderr: "",
      });

    // Mock detectOpenSpecTarget to return a root target
    vi.spyOn(detector, "detectOpenSpecTarget").mockResolvedValue({
      type: "root",
      path: "/home/user/openspec-project",
    });

    extensionDefault(mockPi);
    const handlers = getBeforeAgentStartHandlers();
    const handler = handlers[0];

    const event: Partial<BeforeAgentStartEvent> = {
      systemPrompt: "Assistant prompt",
      systemPromptOptions: { cwd: "/home/user/openspec-project" },
    };

    // First call - should execute openspec
    const result1 = await handler(event, {});
    expect(result1.systemPrompt).toContain(contextData);

    // Second call with same cwd - should use cache
    const result2 = await handler(event, {});
    expect(result2.systemPrompt).toContain(contextData);

    // Verify exec was called only once (not twice)
    expect(mockPi.exec).toHaveBeenCalledTimes(1);
  });

  it("should respect event.systemPromptOptions.cwd over fallback cwd", async () => {
    mockPi.exec = vi.fn().mockResolvedValue({
      code: 0,
      stdout: "test context",
      stderr: "",
    });

    // Mock detectOpenSpecTarget to track which cwd was used
    let detectedCwd: string;
    vi.spyOn(detector, "detectOpenSpecTarget").mockImplementation(async (pi, cwd) => {
      detectedCwd = cwd;
      return { type: "root", path: cwd };
    });

    extensionDefault(mockPi);
    const handlers = getBeforeAgentStartHandlers();
    const handler = handlers[0];

    const event: Partial<BeforeAgentStartEvent> = {
      systemPrompt: "Assistant",
      systemPromptOptions: { cwd: "/specified/cwd" },
    };

    const ctx: Partial<ExtensionContext> = {
      cwd: "/fallback/cwd",
    };

    await handler(event, ctx);

    // Verify that /specified/cwd was used, not /fallback/cwd
    expect(detectedCwd!).toBe("/specified/cwd");
  });

  it("should use ctx.cwd when systemPromptOptions.cwd is not provided", async () => {
    mockPi.exec = vi.fn().mockResolvedValue({
      code: 0,
      stdout: "test context",
      stderr: "",
    });

    // Mock detectOpenSpecTarget to track which cwd was used
    let detectedCwd: string;
    vi.spyOn(detector, "detectOpenSpecTarget").mockImplementation(async (pi, cwd) => {
      detectedCwd = cwd;
      return { type: "root", path: cwd };
    });

    extensionDefault(mockPi);
    const handlers = getBeforeAgentStartHandlers();
    const handler = handlers[0];

    const event: Partial<BeforeAgentStartEvent> = {
      systemPrompt: "Assistant",
      systemPromptOptions: {},
    };

    const ctx: Partial<ExtensionContext> = {
      cwd: "/ctx/cwd",
    };

    await handler(event, ctx);

    expect(detectedCwd!).toBe("/ctx/cwd");
  });

  it("should use process.cwd() as fallback when neither is provided", async () => {
    mockPi.exec = vi.fn().mockResolvedValue({
      code: 0,
      stdout: "test context",
      stderr: "",
    });

    // Mock detectOpenSpecTarget to track which cwd was used
    let detectedCwd: string;
    vi.spyOn(detector, "detectOpenSpecTarget").mockImplementation(async (pi, cwd) => {
      detectedCwd = cwd;
      return { type: "root", path: cwd };
    });

    extensionDefault(mockPi);
    const handlers = getBeforeAgentStartHandlers();
    const handler = handlers[0];

    const event: Partial<BeforeAgentStartEvent> = {
      systemPrompt: "Assistant",
      systemPromptOptions: {},
    };

    const ctx: Partial<ExtensionContext> = {};

    await handler(event, ctx);

    expect(detectedCwd!).toBe(process.cwd());
  });

  it("should sanitize ANSI codes in injected context", async () => {
    const contextWithAnsi = "\u001b[32mcolored context\u001b[0m";
    mockPi.exec = vi.fn().mockResolvedValue({
      code: 0,
      stdout: contextWithAnsi,
      stderr: "",
    });

    // Mock detectOpenSpecTarget
    vi.spyOn(detector, "detectOpenSpecTarget").mockResolvedValue({
      type: "root",
      path: "/tmp",
    });

    extensionDefault(mockPi);
    const handlers = getBeforeAgentStartHandlers();
    const handler = handlers[0];

    const event: Partial<BeforeAgentStartEvent> = {
      systemPrompt: "Assistant",
      systemPromptOptions: { cwd: "/tmp" },
    };

    const result = await handler(event, {});

    expect(result.systemPrompt).toContain("colored context");
    expect(result.systemPrompt).not.toContain("\u001b[32m");
  });

  it("should return empty object when sanitized context is empty", async () => {
    mockPi.exec = vi.fn().mockResolvedValue({
      code: 0,
      stdout: "   \n\t  ", // Only whitespace
      stderr: "",
    });

    extensionDefault(mockPi);
    const handlers = getBeforeAgentStartHandlers();
    const handler = handlers[0];

    const event: Partial<BeforeAgentStartEvent> = {
      systemPrompt: "Assistant",
      systemPromptOptions: { cwd: "/tmp" },
    };

    const result = await handler(event, {});

    expect(result).toEqual({});
  });

  it("should return empty object when runOpenSpec returns null", async () => {
    mockPi.exec = vi.fn().mockRejectedValue(new Error("Command not found"));

    extensionDefault(mockPi);
    const handlers = getBeforeAgentStartHandlers();
    const handler = handlers[0];

    const event: Partial<BeforeAgentStartEvent> = {
      systemPrompt: "Assistant",
      systemPromptOptions: { cwd: "/tmp" },
    };

    const result = await handler(event, {});

    expect(result).toEqual({});
  });

  it("should cache context for store targets", async () => {
    const contextData = "store context data";
    mockPi.exec = vi.fn().mockResolvedValue({
      code: 0,
      stdout: contextData,
      stderr: "",
    });

    // Mock detectOpenSpecTarget to return a store target
    vi.spyOn(detector, "detectOpenSpecTarget").mockResolvedValue({
      type: "store",
      id: "store-001",
      cwd: "/store/path/subdir",
    });

    extensionDefault(mockPi);
    const handlers = getBeforeAgentStartHandlers();
    const handler = handlers[0];

    const event: Partial<BeforeAgentStartEvent> = {
      systemPrompt: "Assistant",
      systemPromptOptions: { cwd: "/store/path/subdir" },
    };

    // First call - should detect store and get context
    const result1 = await handler(event, {});
    expect(result1.systemPrompt).toContain(contextData);

    // Second call - should use cache
    const result2 = await handler(event, {});
    expect(result2.systemPrompt).toContain(contextData);

    // Verify exec was called only once for context (detection is mocked)
    expect(mockPi.exec).toHaveBeenCalledTimes(1);
  });

  it("should format systemPrompt correctly with context marker", async () => {
    const basePrompt = "You are a helpful assistant.";
    const contextData = "# API Overview\nRESTful endpoints...";

    mockPi.exec = vi.fn().mockResolvedValue({
      code: 0,
      stdout: contextData,
      stderr: "",
    });

    // Mock detectOpenSpecTarget
    vi.spyOn(detector, "detectOpenSpecTarget").mockResolvedValue({
      type: "root",
      path: "/tmp",
    });

    extensionDefault(mockPi);
    const handlers = getBeforeAgentStartHandlers();
    const handler = handlers[0];

    const event: Partial<BeforeAgentStartEvent> = {
      systemPrompt: basePrompt,
      systemPromptOptions: { cwd: "/tmp" },
    };

    const result = await handler(event, {});

    expect(result.systemPrompt).toContain(basePrompt);
    expect(result.systemPrompt).toContain("[OpenSpec context]");
    expect(result.systemPrompt).toContain(contextData);
    expect(result.systemPrompt).toMatch(/\n\n\[OpenSpec context\]\n/);
  });

  it("should handle runOpenSpec returning null for root target", async () => {
    mockPi.exec = vi.fn().mockResolvedValue({
      code: 1,
      stdout: "",
      stderr: "error",
    });

    extensionDefault(mockPi);
    const handlers = getBeforeAgentStartHandlers();
    const handler = handlers[0];

    const event: Partial<BeforeAgentStartEvent> = {
      systemPrompt: "Assistant",
      systemPromptOptions: { cwd: "/tmp/openspec-root" },
    };

    const result = await handler(event, {});

    expect(result).toEqual({});
  });

  it("should allow custom cache instance", async () => {
    const customCache = new OpenSpecContextCache();
    const cachedContext = "pre-cached context";

    // Pre-populate the cache
    customCache.set({ type: "root", path: "/tmp/project" }, cachedContext);

    mockPi.exec = vi.fn(); // Should not be called since we're using cache

    // Mock detectOpenSpecTarget
    vi.spyOn(detector, "detectOpenSpecTarget").mockResolvedValue({
      type: "root",
      path: "/tmp/project",
    });

    // Create extension with custom cache
    const customExtension = createExtension(customCache);
    customExtension(mockPi);

    const handlers = getBeforeAgentStartHandlers();
    const handler = handlers[0];

    const event: Partial<BeforeAgentStartEvent> = {
      systemPrompt: "Assistant",
      systemPromptOptions: { cwd: "/tmp/project" },
    };

    const result = await handler(event, {});

    expect(result.systemPrompt).toContain(cachedContext);
    expect(mockPi.exec).not.toHaveBeenCalled();
  });
});
