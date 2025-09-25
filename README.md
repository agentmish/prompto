# prompto

A modern, TypeScript-powered CLI for browsing and rendering LangSmith prompts. Prompto wraps the LangSmith Hub APIs with a fast Commander-based interface, colorful output, and helpers for injecting dynamic variables into your prompts.

## Requirements

- [Bun](https://bun.sh) v1.1 or newer
- A valid `LANGSMITH_API_KEY` with access to the prompts you want to inspect

## Getting Started

```bash
bun install
export LANGSMITH_API_KEY="sk-..."
```

Run the CLI via the bundled helper script:

```bash
bun run cli -- --help
```

> The first `--` terminates `bun run` arguments so any following flags are passed straight to the CLI.

## Usage

List private prompts in your LangSmith workspace:

```bash
bun run cli -- list
```

Filter by name or owner and print the raw JSON payload:

```bash
bun run cli -- list --query onboarding --json
```

Render a prompt with variables:

```bash
bun run cli -- show org/welcome --var name=Taylor --var locale=en
```

Export the rendered prompt as JSON for downstream tooling:

```bash
bun run cli -- show org/welcome --json
```

Provide an explicit API key (overrides `LANGSMITH_API_KEY`):

```bash
bun run cli -- list --api-key sk-live-123
```

## Development

Available scripts:

- `bun run lint` – ESLint with TypeScript support
- `bun run format` – Format the project with Prettier
- `bun run test` – Execute the Vitest suite (non-destructive retrieval coverage)
- `bun run test:watch` – Watch mode for tests

A Husky pre-commit hook automatically formats, lints, and tests the codebase to keep commits clean.

## Testing Notes

The automated test suite exercises prompt retrieval flows only. Creation, update, and deletion operations are intentionally untested to avoid mutating remote state.

## Releasing

This project targets direct execution with Bun (`bun run cli`). If you need an installable `prompto` binary, bundle the CLI to JavaScript (e.g. with `tsup`) and expose it via the `bin` field in `package.json`.
