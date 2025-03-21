#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { CommandExecutor } from "./executor.js";

// 全局日志函数，确保所有日志都通过stderr输出
export const log = {
  debug: (message: string, ...args: any[]) => {
    if (process.env.DEBUG === 'true') {
      console.error(`[DEBUG] ${message}`, ...args);
    }
  },
  info: (message: string, ...args: any[]) => {
    console.error(`[INFO] ${message}`, ...args);
  },
  warn: (message: string, ...args: any[]) => {
    console.error(`[WARN] ${message}`, ...args);
  },
  error: (message: string, ...args: any[]) => {
    console.error(`[ERROR] ${message}`, ...args);
  }
};

const commandExecutor = new CommandExecutor();

// 创建服务器
function createServer() {
  const server = new Server(
    {
      name: "remote-ops-server",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "execute_command",
          description: "Execute commands on remote hosts or locally (This tool can be used for both remote hosts and the current machine)",
          inputSchema: {
            type: "object",
            properties: {
              host: {
                type: "string",
                description: "Host to connect to (optional, if not provided the command will be executed locally)"
              },
              username: {
                type: "string",
                description: "Username for SSH connection (required when host is specified)"
              },
              session: {
                type: "string",
                description: "Session name, defaults to 'default'. The same session name will reuse the same terminal environment for 20 minutes, which is useful for operations requiring specific environments like conda.",
                default: "default"
              },
              command: {
                type: "string",
                description: "Command to execute. Before running commands, it's best to determine the system type (Mac, Linux, etc.)"
              },
              env: {
                type: "object",
                description: "Environment variables",
                default: {}
              }
            },
            required: ["command"]
          }
        }
      ]
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      if (request.params.name !== "execute_command") {
        throw new McpError(ErrorCode.MethodNotFound, "Unknown tool");
      }
      
      const host = request.params.arguments?.host ? String(request.params.arguments.host) : undefined;
      const username = request.params.arguments?.username ? String(request.params.arguments.username) : undefined;
      const session = String(request.params.arguments?.session || "default");
      const command = String(request.params.arguments?.command);
      if (!command) {
        throw new McpError(ErrorCode.InvalidParams, "Command is required");
      }
      const env = request.params.arguments?.env || {};

      // 如果指定了host但没有指定username
      if (host && !username) {
        throw new McpError(ErrorCode.InvalidParams, "Username is required when host is specified");
      }

      try {
        const result = await commandExecutor.executeCommand(command, {
          host,
          username,
          session,
          env: env as Record<string, string>
        });
        
        return {
          content: [{
            type: "text",
            text: `Command Output:\nstdout: ${result.stdout}\nstderr: ${result.stderr}`
          }]
        };
      } catch (error) {
        if (error instanceof Error && error.message.includes('SSH')) {
          throw new McpError(
            ErrorCode.InternalError,
            `SSH connection error: ${error.message}. Please ensure SSH key-based authentication is set up.`
          );
        }
        throw error;
      }
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  return server;
}

async function main() {
  try {
    // 使用标准输入输出
    const server = createServer();
    
    // 设置MCP错误处理程序
    server.onerror = (error) => {
      log.error(`MCP Error: ${error.message}`);
    };
    
    const transport = new StdioServerTransport();
    await server.connect(transport);
    log.info("Remote Ops MCP server running on stdio");

    // 处理进程退出
    process.on('SIGINT', async () => {
      log.info("Shutting down server...");
      await commandExecutor.disconnect();
      process.exit(0);
    });
  } catch (error) {
    log.error("Server error:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  log.error("Server error:", error);
  process.exit(1);
});
