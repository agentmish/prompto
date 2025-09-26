#!/usr/bin/env node
import { createServer } from "http";
import { parse } from "url";
import { PromptManager } from "./manager.js";

interface MCPSession {
    id: string;
    capabilities: {
        tools: boolean;
        resources: boolean;
    };
}

interface MCPRequest {
    jsonrpc: "2.0";
    id?: string | number;
    method: string;
    params?: any;
}

interface MCPResponse {
    jsonrpc: "2.0";
    id: string | number;
    result?: any;
    error?: {
        code: number;
        message: string;
        data?: any;
    };
}

interface Tool {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: Record<string, any>;
        required?: string[];
    };
}

interface ListToolsRequest {
    method: "tools/list";
}

interface CallToolRequest {
    method: "tools/call";
    params: {
        name: string;
        arguments: Record<string, any>;
    };
}

interface ListPromptsArgs {
    query?: string;
}

interface GetPromptArgs {
    promptId: string;
    variables?: Record<string, string>;
}

interface CreatePromptArgs {
    promptId: string;
    template: string;
    templateFormat?: "mustache" | "f-string";
    templateVariables?: string[];
    description?: string;
    tags?: string[];
    readme?: string;
    isPublic?: boolean;
}

interface UpdatePromptArgs {
    promptId: string;
    template?: string;
    templateFormat?: "mustache" | "f-string";
    templateVariables?: string[];
    description?: string;
    tags?: string[];
    readme?: string;
    isPublic?: boolean;
}

interface DeletePromptArgs {
    promptId: string;
}

class MCPServer {
    private manager: PromptManager;
    private sessions: Map<string, MCPSession> = new Map();

    constructor(apiKey: string) {
        this.manager = new PromptManager(apiKey);
    }

    private getApiKey(): string {
        const apiKey = process.env.LANGSMITH_API_KEY;
        if (!apiKey) {
            throw new Error("Missing LangSmith API key. Set LANGSMITH_API_KEY environment variable.");
        }
        return apiKey;
    }

    private async handleToolsList(): Promise<Tool[]> {
        return [
            {
                name: "list_prompts",
                description: "List private prompts available in LangSmith",
                inputSchema: {
                    type: "object",
                    properties: {
                        query: {
                            type: "string",
                            description: "Filter prompts by repository or owner handle"
                        }
                    }
                }
            },
            {
                name: "get_prompt",
                description: "Render a prompt locally, with optional variables",
                inputSchema: {
                    type: "object",
                    properties: {
                        promptId: {
                            type: "string",
                            description: "Prompt identifier (e.g. org/prompt-name)"
                        },
                        variables: {
                            type: "object",
                            description: "Optional prompt variables as key=value pairs",
                            additionalProperties: { type: "string" }
                        }
                    },
                    required: ["promptId"]
                }
            },
            {
                name: "create_prompt",
                description: "Create a new LangSmith prompt",
                inputSchema: {
                    type: "object",
                    properties: {
                        promptId: {
                            type: "string",
                            description: "Prompt identifier (e.g. org/prompt-name)"
                        },
                        template: {
                            type: "string",
                            description: "Prompt template content"
                        },
                        templateFormat: {
                            type: "string",
                            enum: ["mustache", "f-string"],
                            default: "mustache",
                            description: "Template format"
                        },
                        templateVariables: {
                            type: "array",
                            items: { type: "string" },
                            description: "Template variables"
                        },
                        description: {
                            type: "string",
                            description: "Prompt description"
                        },
                        tags: {
                            type: "array",
                            items: { type: "string" },
                            description: "Metadata tags"
                        },
                        readme: {
                            type: "string",
                            description: "Prompt README content"
                        },
                        isPublic: {
                            type: "boolean",
                            description: "Make the prompt public"
                        }
                    },
                    required: ["promptId", "template"]
                }
            },
            {
                name: "update_prompt",
                description: "Update an existing prompt with new content or metadata",
                inputSchema: {
                    type: "object",
                    properties: {
                        promptId: {
                            type: "string",
                            description: "Prompt identifier to update"
                        },
                        template: {
                            type: "string",
                            description: "Prompt template content"
                        },
                        templateFormat: {
                            type: "string",
                            enum: ["mustache", "f-string"],
                            description: "Template format"
                        },
                        templateVariables: {
                            type: "array",
                            items: { type: "string" },
                            description: "Template variables"
                        },
                        description: {
                            type: "string",
                            description: "Prompt description"
                        },
                        tags: {
                            type: "array",
                            items: { type: "string" },
                            description: "Metadata tags"
                        },
                        readme: {
                            type: "string",
                            description: "Prompt README content"
                        },
                        isPublic: {
                            type: "boolean",
                            description: "Mark the prompt as public or private"
                        }
                    },
                    required: ["promptId"]
                }
            },
            {
                name: "delete_prompt",
                description: "Delete a prompt after confirming it exists",
                inputSchema: {
                    type: "object",
                    properties: {
                        promptId: {
                            type: "string",
                            description: "Prompt identifier to delete"
                        }
                    },
                    required: ["promptId"]
                }
            }
        ];
    }

    private async handleToolCall(name: string, args: any): Promise<any> {
        switch (name) {
            case "list_prompts":
                return await this.manager.listPrompts(args.query);

            case "get_prompt":
                return await this.manager.getPrompt(args.promptId, args.variables || {});

            case "create_prompt":
                return await this.manager.createPrompt(args.promptId, args);

            case "update_prompt":
                return await this.manager.updatePrompt(args.promptId, args);

            case "delete_prompt":
                return await this.manager.deletePrompt(args.promptId);
                return { success: true };

            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    }

    private async handleRequest(request: MCPRequest): Promise<MCPResponse> {
        try {
            switch (request.method) {
                case "tools/list":
                    const tools = await this.handleToolsList();
                    return {
                        jsonrpc: "2.0",
                        id: request.id!,
                        result: { tools }
                    };

                case "tools/call":
                    const callRequest = request as MCPRequest & CallToolRequest;
                    const result = await this.handleToolCall(
                        callRequest.params.name,
                        callRequest.params.arguments
                    );
                    return {
                        jsonrpc: "2.0",
                        id: request.id!,
                        result: [{ type: "text", text: JSON.stringify(result, null, 2) }]
                    };

                default:
                    return {
                        jsonrpc: "2.0",
                        id: request.id!,
                        error: {
                            code: -32601,
                            message: `Method ${request.method} not found`
                        }
                    };
            }
        } catch (error) {
            return {
                jsonrpc: "2.0",
                id: request.id!,
                error: {
                    code: -32603,
                    message: error instanceof Error ? error.message : "Unknown error",
                    data: error
                }
            };
        }
    }

    async handleMessage(message: string): Promise<string> {
        try {
            const request: MCPRequest = JSON.parse(message);
            const response = await this.handleRequest(request);
            return JSON.stringify(response);
        } catch (error) {
            const errorResponse: MCPResponse = {
                jsonrpc: "2.0",
                id: null,
                error: {
                    code: -32700,
                    message: "Parse error",
                    data: error
                }
            };
            return JSON.stringify(errorResponse);
        }
    }

    getCapabilities(): MCPSession["capabilities"] {
        return {
            tools: true,
            resources: false
        };
    }
}

// HTTP server for xmcp
const server = createServer(async (req, res) => {
    const { pathname } = parse(req.url!, true);

    // Set CORS headers for xmcp.dev
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        res.writeHead(200);
        res.end();
        return;
    }

    if (pathname === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok" }));
        return;
    }

    if (pathname === "/mcp") {
        if (req.method !== "POST") {
            res.writeHead(405, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Method not allowed" }));
            return;
        }

        let body = "";
        req.on("data", chunk => body += chunk);
        req.on("end", async () => {
            try {
                const mcpServer = new MCPServer(process.env.LANGSMITH_API_KEY!);
                const response = await mcpServer.handleMessage(body);
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(response);
            } catch (error) {
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({
                    error: error instanceof Error ? error.message : "Internal server error"
                }));
            }
        });
        return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
    console.log(`MCP server listening on port ${port}`);
    console.log(`Health check: http://localhost:${port}/health`);
    console.log(`MCP endpoint: http://localhost:${port}/mcp`);
});