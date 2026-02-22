import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  serverName: string;
}

export interface MCPConnection {
  client: Client;
  transport: StdioClientTransport;
  tools: MCPTool[];
  serverName: string;
}

export async function connectToMCPServer(
  serverName: string,
  command: string,
  args: string[],
  env?: Record<string, string>
): Promise<MCPConnection> {
  const transport = new StdioClientTransport({
    command,
    args,
    env: { ...process.env, ...env } as Record<string, string>,
  });

  const client = new Client({
    name: "pipesecure-agent",
    version: "1.0.0",
  });

  await client.connect(transport);

  const { tools: rawTools } = await client.listTools();
  const tools: MCPTool[] = rawTools.map((t) => ({
    name: t.name,
    description: t.description || "",
    inputSchema: t.inputSchema as Record<string, unknown>,
    serverName,
  }));

  return { client, transport, tools, serverName };
}

export async function callMCPTool(
  connection: MCPConnection,
  toolName: string,
  args: Record<string, unknown>
): Promise<string> {
  const result = await connection.client.callTool({
    name: toolName,
    arguments: args,
  });

  if (result.content && Array.isArray(result.content)) {
    return result.content
      .map((c: { type: string; text?: string }) => (c.type === "text" ? c.text : JSON.stringify(c)))
      .join("\n");
  }

  return JSON.stringify(result);
}

export async function disconnectMCP(connection: MCPConnection): Promise<void> {
  try {
    await connection.transport.close();
  } catch {
    // best effort
  }
}

export async function createSemgrepMCP(repoPath: string): Promise<MCPConnection | null> {
  try {
    return await connectToMCPServer("semgrep", "semgrep", ["mcp"], {
      SEMGREP_SCAN_PATH: repoPath,
    });
  } catch (error) {
    console.warn("[mcp] Failed to start Semgrep MCP:", error);
    return null;
  }
}

export async function createAstGrepMCP(repoPath: string): Promise<MCPConnection | null> {
  try {
    return await connectToMCPServer("ast-grep", "ast-grep-mcp", ["--project-root", repoPath]);
  } catch (error) {
    console.warn("[mcp] Failed to start ast-grep MCP:", error);
    return null;
  }
}
