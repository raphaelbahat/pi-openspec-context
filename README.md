# pi-openspec-context

A lightweight Pi extension that automatically injects OpenSpec context into system prompts at the start of each agent session.

## Overview

`pi-openspec-context` enhances the Pi coding agent by seamlessly integrating OpenSpec specification data into the system prompt. This enables the AI agent to understand project structure, APIs, data models, and other specification-driven context without explicit user prompts.

### Key Features

- **Automatic Context Injection**: Detects OpenSpec projects and injects context into `before_agent_start` hook
- **Smart Caching**: Caches extracted context per workspace to minimize CLI calls
- **Flexible Detection**: Works with both OpenSpec roots and registered OpenSpec stores
- **Resilient Fallback**: Gracefully handles missing `openspec` CLI, timeouts, and errors
- **ANSI Sanitization**: Strips color codes from context output for clean integration
- **Type-Safe**: Fully typed TypeScript implementation with strict mode enabled

## Installation

### As a Pi Package

You can install `pi-openspec-context` directly into Pi from either NPM or GitHub:

```bash
# Install from NPM
pi install pi-openspec-context

# Or install from GitHub
pi install github:raphaelbahat/pi-openspec-context
```

### Global Installation (for local development)

```bash
npm install -g pi-openspec-context
```

Then add to your Pi configuration:

```json
{
  "extensions": [
    "pi-openspec-context"
  ]
}
```

### Project-Local Installation

```bash
npm install --save-dev pi-openspec-context
```

## Prerequisites

### Required
- **OpenSpec CLI**: Must be installed and accessible in your PATH.
  - Please follow the official [OpenSpec Installation Documentation](https://github.com/Fission-AI/OpenSpec/blob/main/docs/installation.md) to set up the CLI.
  - Verify with: `openspec --version`

### Optional
- Pi coding agent v0.84.0 or later (typically included with Pi installation)

## Architecture & Behavior

### Detection Strategy

The extension uses a two-tier detection approach:

1. **OpenSpec Root Detection**: Traverses upward from the current working directory looking for `openspec/config.yaml`
2. **Store Detection**: If no root is found, queries `openspec store list --json` to match the current directory against registered stores

### Context Extraction

Once a target is detected:
- **Root Target**: Executes `openspec context` at the root path
- **Store Target**: Executes `openspec context --store <store-id>` from the current directory

### Caching

Extracted context is cached in-memory per target:
- Root targets are keyed by absolute path
- Store targets are keyed by store ID
- Cache persists for the lifetime of the Pi session

### Injection

The cleaned context is injected into the system prompt using a marker:

```
[OpenSpec context]
<extracted context data>
```

## Configuration

The extension works with zero configuration. Simply install and enable it.

### Environment Variables

Optional environment variable to override the default timeout:
- `OPENSPEC_CONTEXT_TIMEOUT_MS`: Timeout for `openspec` CLI execution (default: 10000ms)

## Troubleshooting

### "openspec: command not found"

**Problem**: The extension runs but no context is injected.

**Solution**:
1. Verify OpenSpec is installed: `which openspec`
2. If missing, follow the [OpenSpec Installation Documentation](https://github.com/Fission-AI/OpenSpec/blob/main/docs/installation.md).
3. Check PATH is configured: `echo $PATH`
4. Restart Pi after installing OpenSpec

### Context Not Appearing in Prompts

**Problem**: Extension is loaded but context not injected.

**Checklist**:
1. Confirm you're in an OpenSpec root or registered store: `openspec store list`
2. Verify OpenSpec can extract context: `openspec context`
3. Check extension is loaded: Look for "pi-openspec-context" in Pi logs
4. Inspect cache behavior: Add debug logging to extension

### Timeout Errors

**Problem**: Extension times out and falls back silently.

**Solution**:
1. Test OpenSpec manually: `time openspec context`
2. Increase timeout if needed: Set `OPENSPEC_CONTEXT_TIMEOUT_MS=30000`
3. Check for hung `openspec` processes: `ps aux | grep openspec`

### Empty or Whitespace-Only Context

**Problem**: OpenSpec runs but returns empty output.

**Solution**:
1. Verify OpenSpec project is valid: `openspec validate`
2. Check for malformed YAML in `openspec/` directory
3. Try manual context extraction: `openspec context`

## API Reference

### Extension Export

The package exports a default extension factory:

```typescript
import extension from 'pi-openspec-context';

// Used automatically by Pi's extension loader
extension(pi);
```

### Custom Cache Usage

For advanced use cases, you can create an extension with a custom cache:

```typescript
import { createExtension, contextCache } from 'pi-openspec-context';

// Use default shared cache
const ext = createExtension();
ext(pi);

// Or provide custom cache
import { OpenSpecContextCache } from 'pi-openspec-context/cache';
const customCache = new OpenSpecContextCache();
const extWithCustomCache = createExtension(customCache);
extWithCustomCache(pi);
```

### Cache Methods

- `get(target): string | null` - Retrieve cached context
- `set(target, context): void` - Store context in cache
- `has(target): boolean` - Check if target is cached
- `delete(target): boolean` - Remove specific target from cache
- `clear(): void` - Clear all cached contexts
- `size(): number` - Get cache entry count

## Development

### Building

```bash
npm run build
```

### Testing

```bash
npm run test           # Run all tests
npm run test:watch    # Watch mode
npm run test:e2e      # Docker E2E tests only
```

### Type Checking

```bash
npm run typecheck
```

### Linting

```bash
npm run lint
```

## Architecture Notes

### Modules

- **`src/types.ts`**: Core type definitions (discriminated unions, interfaces)
- **`src/runner.ts`**: OpenSpec CLI execution and ANSI sanitization
- **`src/detector.ts`**: Root and store detection logic
- **`src/cache.ts`**: In-memory caching with path normalization
- **`src/index.ts`**: Pi extension lifecycle hook implementation

### SOLID Principles

- **Single Responsibility**: Each module has one clear purpose
- **Open/Closed**: Extension logic is frozen but cacheable via factory function
- **Liskov Substitution**: Cache implements a standard interface
- **Interface Segregation**: Types are minimal and focused
- **Dependency Inversion**: Depends on `PiExecContext` interface, not concrete implementations

### Error Handling

All errors are caught and logged silently. The extension falls back gracefully:
- Missing `openspec` CLI → returns `{}`
- CLI errors → returns `{}`
- Timeout → returns `{}`
- Empty output → returns `{}`

This ensures the extension never breaks the agent workflow.

## License

MIT License

## Attribution

Based on original work by [tobias-weiss-ai-xr/pi-openspec](https://github.com/tobias-weiss-ai-xr/pi-openspec)

Created by [Raphael Bahat](https://earendil.works)
