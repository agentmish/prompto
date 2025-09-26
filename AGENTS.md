# Agent Guide

This repository is agent-friendly. Follow these guardrails when operating as an autonomous agent:

## Setup Checklist

1. Install dependencies with `bun install`.
2. Ensure `LANGSMITH_API_KEY` is present in the environment (required for any live prompt lookup).
3. Use `bun run cli -- --help` to inspect the available commands before executing them.

## Safe Execution Patterns

- Use read-only interactions (`list`, `show`) unless you explicitly need to mutate prompts.
- Mutation commands (`create`, `update`, `delete`) accept JSON payloads; double-check the target prompt and payloads before executing them.
- When running the CLI inside scripted workflows, call `bun run cli -- <command>` so flags are forwarded correctly.
- Capture JSON output with `--json` if you need machine-readable data, or `--save <file>` to persist rendered prompts.

## Quality Gates

- Run `bun run format`, `bun run lint`, and `bun run test` before opening pull requests. These commands also run automatically via Husky on each commit.
- Tests mock LangSmith network calls but cover create/update/delete flows; still avoid running against production tenants without review.

## Troubleshooting

- Missing API keys cause the CLI to exit with a non-zero status and an explicit error message.
- Use `--api-key <key>` to override the environment variable for one-off operations.

## MCP Usage (for agents)

- Entry: POST /api/mcp (Streamable HTTP). Some clients will also open GET /api/mcp/mcp for streaming; the adapter handles that automatically.
- Auth:
  - Prefer Authorization: Bearer <LANGSMITH_API_KEY>.
  - Alternatively pass apiKey in tool args; environment fallback LANGSMITH_API_KEY applies.
- Tools:
  - prompts_list({ query?, apiKey? })
  - prompt_show({ promptId, variables?, asJson?, apiKey? })
  - prompt_create({ promptId, template, format?, variables?, tags?, description?, readme?, isPublic?, apiKey? })
  - prompt_update({ promptId, ...partial fields..., apiKey? })
  - prompt_delete({ promptId, apiKey? })
- Safety:
  - Treat create/update/delete as destructive. Confirm inputs before invoking.
  - Prefer prompts_list / prompt_show in reconnaissance flows.

## Coding Standards

- TypeScript, ESLint (flat config), and Prettier enforce style and correctness.
- Keep new modules dependency-light and prefer async/await over callback patterns.
- Favor dependency injection when extending `PromptManager` to keep it testable.
