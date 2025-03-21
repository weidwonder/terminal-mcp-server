# terminal-mcp-server

This file contains information about the terminal-mcp-server project.

## 功能

该项目是一个 MCP Server，用于控制本地或其他主机。支持通过 stdio 和 SSE 两种方式连接。目前只提供 execute_command 功能，用于在本地或远程主机上执行命令。

## 最新修改

2025-03-21（下午2点）：

* 更新了README.md和README_CN.md文件中的仓库克隆路径，从`yourusername`改为`weidwonder`
* 删除了不再使用的`src/scripts/deploy.sh`脚本文件和`src/scripts`目录

2025-03-21（下午）：

* 修复了会话持久化功能的bug，确保在使用相同的session名称再次连接时，能够正确复用现有的终端，而不是创建新的连接或终端。
* 改进了会话检查逻辑，确保只有在会话真正有效时才复用它。
* 添加了更多的会话状态检查，确保在会话断开连接时能够正确重新建立连接。
* 为SSH连接添加了keepalive功能，每分钟发送一次keepalive包，减少连接断开的可能性。
* 改进了本地命令执行的会话管理，确保本地会话也能正确跟踪和清理。
* 添加了更多的日志记录，以便更好地跟踪会话的创建、复用和断开连接。
* 删除了不再使用的`ssh.ts`文件，避免代码混淆。

2025-03-21（上午）：

* 修改了 execute_command 功能，将 host 参数改为可选参数。如果不提供 host，则直接在本地终端执行命令。
* 添加了 username 参数，用于指定 SSH 连接的用户名（当指定 host 时必填）。
* 重构了代码，将 SSHManager 类重命名为 CommandExecutor，并添加了本地命令执行功能。
* 在工具描述中添加了关于系统类型判断的提示。
* 保留了会话持久化功能，无论是本地还是远程命令执行，都可以通过 session 参数指定会话名称，在 20 分钟内持久复用同一个终端。
* 简化了 MCP Server，只保留 execute_command 功能，移除了 get_system_info、list_processes 和 kill_process 功能。
* 更新了 @modelcontextprotocol/sdk 版本从 0.6.0 到 1.6.0。
* 添加了 SSE 服务器支持，可以通过 HTTP 远程连接到服务器。
* 添加了命令行参数支持，可以通过 --sse 选项启用 SSE 服务器。
* 添加了 .gitignore 文件，用于 GitHub 仓库。
* 添加了新的 npm 脚本：start 和 start:sse。

2025-03-09：

* 增加了一个参数来指定主机。
* 将 SSH 连接改为持久会话。
* 增加了 SSH 连接超时自动关闭功能（20 分钟无活动自动关闭）。
* 增加了指定会话名称的功能。
* 为 execute_command 工具增加了 env 参数，允许用户手动指定环境变量。

## 使用方法

```bash
npm start
```

或者

```bash
node build/index.js
```

## execute_command 工具

execute_command 工具用于在本地或远程主机上执行命令。它需要以下参数：

* `command`：要执行的命令（必需）
* `host`：要连接的主机（可选，如果不提供则在本地执行命令）
* `username`：SSH连接的用户名（当指定host时必填）
* `session`：会话名称，默认为 default（可选）。相同的session名称，在20分钟内是持久复用一个终端，这样在操作一些需要环境比如conda环境的时候，可以一直在环境中。
* `env`：环境变量，默认为空对象（可选）

示例（本地执行）：

```json
{
  "command": "ls -la",
  "session": "my-session",
  "env": {
    "NODE_ENV": "production"
  }
}
```

示例（远程执行）：

```json
{
  "host": "example.com",
  "username": "user",
  "command": "ls -la",
  "session": "my-session",
  "env": {
    "NODE_ENV": "production"
  }
}