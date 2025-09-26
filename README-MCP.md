# Prompto MCP Server

This is a Model Context Protocol (MCP) server implementation of the Prompto CLI tool, designed to work with xmcp.dev and deployable on Vercel.

## Features

The MCP server exposes the following tools:

- **list_prompts**: List private prompts available in LangSmith
- **get_prompt**: Render a prompt locally with optional variables
- **create_prompt**: Create a new LangSmith prompt
- **update_prompt**: Update an existing prompt with new content or metadata
- **delete_prompt**: Delete a prompt after confirming it exists

## Local Development

### Prerequisites

1. Node.js 18+ or Bun
2. LangSmith API key

### Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set your LangSmith API key:
   ```bash
   export LANGSMITH_API_KEY="your-api-key-here"
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

The server will start on http://localhost:3000

### Testing the MCP Server

You can test the MCP server using curl:

```bash
# Health check
curl http://localhost:3000/health

# List tools
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}'

# Call a tool
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {"name": "list_prompts"}}'
```

## Vercel Deployment

### Prerequisites

1. Vercel CLI installed: `npm i -g vercel`
2. LangSmith API key configured in Vercel

### Deploy Steps

1. **Build the project:**
   ```bash
   npm run build:server
   ```

2. **Deploy to Vercel:**
   ```bash
   vercel
   ```

3. **Set environment variables in Vercel:**
   - Go to your project settings in Vercel dashboard
   - Add `LANGSMITH_API_KEY` with your LangSmith API key

4. **Update the llms.txt file:**
   - Replace `your-domain.vercel.app` with your actual Vercel domain
   - The MCP endpoint will be at: `https://your-domain.vercel.app/mcp`

### Production URLs

After deployment:
- Health check: `https://your-domain.vercel.app/health`
- MCP endpoint: `https://your-domain.vercel.app/mcp`
- xmcp.dev discovery: The `llms.txt` file should be accessible at the root of your domain

## Integration with xmcp.dev

1. Deploy your server to Vercel
2. Update the `llms.txt` file with your production domain
3. The server will automatically be discoverable by xmcp.dev clients
4. Users can connect to your MCP server through the xmcp.dev interface

## Configuration

### Environment Variables

- `LANGSMITH_API_KEY`: Your LangSmith API key (required)
- `PORT`: Port for local development (default: 3000)

### llms.txt Format

The `llms.txt` file follows the xmcp.dev specification and includes:
- Server metadata (name, description, URL)
- Tool definitions with schemas
- Environment variable requirements
- Usage examples

## Security Considerations

- The MCP server requires a valid LangSmith API key
- Consider implementing rate limiting for production use
- Monitor API usage to prevent abuse
- Use HTTPS in production (automatically handled by Vercel)

## Troubleshooting

### Common Issues

1. **"Missing LangSmith API key"**: Ensure `LANGSMITH_API_KEY` is set in your environment
2. **Build failures**: Make sure all dependencies are installed and TypeScript is configured correctly
3. **CORS errors**: The server includes CORS headers, but check your client implementation
4. **Vercel deployment issues**: Verify the `vercel.json` configuration matches your project structure

### Debug Mode

For detailed logging, you can modify the MCP server to include debug information:

```typescript
console.log('MCP Request:', message);
console.log('MCP Response:', response);
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the same terms as the original Prompto CLI tool.