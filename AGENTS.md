# Agent Guide

This repository is agent-friendly. Follow these guardrails when operating as an autonomous agent:

## Setup Checklist

1. Install dependencies with `bun install`.
2. Ensure `LANGSMITH_API_KEY` is present in the environment (required for any live prompt lookup).
3. Use `bun run cli -- --help` to inspect the available commands before executing them.

## Safe Execution Patterns

- Prefer read-only interactions (`list`, `show`). Creation, update, and deletion commands are intentionally absent.
- When running the CLI inside scripted workflows, call `bun run cli -- <command>` so flags are forwarded correctly.
- Capture JSON output with `--json` if you need machine-readable data.

## Quality Gates

- Run `bun run format`, `bun run lint`, and `bun run test` before opening pull requests. These commands also run automatically via Husky on each commit.
- Tests only cover retrieval flows; do not assume destructive operations are safe.

## Troubleshooting

- Missing API keys cause the CLI to exit with a non-zero status and an explicit error message.
- Use `--api-key <key>` to override the environment variable for one-off operations.

## Coding Standards

- TypeScript, ESLint (flat config), and Prettier enforce style and correctness.
- Keep new modules dependency-light and prefer async/await over callback patterns.
- Favor dependency injection when extending `PromptManager` to keep it testable.
