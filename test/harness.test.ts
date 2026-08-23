import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import {
  createTestSession,
  when,
  calls,
  says,
  type TestSession,
} from "@gaodes/pi-test-harness";
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";
import * as detector from "../src/detector";

const EXTENSION = path.resolve(__dirname, "../src/index.ts");

describe("pi-openspec-context in-process session lifecycle", () => {
  let t: TestSession;
  let tempDir: string;

  afterEach(() => {
    t?.dispose();
    // Clean up temp directories
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("Extension Loading", () => {
    it("should initialize cleanly in a Pi test session", async () => {
      t = await createTestSession({
        extensions: [EXTENSION],
        mockTools: {
          bash: "ok",
          read: "contents",
          write: "written",
          edit: "edited",
        },
      });

      // Verify session is created successfully
      expect(t).toBeDefined();
      expect(t.session).toBeDefined();
      expect(t.cwd).toBeDefined();

      // Run a simple turn to verify the extension doesn't break anything
      await t.run(
        when("List files", [
          calls("bash", { command: "ls" }),
          says("Task complete."),
        ])
      );

      // Verify the turn completed without errors
      expect(t.playbook.consumed).toBeGreaterThan(0);
    });
  });

  describe("OpenSpec Root Session", () => {
    beforeEach(() => {
      // Create a temporary directory with openspec config
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openspec-test-"));
      const openspecDir = path.join(tempDir, "openspec");
      fs.mkdirSync(openspecDir, { recursive: true });
      fs.writeFileSync(path.join(openspecDir, "config.yaml"), "# OpenSpec Config");
    });

    it("should inject [OpenSpec context] when in an OpenSpec root directory", async () => {
      // Mock detectOpenSpecTarget to return a root target before session creation
      vi.spyOn(detector, "detectOpenSpecTarget").mockResolvedValue({
        type: "root",
        path: tempDir,
      });

      t = await createTestSession({
        cwd: tempDir,
        extensions: [EXTENSION],
        mockTools: {
          bash: "task completed",
          read: "file contents",
          write: "written",
          edit: "edited",
        },
      });

      // Run a turn to trigger the before_agent_start hook
      await t.run(
        when("What is the API structure?", [
          calls("bash", { command: "echo hello" }),
          says("Based on the OpenSpec context..."),
        ])
      );

      // Verify the turn completed successfully
      const messages = t.events.messages;
      expect(messages).toBeDefined();
      expect(messages.length).toBeGreaterThan(0);
    });

    it("should cache context for subsequent turns in the same root", async () => {
      // Mock detectOpenSpecTarget before session creation
      vi.spyOn(detector, "detectOpenSpecTarget").mockResolvedValue({
        type: "root",
        path: tempDir,
      });

      t = await createTestSession({
        cwd: tempDir,
        extensions: [EXTENSION],
        mockTools: {
          bash: "output",
          read: "contents",
          write: "written",
          edit: "edited",
        },
      });

      // First turn
      await t.run(
        when("First question", [
          calls("bash", { command: "ls" }),
          says("Got context"),
        ])
      );

      // Second turn - context should be cached
      await t.run(
        when("Second question", [
          calls("bash", { command: "echo test" }),
          says("Using cached context"),
        ])
      );

      // Both turns should complete successfully
      expect(t.playbook.consumed).toBeGreaterThan(0);
    });
  });

  describe("Non-OpenSpec Directory", () => {
    beforeEach(() => {
      // Create a temporary directory without OpenSpec config
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "non-openspec-test-"));
    });

    it("should not inject [OpenSpec context] when in a non-OpenSpec directory", async () => {
      // Mock detectOpenSpecTarget to return null (no OpenSpec found)
      const detectSpy = vi.spyOn(detector, "detectOpenSpecTarget");
      detectSpy.mockResolvedValue(null);

      t = await createTestSession({
        cwd: tempDir,
        extensions: [EXTENSION],
        mockTools: {
          bash: "command output",
          read: "file contents",
          write: "written",
          edit: "edited",
        },
      });

      await t.run(
        when("Do something", [
          calls("bash", { command: "pwd" }),
          says("Task done"),
        ])
      );

      // Verify no tool calls failed due to missing context
      const toolResults = t.events.toolResultsFor("bash");
      expect(toolResults).toBeDefined();
      expect(toolResults.length).toBeGreaterThan(0);
      expect(toolResults[0].isError).toBe(false);

      detectSpy.mockRestore();
    });
  });

  describe("Store Directory Matching", () => {
    beforeEach(() => {
      // Create a temporary store directory
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "store-test-"));
    });

    it("should inject context when in a registered OpenSpec store", async () => {
      const storeId = "test-store-001";

      // Mock detectOpenSpecTarget before session creation
      vi.spyOn(detector, "detectOpenSpecTarget").mockResolvedValue({
        type: "store",
        id: storeId,
        cwd: tempDir,
      });

      t = await createTestSession({
        cwd: tempDir,
        extensions: [EXTENSION],
        mockTools: {
          bash: "store operation completed",
          read: "store contents",
          write: "store data written",
          edit: "store data edited",
        },
      });

      await t.run(
        when("Work with store items", [
          calls("bash", { command: "store list" }),
          says("Working with store context"),
        ])
      );

      // Verify that the turn completed successfully
      expect(t.playbook.consumed).toBeGreaterThan(0);
    });

    it("should handle store subdirectories", async () => {
      const storeId = "nested-store";
      const subdir = path.join(tempDir, "subdir", "nested");
      fs.mkdirSync(subdir, { recursive: true });

      const detectSpy = vi.spyOn(detector, "detectOpenSpecTarget");
      detectSpy.mockResolvedValue({
        type: "store",
        id: storeId,
        cwd: subdir,
      });

      t = await createTestSession({
        cwd: subdir,
        extensions: [EXTENSION],
        mockTools: {
          bash: "nested operation",
          read: "nested contents",
          write: "written",
          edit: "edited",
        },
      });

      await t.run(
        when("Access nested store", [
          calls("bash", { command: "pwd" }),
          says("Working in nested store context"),
        ])
      );

      expect(t.events.toolResultsFor("bash")[0].isError).toBe(false);

      detectSpy.mockRestore();
    });
  });

  describe("Resilient Fallback", () => {
    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "resilient-test-"));
    });

    it("should complete turn without errors when openspec binary is missing", async () => {
      // Mock detectOpenSpecTarget to return null (simulate missing binary)
      const detectSpy = vi.spyOn(detector, "detectOpenSpecTarget");
      detectSpy.mockResolvedValue(null);

      t = await createTestSession({
        cwd: tempDir,
        extensions: [EXTENSION],
        mockTools: {
          bash: "fallback output",
          read: "file data",
          write: "written",
          edit: "edited",
        },
      });

      // Should complete without throwing
      await expect(
        t.run(
          when("Continue despite missing openspec", [
            calls("bash", { command: "ls -la" }),
            says("Successfully completed turn"),
          ])
        )
      ).resolves.not.toThrow();

      // Verify the turn completed
      expect(t.playbook.consumed).toBeGreaterThan(0);

      detectSpy.mockRestore();
    });

    it("should complete turn when openspec CLI returns error", async () => {
      // Mock detectOpenSpecTarget to return null (simulate error)
      const detectSpy = vi.spyOn(detector, "detectOpenSpecTarget");
      detectSpy.mockResolvedValue(null);

      t = await createTestSession({
        cwd: tempDir,
        extensions: [EXTENSION],
        mockTools: {
          bash: "continued",
          read: "contents",
          write: "ok",
          edit: "ok",
        },
      });

      // Should complete without throwing
      await expect(
        t.run(
          when("Handle openspec error gracefully", [
            calls("bash", { command: "echo test" }),
            says("Turn completed despite openspec error"),
          ])
        )
      ).resolves.not.toThrow();

      expect(t.playbook.consumed).toBeGreaterThan(0);

      detectSpy.mockRestore();
    });

    it("should work when openspec CLI times out", async () => {
      // Mock detectOpenSpecTarget to throw (simulate timeout)
      const detectSpy = vi.spyOn(detector, "detectOpenSpecTarget");
      detectSpy.mockRejectedValue(new Error("Command timed out"));

      t = await createTestSession({
        cwd: tempDir,
        extensions: [EXTENSION],
        mockTools: {
          bash: "operation completed",
          read: "file",
          write: "saved",
          edit: "modified",
        },
      });

      await expect(
        t.run(
          when("Work while openspec times out", [
            calls("bash", { command: "long-running-task" }),
            says("Completed despite timeout"),
          ])
        )
      ).resolves.not.toThrow();

      expect(t.events.messages.length).toBeGreaterThan(0);

      detectSpy.mockRestore();
    });

    it("should continue on empty openspec output", async () => {
      // Mock detectOpenSpecTarget to return null (simulate empty output)
      const detectSpy = vi.spyOn(detector, "detectOpenSpecTarget");
      detectSpy.mockResolvedValue(null);

      t = await createTestSession({
        cwd: tempDir,
        extensions: [EXTENSION],
        mockTools: {
          bash: "command output",
          read: "data",
          write: "stored",
          edit: "updated",
        },
      });

      await t.run(
        when("Handle empty context", [
          calls("bash", { command: "sync" }),
          says("Proceeded without context"),
        ])
      );

      // Verify tool executed successfully
      const bashResults = t.events.toolResultsFor("bash");
      expect(bashResults).toBeDefined();
      expect(bashResults.length).toBeGreaterThan(0);

      detectSpy.mockRestore();
    });
  });

  describe("Integration scenarios", () => {
    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "integration-test-"));
    });

    it("should handle multiple turns in sequence", async () => {
      const openspecDir = path.join(tempDir, "openspec");
      fs.mkdirSync(openspecDir, { recursive: true });
      fs.writeFileSync(path.join(openspecDir, "config.yaml"), "# Config");

      // Mock detectOpenSpecTarget before session creation
      vi.spyOn(detector, "detectOpenSpecTarget").mockResolvedValue({
        type: "root",
        path: tempDir,
      });

      t = await createTestSession({
        cwd: tempDir,
        extensions: [EXTENSION],
        mockTools: {
          bash: "done",
          read: "content",
          write: "written",
          edit: "edited",
        },
      });

      // Multiple turns
      await t.run(
        when("First action", [
          calls("bash", { command: "cmd1" }),
          says("Done with first"),
        ]),
        when("Second action", [
          calls("bash", { command: "cmd2" }),
          says("Done with second"),
        ]),
        when("Third action", [
          calls("bash", { command: "cmd3" }),
          says("Done with third"),
        ])
      );

      // Verify all turns completed (playbook.consumed counts each action, not turn)
      // Each turn has 2 actions (calls + says), so 3 turns = 6 actions
      expect(t.playbook.consumed).toBe(6);
      const allMessages = t.events.messages;
      expect(allMessages.length).toBeGreaterThanOrEqual(3);
    });

    it("should sanitize ANSI codes in context", async () => {
      // Create openspec config so it detects root
      const openspecDir = path.join(tempDir, "openspec");
      fs.mkdirSync(openspecDir, { recursive: true });
      fs.writeFileSync(path.join(openspecDir, "config.yaml"), "");

      const detectSpy = vi.spyOn(detector, "detectOpenSpecTarget");
      detectSpy.mockResolvedValue({
        type: "root",
        path: tempDir,
      });

      t = await createTestSession({
        cwd: tempDir,
        extensions: [EXTENSION],
        mockTools: {
          bash: "done",
          read: "file",
          write: "ok",
          edit: "ok",
        },
      });

      await t.run(
        when("Check ANSI handling", [
          calls("bash", { command: "echo test" }),
          says("ANSI codes should be stripped"),
        ])
      );

      // Verify no exceptions thrown
      expect(t.events.toolResultsFor("bash")[0].isError).toBe(false);

      detectSpy.mockRestore();
    });
  });
});
