const { createServer } = require('http');
const { parse } = require('url');

// Import the MCP server logic
class PromptManager {
    constructor(apiKey) {
        this.apiKey = apiKey;
        // Simplified manager for server deployment
    }

    async listPrompts(query) {
        // This would call the LangSmith API
        return [];
    }

    async getPrompt(promptId, variables = {}) {
        // This would call the LangSmith API
        return null;
    }

    async createPrompt(promptId, definition) {
        // This would call the LangSmith API
        return `https://smith.langchain.com/prompts/${promptId}`;
    }

    async updatePrompt(promptId, updates) {
        // This would call the LangSmith API
        return `https://smith.langchain.com/prompts/${promptId}`;
    }

    async deletePrompt(promptId) {
        // This would call the LangSmith API
    }
}

class MCPServer {
    constructor(apiKey) {
        this.manager = new PromptManager(apiKey);
    }

    async handleMessage(message) {
        try {
            const request = JSON.parse(message);
            const response = await this.handleRequest(request);
            return JSON.stringify(response);
        } catch (error) {
            return JSON.stringify({
                jsonrpc: "2.0",
                id: null,
                error: {
                    code: -32700,
                    message: "Parse error"
                }
            });
        }
    }

    async handleRequest(request) {
        try {
            switch (request.method) {
                case "tools/list":
                    const tools = [
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
                                        default: "mustache"
                                    },
                                    templateVariables: {
                                        type: "array",
                                        items: { type: "string" }
                                    },
                                    description: {
                                        type: "string",
                                        description: "Prompt description"
                                    },
                                    tags: {
                                        type: "array",
                                        items: { type: "string" }
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
                                        enum: ["mustache", "f-string"]
                                    },
                                    templateVariables: {
                                        type: "array",
                                        items: { type: "string" }
                                    },
                                    description: {
                                        type: "string",
                                        description: "Prompt description"
                                    },
                                    tags: {
                                        type: "array",
                                        items: { type: "string" }
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
                    return {
                        jsonrpc: "2.0",
                        id: request.id,
                        result: { tools }
                    };

                case "tools/call":
                    const result = await this.handleToolCall(
                        request.params.name,
                        request.params.arguments
                    );
                    return {
                        jsonrpc: "2.0",
                        id: request.id,
                        result: [{ type: "text", text: JSON.stringify(result, null, 2) }]
                    };

                default:
                    return {
                        jsonrpc: "2.0",
                        id: request.id,
                        error: {
                            code: -32601,
                            message: `Method ${request.method} not found`
                        }
                    };
            }
        } catch (error) {
            return {
                jsonrpc: "2.0",
                id: request.id,
                error: {
                    code: -32603,
                    message: error.message || "Unknown error"
                }
            };
        }
    }

    async handleToolCall(name, args) {
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
                await this.manager.deletePrompt(args.promptId);
                return { success: true };
            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    }
}

// Vercel API route handler
module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.statusCode = 200;
        res.end();
        return;
    }

    if (req.method === 'GET' && req.url === '/health') {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ status: 'ok' }));
        return;
    }

    if (req.method === 'POST' && req.url === '/mcp') {
        try {
            const body = req.body || '';
            const mcpServer = new MCPServer(process.env.LANGSMITH_API_KEY);
            const response = await mcpServer.handleMessage(body);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(response);
        } catch (error) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
                error: error.message || 'Internal server error'
            }));
        }
        return;
    }

    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Not found' }));
};