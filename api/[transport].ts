/*
 * Vercel Function: MCP server (Streamable HTTP)
 * 
 * Endpoint layout (no Next.js required):
 *   Streamable HTTP POST:  /api/mcp
 *   SSE stream (when used): /api/mcp/mcp  (derived by the adapter)
 * 
 * Authentication:
 *   Preferred: Authorization: Bearer <LANGSMITH_API_KEY>
 *   Optional:  Provide "apiKey" in tool parameters
 *   Fallback:  process.env.LANGSMITH_API_KEY
 */
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import { PromptManager, type PromptDefinition, type PromptUpdate } from "../src/manager";

function resolveApiKey(
	explicitApiKey: string | undefined,
	bearerToken: string | undefined
): string {
	const key =
		explicitApiKey ??
		(bearerToken && bearerToken.trim()) ??
		process.env.LANGSMITH_API_KEY;
	if (!key) {
		throw new Error(
			"Missing LangSmith API key. Pass Authorization: Bearer <key>, --apiKey param, or set LANGSMITH_API_KEY."
		);
	}
	return key;
}

const handler = createMcpHandler(
	(server) => {
		// List prompts
		server.tool(
			"prompts_list",
			"List private LangSmith prompts (optionally filter by query).",
			{
				query: z.string().optional().describe("Filter prompts by repository or owner."),
				apiKey: z.string().optional().describe("Override LANGSMITH_API_KEY.")
			},
			async ({ query, apiKey }, extra) => {
				const key = resolveApiKey(apiKey, extra.authInfo?.token);
				const manager = new PromptManager(key);
				const prompts = await manager.listPrompts(query);
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(prompts, null, 2)
						}
					]
				};
			}
		);
		
		// Show (render) a prompt
		server.tool(
			"prompt_show",
			"Render a prompt locally with optional variables.",
			{
				promptId: z.string().describe("Prompt identifier, e.g. org/prompt-name."),
				variables: z
					.record(z.string())
					.optional()
					.describe("Key/value variables for the template."),
				asJson: z
					.boolean()
					.optional()
					.describe("Return {id, variables, prompt} JSON instead of raw text."),
				apiKey: z.string().optional().describe("Override LANGSMITH_API_KEY.")
			},
			async ({ promptId, variables, asJson, apiKey }, extra) => {
				const key = resolveApiKey(apiKey, extra.authInfo?.token);
				const manager = new PromptManager(key);
				const rendered = await manager.getPrompt(promptId, variables ?? {});
				if (!rendered) {
					throw new Error(`Prompt "${promptId}" was not found.`);
				}
				if (asJson) {
					return {
						content: [
							{
								type: "text",
								text: JSON.stringify(
									{ id: promptId, variables: variables ?? {}, prompt: rendered },
									null,
									2
								)
							}
						]
					};
				}
				return { content: [{ type: "text", text: rendered }] };
			}
		);
		
		// Create a prompt
		server.tool(
			"prompt_create",
			"Create a new LangSmith prompt.",
			{
				promptId: z.string().describe("Prompt identifier, e.g. org/onboarding."),
				template: z.string().describe("Prompt template content."),
				format: z
					.enum(["mustache", "f-string"])
					.optional()
					.describe("Template format."),
				variables: z
					.array(z.string())
					.optional()
					.describe("Template variables."),
				tags: z.array(z.string()).optional().describe("Metadata tags."),
				description: z.string().optional().describe("Prompt description."),
				readme: z.string().optional().describe("README content."),
				isPublic: z.boolean().optional().describe("Make the prompt public."),
				apiKey: z.string().optional().describe("Override LANGSMITH_API_KEY.")
			},
			async (
				{ promptId, template, format, variables, tags, description, readme, isPublic, apiKey },
				extra
			) => {
				const key = resolveApiKey(apiKey, extra.authInfo?.token);
				const manager = new PromptManager(key);
				const def: PromptDefinition = {
					template,
					templateFormat: format,
					templateVariables: variables,
					description,
					tags,
					readme,
					isPublic
				};
				const location = await manager.createPrompt(promptId, def);
				return {
					content: [{ type: "text", text: `Created: ${location}` }]
				};
			}
		);
		
		// Update a prompt
		server.tool(
			"prompt_update",
			"Update an existing prompt with new content or metadata.",
			{
				promptId: z.string().describe("Prompt identifier to update."),
				template: z.string().optional().describe("New template content."),
				format: z.enum(["mustache", "f-string"]).optional().describe("Template format."),
				variables: z.array(z.string()).optional().describe("Template variables."),
				tags: z.array(z.string()).optional().describe("Metadata tags."),
				description: z.string().optional().describe("Prompt description."),
				readme: z.string().optional().describe("README content."),
				isPublic: z.boolean().optional().describe("Visibility flag."),
				apiKey: z.string().optional().describe("Override LANGSMITH_API_KEY.")
			},
			async (
				{ promptId, template, format, variables, tags, description, readme, isPublic, apiKey },
				extra
			) => {
				const key = resolveApiKey(apiKey, extra.authInfo?.token);
				const manager = new PromptManager(key);
				const updates: PromptUpdate = {};
				if (template !== undefined) updates.template = template;
				if (format !== undefined) updates.templateFormat = format;
				if (variables !== undefined) updates.templateVariables = variables;
				if (tags !== undefined) updates.tags = tags;
				if (description !== undefined) updates.description = description;
				if (readme !== undefined) updates.readme = readme;
				if (isPublic !== undefined) updates.isPublic = isPublic;
				if (Object.keys(updates).length === 0) {
					throw new Error("Nothing to update. Provide at least one field.");
				}
				const location = await manager.updatePrompt(promptId, updates);
				return {
					content: [{ type: "text", text: `Updated. Latest version: ${location}` }]
				};
			}
		);
		
		// Delete a prompt
		server.tool(
			"prompt_delete",
			"Delete a prompt.",
			{
				promptId: z.string().describe("Prompt identifier to delete."),
				apiKey: z.string().optional().describe("Override LANGSMITH_API_KEY.")
			},
			async ({ promptId, apiKey }, extra) => {
				const key = resolveApiKey(apiKey, extra.authInfo?.token);
				const manager = new PromptManager(key);
				await manager.deletePrompt(promptId);
				return {
					content: [{ type: "text", text: `Deleted "${promptId}".` }]
				};
			}
		);
	},
	// Optional MCP ServerOptions (capabilities can be inferred from tools)
	{},
	// Adapter config
	{
		// Base path for this function (since file is api/[transport].ts use "/api")
		basePath: "/api",
		verboseLogs: false,
		maxDuration: 60
	}
);

// Make Bearer token available to tools via extra.authInfo.
const verifyToken = async (_req: Request, bearer?: string) => {
	if (!bearer) return undefined;
	// This project treats the Bearer token as the LangSmith API key.
	// Optionally, plug real verification here.
	return {
		token: bearer,
		scopes: ["prompts:read", "prompts:write"],
		clientId: "prompto-mcp"
	};
};

const authedHandler = withMcpAuth(handler, verifyToken, {
	required: false // When true, all calls require Authorization
});

// Vercel Functions (Web standard API)
export default authedHandler;
export { authedHandler as GET, authedHandler as POST };