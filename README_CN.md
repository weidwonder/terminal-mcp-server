# Terminal MCP Server

Terminal MCP Server 是一个基于 Model Context Protocol (MCP) 的服务器，用于在本地或远程主机上执行命令。它提供了一个简单而强大的接口，允许 AI 模型和其他应用程序执行系统命令，无论是在本地机器上还是通过 SSH 在远程主机上。

## 功能特性

- **本地命令执行**：直接在本地机器上执行命令
- **远程命令执行**：通过 SSH 在远程主机上执行命令
- **会话持久化**：支持会话持久化，在指定时间内（默认 20 分钟）复用同一个终端环境
- **环境变量支持**：允许为命令设置自定义环境变量
- **多种连接方式**：支持通过 stdio 和 SSE (Server-Sent Events) 两种方式连接

## 安装

```bash
# 克隆仓库
git clone https://github.com/weidwonder/terminal-mcp-server.git
cd terminal-mcp-server

# 安装依赖
npm install

# 构建项目
npm run build
```

## 使用方法

### 启动服务器

```bash
# 使用 stdio 方式启动服务器（默认模式）
npm start

# 或者直接运行构建后的文件
node build/index.js
```

### 以 SSE 模式启动服务器

SSE (Server-Sent Events) 模式允许您通过 HTTP 远程连接到服务器。

```bash
# 以 SSE 模式启动服务器
npm run start:sse

# 或者直接运行构建后的文件并添加 SSE 标志
node build/index.js --sse
```

您可以使用以下命令行选项自定义 SSE 服务器：

| 选项 | 描述 | 默认值 |
|------|------|--------|
| `--port` 或 `-p` | 监听的端口 | 8080 |
| `--endpoint` 或 `-e` | 端点路径 | /sse |
| `--host` 或 `-h` | 绑定的主机地址 | localhost |

自定义选项示例：

```bash
# 在端口 3000，端点 /mcp，并绑定到所有网络接口上启动 SSE 服务器
node build/index.js --sse --port 3000 --endpoint /mcp --host 0.0.0.0
```

这将启动服务器并在 `http://0.0.0.0:3000/mcp` 监听 SSE 连接。

### 使用 MCP Inspector 测试

```bash
# 启动 MCP Inspector 工具
npm run inspector
```

## execute_command 工具

execute_command 工具是 Terminal MCP Server 提供的核心功能，用于在本地或远程主机上执行命令。

### 参数

| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| command | string | 是 | 要执行的命令 |
| host | string | 否 | 要连接的远程主机。如果不提供，则在本地执行命令 |
| username | string | 当指定 host 时必填 | SSH 连接的用户名 |
| session | string | 否 | 会话名称，默认为 "default"。相同的 session 名称在 20 分钟内会持久复用同一个终端环境 |
| env | object | 否 | 环境变量，默认为空对象 |

### 使用示例

#### 本地执行命令

```json
{
  "command": "ls -la",
  "session": "my-local-session",
  "env": {
    "NODE_ENV": "development"
  }
}
```

#### 远程执行命令

```json
{
  "host": "example.com",
  "username": "user",
  "command": "ls -la",
  "session": "my-remote-session",
  "env": {
    "NODE_ENV": "production"
  }
}
```

## 配置到 AI 助手

### 配置到 Roo Code

1. 打开 VSCode 并安装 Roo Code 扩展
2. 打开 Roo Code 设置文件：`~/Library/Application Support/Code/User/globalStorage/rooveterinaryinc.roo-cline/settings/cline_mcp_settings.json`
3. 添加以下配置：

#### 对于 stdio 模式（本地连接）

```json
{
  "mcpServers": {
    "terminal-mcp": {
      "command": "node",
      "args": ["/path/to/terminal-mcp-server/build/index.js"],
      "env": {}
    }
  }
}
```

#### 对于 SSE 模式（远程连接）

```json
{
  "mcpServers": {
    "terminal-mcp-sse": {
      "url": "http://localhost:8080/sse",
      "headers": {}
    }
  }
}
```

如果您自定义了服务器地址、端口或端点，请将 `localhost:8080/sse` 替换为您的实际配置。

### 配置到 Cline

1. 打开 Cline 设置文件：`~/.cline/config.json`
2. 添加以下配置：

#### 对于 stdio 模式（本地连接）

```json
{
  "mcpServers": {
    "terminal-mcp": {
      "command": "node",
      "args": ["/path/to/terminal-mcp-server/build/index.js"],
      "env": {}
    }
  }
}
```

#### 对于 SSE 模式（远程连接）

```json
{
  "mcpServers": {
    "terminal-mcp-sse": {
      "url": "http://localhost:8080/sse",
      "headers": {}
    }
  }
}
```

### 配置到 Claude Desktop

1. 打开 Claude Desktop 设置文件：`~/Library/Application Support/Claude/claude_desktop_config.json`
2. 添加以下配置：

#### 对于 stdio 模式（本地连接）

```json
{
  "mcpServers": {
    "terminal-mcp": {
      "command": "node",
      "args": ["/path/to/terminal-mcp-server/build/index.js"],
      "env": {}
    }
  }
}
```

#### 对于 SSE 模式（远程连接）

```json
{
  "mcpServers": {
    "terminal-mcp-sse": {
      "url": "http://localhost:8080/sse",
      "headers": {}
    }
  }
}
```

## 最佳实践

### 命令执行

- 在执行命令前，最好先判断系统类型（Mac、Linux 等）
- 使用完整路径以避免路径相关问题
- 对于需要保持环境的命令序列，使用 `&&` 连接多个命令
- 对于长时间运行的命令，考虑使用 `nohup` 或 `screen`/`tmux`

### SSH 连接

- 确保已经设置了 SSH 免密登录（使用密钥认证）
- 如果连接失败，检查密钥文件是否存在（默认路径：`~/.ssh/id_rsa`）
- 确保远程主机的 SSH 服务正在运行

### 会话管理

- 利用 session 参数在相关命令之间保持环境
- 对于需要特定环境的操作，使用相同的 session 名称
- 注意会话会在 20 分钟无活动后自动关闭

### 错误处理

- 命令执行结果会包含 stdout 和 stderr
- 检查 stderr 以确定命令是否成功执行
- 对于复杂操作，添加验证步骤以确保操作成功

## 注意事项

- 远程执行命令时，需要提前设置 SSH 免密登录
- 本地执行命令时，命令将在启动服务器的用户上下文中执行
- 会话超时时间为 20 分钟，超时后会自动断开连接