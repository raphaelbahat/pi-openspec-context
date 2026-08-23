# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.2] - 2026-08-23

### Fixed
- Published the updated README to NPM with both NPM and GitHub Pi installation commands.
- Removed the invalid local `file:../pi-test-harness` runtime dependency from package metadata; the test harness is now development-only.

## [0.1.1] - 2026-08-23

### Changed
- Updated README installation instructions to highlight both `pi install pi-openspec-context` (NPM) and `pi install github:raphaelbahat/pi-openspec-context` (GitHub).
- Removed stale reference extension installation commands.
- Linked directly to official OpenSpec installation documentation.

## [0.1.0] - 2026-08-23

### Added

- **Initial Release**: Lightweight Pi extension for automatic OpenSpec context injection
- **Core Feature**: Single-responsibility automatic context extraction and system prompt injection at `before_agent_start` hook
- **Smart Detection**: Two-tier detection strategy
  - Traverses upward to find `openspec/root` directories
  - Queries `openspec store list` to match registered stores
- **Flexible Context Extraction**:
  - Supports both OpenSpec roots (`openspec context`)
  - Supports OpenSpec stores (`openspec context --store <id>`)
- **In-Memory Caching**: Per-workspace context caching to minimize CLI invocations
  - Root targets cached by absolute path
  - Store targets cached by ID
- **Resilient Execution**: Hardened with timeouts and error handling
  - 10-second default timeout (configurable via `OPENSPEC_CONTEXT_TIMEOUT_MS`)
  - Graceful fallback on missing `openspec` CLI
  - Graceful fallback on timeouts and CLI errors
  - Graceful fallback on empty output
- **Output Sanitization**: ANSI color code stripping for clean context injection
- **Type Safety**: Fully typed TypeScript with strict mode
  - Discriminated unions for target types
  - Strict null checks enabled
  - No implicit `any` types
- **Complete Test Coverage**: 85+ unit, integration, and E2E tests
  - Unit tests for core modules (cache, detector, runner)
  - Extension lifecycle tests with mock Pi API
  - In-process harness tests with TestSession
  - Docker-based E2E tests simulating real Pi environment
  - Resilience tests for timeout, error, and missing CLI scenarios
- **Documentation**: 
  - Comprehensive README with architecture, installation, and troubleshooting
  - API reference for extension and cache usage
  - Development guide with build/test/lint commands
  - SOLID principles documentation
- **Package Metadata**:
  - MIT License with attribution to tobias-weiss-ai-xr/pi-openspec
  - Keywords: pi-package, pi, openspec, extension, context, spec-driven-development
  - Pi package configuration for automatic discovery

### Technical Details

- **Target Platform**: Node.js with ES2022 module support
- **Module System**: TypeScript NodeNext ESM with .js import extensions
- **Parser**: TypeScript with strict mode enabled
- **Linting**: ESLint with TypeScript support
- **Testing**: Vitest with Docker-based E2E capabilities
- **Architecture**: Single-responsibility modules (types, runner, detector, cache, index)

### Breaking Changes

None (initial release)

### Migration Guide

None (initial release)
