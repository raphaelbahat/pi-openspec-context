import type {
  ExtensionAPI,
  ExtensionContext,
  BeforeAgentStartEvent,
  BeforeAgentStartEventResult,
} from "@earendil-works/pi-coding-agent";
import { detectOpenSpecTarget } from "./detector.js";
import { runOpenSpec, sanitizeContext } from "./runner.js";
import { OpenSpecContextCache } from "./cache.js";

// Global cache instance for the extension
export const contextCache = new OpenSpecContextCache();

/**
 * Creates a before_agent_start handler with the given cache and PI instance
 * @param pi The ExtensionAPI instance
 * @param cache The cache instance to use
 */
function createBeforeAgentStartHandler(
  pi: ExtensionAPI,
  cache: OpenSpecContextCache
) {
  return async (
    event: BeforeAgentStartEvent,
    ctx?: ExtensionContext
  ): Promise<BeforeAgentStartEventResult> => {
    // Get working directory with fallback chain
    const cwd =
      event.systemPromptOptions?.cwd ||
      ctx?.cwd ||
      process.cwd();

    // Detect OpenSpec target (root or store)
    const target = await detectOpenSpecTarget(pi, cwd);

    if (!target) {
      return {};
    }

    // Check cache first
    let contextText = cache.get(target);

    // If not cached, run openspec to retrieve context
    if (!contextText) {
      if (target.type === "root") {
        contextText = await runOpenSpec(pi, ["context"], target.path);
      } else if (target.type === "store") {
        contextText = await runOpenSpec(
          pi,
          ["context", "--store", target.id],
          target.cwd
        );
      }

      // Cache the result if we got one
      if (contextText) {
        cache.set(target, contextText);
      }
    }

    // Return empty if no context available
    if (!contextText) {
      return {};
    }

    // Sanitize the context (strip ANSI codes, trim whitespace)
    const cleaned = sanitizeContext(contextText);

    // Return empty if sanitized content is empty
    if (!cleaned) {
      return {};
    }

    // Inject context into system prompt
    return {
      systemPrompt: event.systemPrompt + "\n\n[OpenSpec context]\n" + cleaned,
    };
  };
}

/**
 * Creates an extension factory with optional custom cache
 * @param cache Optional custom cache instance (defaults to shared contextCache)
 */
export function createExtension(
  cache?: OpenSpecContextCache
): (pi: ExtensionAPI) => void {
  const cacheInstance = cache || contextCache;

  return (pi: ExtensionAPI) => {
    pi.on("before_agent_start", createBeforeAgentStartHandler(pi, cacheInstance));
  };
}

/**
 * Default extension function that registers the before_agent_start listener
 */
export default function (pi: ExtensionAPI): void {
  const handler = createBeforeAgentStartHandler(pi, contextCache);
  pi.on("before_agent_start", handler);
}
