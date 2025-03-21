# remote-ops-server

This file contains information about the remote-ops-server project.

## 功能

该项目是一个 MCP Server，用于控制其他主机。支持通过 stdio 和 SSE 两种方式连接。

## 最新修改

2025-03-21：

*   更新了 @modelcontextprotocol/sdk 版本从 0.6.0 到 1.6.0。
*   添加了 SSE 服务器支持，可以通过 HTTP 远程连接到服务器。
*   添加了命令行参数支持，可以通过 --sse 选项启用 SSE 服务器。
*   添加了 .gitignore 文件，用于 GitHub 仓库。
*   添加了新的 npm 脚本：start 和 start:sse。

2025-03-09：

*   增加了一个参数来指定主机。
*   将 SSH 连接改为持久会话。
*   增加了 SSH 连接超时自动关闭功能（20 分钟无活动自动关闭）。
*   增加了指定会话名称的功能。
*   为 execute_command 工具增加了 env 参数，允许用户手动指定环境变量。

## 使用方法

### 通过 stdio 运行（默认）

```bash
npm start
```

或者

```bash
node build/index.js
```

### 通过 SSE 运行

```bash
npm run start:sse
```

或者

```bash
node build/index.js --sse
```

可以通过以下参数自定义 SSE 服务器：

* `--port`：指定端口号，默认为 8080
* `--endpoint`：指定端点，默认为 /sse
* `--host`：指定主机，默认为 localhost

例如：

```bash
node build/index.js --sse --port 3000 --endpoint /mcp --host 0.0.0.0
```