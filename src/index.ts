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
          description: "在远程主机或本地执行命令 (This tool is for remote hosts, not the current machine)",
          inputSchema: {
            type: "object",
            properties: {
              host: {
                type: "string",
                description: "要连接的主机（可选，如果不提供则在本地执行命令）"
              },
              username: {
                type: "string",
                description: "SSH连接的用户名（当指定host时必填）"
              },
              session: {
                type: "string",
                description: "会话名称，默认为 default。相同的session名称，在20分钟内是持久复用一个终端，这样在操作一些需要环境比如conda环境的时候，可以一直在环境中。",
                default: "default"
              },
              command: {
                type: "string",
                description: "要执行的命令。在运行命令前，最好先判断一下系统的类型，比如是mac还是linux等等。"
              },
              env: {
                type: "object",
                description: "环境变量",
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
            `SSH连接错误: ${error.message}。请确保已经设置了SSH免密登录。`
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
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Remote Ops MCP server running on stdio");

    // 处理进程退出
    process.on('SIGINT', async () => {
      await commandExecutor.disconnect();
      process.exit(0);
    });
  } catch (error) {
    console.error("Server error:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
