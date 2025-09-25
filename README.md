# prompto

A modern, TypeScript-powered CLI for browsing and managing LangSmith prompts. Prompto wraps the LangSmith Hub APIs with a fast Commander-based interface, colorful output, and helpers for rendering, creating, updating, and deleting prompts without leaving your terminal.

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

Export the rendered prompt as JSON or persist it to disk:

```bash
bun run cli -- show org/welcome --json
bun run cli -- show org/welcome --save prompt.mustache
```

Provide an explicit API key (overrides `LANGSMITH_API_KEY`):

```bash
bun run cli -- list --api-key sk-live-123
```

Create a new prompt (template can come from a flag or file):

```bash
bun run cli -- create org/onboarding \
  --template-file templates/onboarding.mustache \
  --variables '["name","product"]' \
  --tags '["beta","sales"]' \
  --description "Welcome message" \
  --public
```

Update only the metadata or variables for an existing prompt:

```bash
bun run cli -- update org/onboarding --variables '["name","product","locale"]' --private
```

Delete a prompt after confirming it exists:

```bash
bun run cli -- delete org/onboarding
```

## Development

Available scripts:

- `bun run lint` – ESLint with TypeScript support
- `bun run format` – Format the project with Prettier
- `bun run test` – Execute the Vitest suite (manager + CLI coverage with mocked LangSmith API calls)
- `bun run test:watch` – Watch mode for tests

A Husky pre-commit hook automatically formats, lints, and tests the codebase to keep commits clean.

## Testing Notes

Tests rely on mocked LangSmith Hub interactions to avoid mutating remote state. The harness exercises prompt listing, rendering, create/update/delete flows, and CLI option parsing (including file-system writes).

## Releasing

This project targets direct execution with Bun (`bun run cli`). If you need an installable `prompto` binary, bundle the CLI to JavaScript (e.g. with `tsup`) and expose it via the `bin` field in `package.json`.
