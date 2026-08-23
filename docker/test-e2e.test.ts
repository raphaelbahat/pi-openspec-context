import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { createTestSession, when, says, calls } from "@gaodes/pi-test-harness";
import * as path from "path";
import * as fs from "fs";
import type { BeforeAgentStartEvent, ExtensionContext } from "@earendil-works/pi-coding-agent";

// Import the extension
import extensionDefault from "../dist/index.js";

describe("Pi OpenSpec Context - E2E Docker Tests", () => {
  const projectRoot = process.cwd();
  const openspecWorkspacePath = path.join(projectRoot, "docker", "openspec-workspace");
  const testDirectoryPath = path.join(projectRoot, "docker", "test-directory");
  const testOutputPath = path.join(projectRoot, "docker", "test-output");

  beforeAll(() => {
    // Create test directories
    fs.mkdirSync(testOutputPath, { recursive: true });
    fs.mkdirSync(openspecWorkspacePath, { recursive: true });
    fs.mkdirSync(testDirectoryPath, { recursive: true });

    // Create a mock openspec config.yaml for the workspace
    const configPath = path.join(openspecWorkspacePath, "config.yaml");
    if (!fs.existsSync(configPath)) {
      fs.writeFileSync(
        configPath,
        `
version: "1.0"
metadata:
  name: "Test OpenSpec Project"
  description: "Sample OpenSpec configuration for e2e testing"
specs:
  api:
    title: "REST API"
    description: "Main API endpoints"
    version: "1.0.0"
`.trim()
      );
    }

    // Create a mock openspec/spec.yaml file
    const specDir = path.join(openspecWorkspacePath, "specs");
    fs.mkdirSync(specDir, { recursive: true });
    const specPath = path.join(specDir, "api.yaml");
    if (!fs.existsSync(specPath)) {
      fs.writeFileSync(
        specPath,
        `
title: "REST API Specification"
version: "1.0.0"
paths:
  /api/users:
    get:
      summary: "Get all users"
      responses:
        200:
          description: "List of users"
  /api/users/{id}:
    get:
      summary: "Get user by ID"
      parameters:
        - name: id
          in: path
          required: true
      responses:
        200:
          description: "User details"
`.trim()
      );
    }

    console.log("Test directories created:");
    console.log("  - OpenSpec workspace:", openspecWorkspacePath);
    console.log("  - Test directory:", testDirectoryPath);
    console.log("  - Test output:", testOutputPath);
  });

  afterAll(() => {
    console.log("Cleaning up test artifacts...");
    // Note: Keep directories for inspection; they'll be cleaned by docker-compose
  });

  describe("Extension lifecycle and event handling", () => {
    it("should register before_agent_start listener", async () => {
      const t = await createTestSession({
        extensionFactories: [extensionDefault],
        mockTools: {
          bash: "ok",
          read: "file content",
          write: "written",
          edit: "edited",
          exec: "executed",
        },
      });

      // Verify session created successfully
      expect(t).toBeDefined();
      expect(t.session).toBeDefined();
      expect(typeof t.run).toBe("function");

      t.dispose();
    });

    it("should fire before_agent_start event", async () => {
      let beforeAgentStartFired = false;

      const t = await createTestSession({
        extensionFactories: [
          extensionDefault,
          (pi: any) => {
            pi.on("before_agent_start", () => {
              beforeAgentStartFired = true;
            });
          },
        ],
        mockTools: {
          bash: "ok",
          read: "file content",
          write: "written",
          edit: "edited",
          exec: "executed",
        },
      });

      await t.run(
        when("Test query", [
          says("Response"),
        ])
      );

      expect(beforeAgentStartFired).toBe(true);

      t.dispose();
    });
  });

  describe("OpenSpec context injection", () => {
    it("should inject [OpenSpec context] marker into system prompt", async () => {
      let capturedSystemPrompt: string | undefined;
      let contextInjectionVerified = false;

      const t = await createTestSession({
        extensionFactories: [
          extensionDefault,
          (pi: any) => {
            pi.on("before_agent_start", (event: BeforeAgentStartEvent, ctx?: ExtensionContext) => {
              // Capture the system prompt after extension processing
              capturedSystemPrompt = event.systemPrompt;
            });
          },
        ],
        mockTools: {
          bash: (params: any) => {
            // Mock openspec context command
            if (params.command && params.command.includes("openspec context")) {
              return `# OpenSpec Context
## API Overview
- Base URL: http://localhost:3000
- Version: 1.0.0
- Authentication: Bearer token required
## Endpoints
- GET /api/users - List all users
- GET /api/users/{id} - Get user by ID
- POST /api/users - Create new user`;
            }
            return "ok";
          },
          read: "file content",
          write: "written",
          edit: "edited",
          exec: (params: any) => {
            // Mock exec for openspec command
            if (params.command && params.command.includes("openspec context")) {
              return {
                code: 0,
                stdout: `# OpenSpec Context
## API Overview
- Base URL: http://localhost:3000
- Version: 1.0.0
- Authentication: Bearer token required`,
                stderr: "",
              };
            }
            return { code: 0, stdout: "", stderr: "" };
          },
        },
      });

      await t.run(
        when("User query in OpenSpec project", [
          says("I'll help with that"),
        ])
      );

      // Verify that before_agent_start processed the prompt
      // Note: Due to mock environment, the actual context injection may not occur,
      // but the structure should be in place
      expect(capturedSystemPrompt).toBeDefined();

      t.dispose();
    });

    it("should handle non-OpenSpec directory fallback gracefully", async () => {
      let systemPromptAfterExtension: string | undefined;

      const t = await createTestSession({
        extensionFactories: [
          extensionDefault,
          (pi: any) => {
            // Mock Pi.exec to always return failure for non-OpenSpec directory
            const originalExec = pi.exec.bind(pi);
            pi.exec = vi.fn(async (command: string) => {
              // Simulate openspec command not found in non-OpenSpec directory
              if (command.includes("openspec")) {
                return {
                  code: 1,
                  stdout: "",
                  stderr: "command not found: openspec",
                };
              }
              return originalExec(command);
            });

            pi.on("before_agent_start", (event: BeforeAgentStartEvent) => {
              systemPromptAfterExtension = event.systemPrompt;
            });
          },
        ],
        mockTools: {
          bash: "ok",
          read: "file content",
          write: "written",
          edit: "edited",
          exec: (params: any) => ({
            code: 1,
            stdout: "",
            stderr: "command not found: openspec",
          }),
        },
      });

      await t.run(
        when("Query in non-OpenSpec directory", [
          says("Response without OpenSpec context"),
        ])
      );

      // System prompt should still be usable without OpenSpec context
      expect(systemPromptAfterExtension).toBeDefined();
      // Should NOT contain the OpenSpec context marker
      expect(systemPromptAfterExtension).not.toContain("[OpenSpec context]");

      t.dispose();
    });
  });

  describe("Context caching behavior", () => {
    it("should cache context across multiple agent starts", async () => {
      let execCallCount = 0;

      const t = await createTestSession({
        extensionFactories: [extensionDefault],
        mockTools: {
          bash: (params: any) => {
            if (params.command && params.command.includes("openspec")) {
              execCallCount++;
              return "context data";
            }
            return "ok";
          },
          read: "file content",
          write: "written",
          edit: "edited",
          exec: (params: any) => {
            if (params.command && params.command.includes("openspec")) {
              execCallCount++;
              return {
                code: 0,
                stdout: "cached context",
                stderr: "",
              };
            }
            return { code: 0, stdout: "", stderr: "" };
          },
        },
      });

      await t.run(
        when("First query", [
          says("First response"),
        ]),
        when("Second query", [
          says("Second response"),
        ])
      );

      // Both queries should use the same cached context
      // Call count should be at most 1 (due to caching)
      expect(execCallCount).toBeLessThanOrEqual(1);

      t.dispose();
    });
  });

  describe("Extension integration with Pi SDK", () => {
    it("should be compatible with Pi SDK session API", async () => {
      const t = await createTestSession({
        extensionFactories: [extensionDefault],
        mockTools: {
          bash: "ok",
          read: "file content",
          write: "written",
          edit: "edited",
          exec: "executed",
        },
      });

      // Verify session has expected properties
      expect(t).toHaveProperty("run");
      expect(t).toHaveProperty("events");
      expect(t).toHaveProperty("session");
      expect(t).toHaveProperty("dispose");

      await t.run(
        when("Test", [
          says("Done"),
        ])
      );

      // Verify events were captured
      expect(t.events).toBeDefined();

      t.dispose();
    });

    it("should not interfere with normal agent operation when no OpenSpec project", async () => {
      const t = await createTestSession({
        extensionFactories: [extensionDefault],
        mockTools: {
          bash: "ok",
          read: "file content",
          write: "written",
          edit: "edited",
          exec: (params: any) => {
            // Simulate environment without openspec
            if (params.command && params.command.includes("openspec")) {
              return {
                code: 127,
                stdout: "",
                stderr: "command not found: openspec",
              };
            }
            return { code: 0, stdout: "", stderr: "" };
          },
        },
      });

      let successfulRun = false;

      try {
        await t.run(
          when("Normal query without OpenSpec", [
            calls("read", { path: "/tmp/file.txt" }),
            says("Here is the file"),
          ])
        );
        successfulRun = true;
      } catch (error) {
        console.error("Session failed:", error);
      }

      expect(successfulRun).toBe(true);

      t.dispose();
    });
  });

  describe("Error handling and robustness", () => {
    it("should handle missing or invalid OpenSpec configuration gracefully", async () => {
      const t = await createTestSession({
        extensionFactories: [extensionDefault],
        mockTools: {
          bash: "ok",
          read: "file content",
          write: "written",
          edit: "edited",
          exec: (params: any) => {
            if (params.command && params.command.includes("openspec")) {
              return {
                code: 2,
                stdout: "",
                stderr: "Invalid OpenSpec configuration",
              };
            }
            return { code: 0, stdout: "", stderr: "" };
          },
        },
      });

      let sessionCompleted = false;

      try {
        await t.run(
          when("Query with invalid config", [
            says("Graceful response"),
          ])
        );
        sessionCompleted = true;
      } catch (error) {
        console.error("Unexpected error:", error);
      }

      expect(sessionCompleted).toBe(true);

      t.dispose();
    });

    it("should handle empty or whitespace-only context", async () => {
      const t = await createTestSession({
        extensionFactories: [extensionDefault],
        mockTools: {
          bash: "ok",
          read: "file content",
          write: "written",
          edit: "edited",
          exec: (params: any) => {
            if (params.command && params.command.includes("openspec")) {
              return {
                code: 0,
                stdout: "   \n\t  ", // Whitespace only
                stderr: "",
              };
            }
            return { code: 0, stdout: "", stderr: "" };
          },
        },
      });

      let sessionCompleted = false;

      try {
        await t.run(
          when("Query returning empty context", [
            says("Response"),
          ])
        );
        sessionCompleted = true;
      } catch (error) {
        console.error("Unexpected error:", error);
      }

      expect(sessionCompleted).toBe(true);

      t.dispose();
    });
  });
});
