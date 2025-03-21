#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { startSSEServer } from "mcp-proxy";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { SSHManager } from "./ssh.js";

const sshManager = new SSHManager();

// 解析命令行参数
const argv = yargs(hideBin(process.argv))
  .option("sse", {
    alias: "s",
    type: "boolean",
    description: "启用SSE服务器",
    default: false,
  })
  .option("port", {
    alias: "p",
    type: "number",
    description: "SSE服务器端口",
    default: 8080,
  })
  .option("endpoint", {
    alias: "e",
    type: "string",
    description: "SSE服务器端点",
    default: "/sse",
  })
  .option("host", {
    alias: "h",
    type: "string",
    description: "SSE服务器主机",
    default: "localhost",
  })
  .help()
  .parse();

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
          description: "在远程主机上执行命令 (This tool is for remote hosts, not the current machine)",
          inputSchema: {
            type: "object",
            properties: {
              host: {
                type: "string",
                description: "要连接的主机"
              },
              session: {
                type: "string",
                description: "会话名称，默认为 default",
                default: "default"
              },
              command: {
                type: "string",
                description: "要执行的命令"
              },
              env: {
                type: "object",
                description: "环境变量",
                default: {}
              }
            },
            required: ["host", "command"]
          }
        },
        {
          name: "get_system_info",
          description: "获取系统资源使用情况",
          inputSchema: {
            type: "object",
            properties: {
              host: {
                type: "string",
                description: "要连接的主机"
              }
            },
            required: ["host"]
          }
        },
        {
          name: "list_processes",
          description: "列出系统进程",
          inputSchema: {
            type: "object",
            properties: {
              host: {
                type: "string",
                description: "要连接的主机"
              }
            },
            required: ["host"]
          }
        },
        {
          name: "kill_process",
          description: "结束指定进程",
          inputSchema: {
            type: "object",
            properties: {
              host: {
                type: "string",
                description: "要连接的主机"
              },
              pid: {
                type: "number",
                description: "进程ID"
              }
            },
            required: ["host", "pid"]
          }
        }
      ]
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      switch (request.params.name) {
        case "execute_command": {
          const host = String(request.params.arguments?.host);
          if (!host) {
            throw new McpError(ErrorCode.InvalidParams, "Host is required");
          }
          const session = String(request.params.arguments?.session || "default");
          const command = String(request.params.arguments?.command);
          if (!command) {
            throw new McpError(ErrorCode.InvalidParams, "Command is required");
          }
          const env = request.params.arguments?.env || {};

          const result = await sshManager.executeCommand(host, command, env);
          return {
            content: [{
              type: "text",
              text: `Command Output:\nstdout: ${result.stdout}\nstderr: ${result.stderr}`
            }]
          };
        }

        case "get_system_info": {
          const host = String(request.params.arguments?.host);
          if (!host) {
            throw new McpError(ErrorCode.InvalidParams, "Host is required");
          }
          const info = await sshManager.getSystemInfo(host);
          return {
            content: [{
              type: "text",
              text: `System Information:
CPU Usage: ${info.cpuUsage}
Memory Usage: ${info.memoryUsage}
Disk Usage: ${info.diskUsage}`
            }]
          };
        }

        case "list_processes": {
          const host = String(request.params.arguments?.host);
          if (!host) {
            throw new McpError(ErrorCode.InvalidParams, "Host is required");
          }
          const processes = await sshManager.getProcessList(host);
          return {
            content: [{
              type: "text",
              text: processes
            }]
          };
        }

        case "kill_process": {
          const host = String(request.params.arguments?.host);
          if (!host) {
            throw new McpError(ErrorCode.InvalidParams, "Host is required");
          }
          const pid = Number(request.params.arguments?.pid);
          if (isNaN(pid)) {
            throw new McpError(ErrorCode.InvalidParams, "Valid process ID is required");
          }

          const result = await sshManager.killProcess(host, pid);
          return {
            content: [{
              type: "text",
              text: result
            }]
          };
        }

        default:
          throw new McpError(ErrorCode.MethodNotFound, "Unknown tool");
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
    if (argv.sse) {
      // 使用SSE服务器
      const { close } = await startSSEServer({
        port: argv.port,
        endpoint: argv.endpoint,
        host: argv.host,
        createServer: async () => {
          return createServer();
        },
      });

      console.error(`Remote Ops MCP server running on SSE at http://${argv.host}:${argv.port}${argv.endpoint}`);

      // 处理进程退出
      process.on('SIGINT', async () => {
        await sshManager.disconnect();
        await close();
        process.exit(0);
      });
    } else {
      // 使用标准输入输出
      const server = createServer();
      const transport = new StdioServerTransport();
      await server.connect(transport);
      console.error("Remote Ops MCP server running on stdio");

      // 处理进程退出
      process.on('SIGINT', async () => {
        await sshManager.disconnect();
        process.exit(0);
      });
    }
  } catch (error) {
    console.error("Server error:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
