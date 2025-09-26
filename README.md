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

## MCP Server (Remote via Streamable HTTP)

Prompto exposes its functionality as an MCP server (Model Context Protocol) using the Streamable HTTP transport and a Vercel Function entrypoint.

### Endpoints

When deployed, the MCP endpoint will live at:

- POST /api/mcp – Streamable HTTP request channel
- GET  /api/mcp/mcp – (used internally by some clients for SSE streaming; handled by the adapter)

### Auth

- Preferred: send Authorization: Bearer <LANGSMITH_API_KEY>.
- Or pass apiKey in tool params.
- Or set LANGSMITH_API_KEY in the environment.

### Available tools

- prompts_list – List private prompts (args: query?, apiKey?).
- prompt_show – Render a prompt (args: promptId, variables?, asJson?, apiKey?).
- prompt_create – Create a prompt (args: promptId, template, format?, variables?, tags?, description?, readme?, isPublic?, apiKey?).
- prompt_update – Update a prompt (args: promptId, optional fields mirroring create, plus apiKey?).
- prompt_delete – Delete a prompt (args: promptId, apiKey?).

### Local dev (optional)

You can invoke the handler locally with vc dev (Vercel CLI) or any Web runtime invoking api/[transport].ts as a Web handler (GET/POST).

### Deploy to Vercel

1. Ensure dependencies are installed:

   ```bash
   bun add mcp-handler @modelcontextprotocol/sdk zod
   ```

2. Set LANGSMITH_API_KEY in Vercel Project → Settings → Environment Variables.
3. Connect this repo to Vercel or run:

   ```bash
   vc deploy
   ```

#### Client examples

- Claude Desktop (via mcp-remote, if needed):

  ```json
  {
    "mcpServers": {
      "prompto": {
        "command": "npx",
        "args": ["-y", "mcp-remote", "https://<your-deployment>/api/mcp"]
      }
    }
  }
  ```

- Cursor (direct Streamable HTTP where supported):

  ```json
  {
    "mcpServers": {
      "prompto": {
        "url": "https://<your-deployment>/api/mcp"
      }
    }
  }
  ```

> Implementation based on the MCP Streamable HTTP transport and Vercel's MCP adapter handler. See sources at the end of this message.

## Releasing

This project targets direct execution with Bun (`bun run cli`). If you need an installable `prompto` binary, bundle the CLI to JavaScript (e.g. with `tsup`) and expose it via the `bin` field in `package.json`.
