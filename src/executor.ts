import { Client } from 'ssh2';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';

export class CommandExecutor {
  private sessions: Map<string, {
    client: Client | null;
    connection: Promise<void> | null;
    timeout: NodeJS.Timeout | null;
    host?: string;
    env?: Record<string, string>; // 添加环境变量存储
    shell?: any; // 添加shell会话
    shellReady?: boolean; // shell是否准备好
  }> = new Map();
  
  private sessionTimeout: number = 20 * 60 * 1000; // 20 minutes

  constructor() {}

  private getSessionKey(host: string | undefined, sessionName: string): string {
    return `${host || 'local'}-${sessionName}`;
  }

  async connect(host: string, username: string, sessionName: string = 'default'): Promise<void> {
    const sessionKey = this.getSessionKey(host, sessionName);
    const session = this.sessions.get(sessionKey);
    
    // 如果会话存在且连接有效，直接返回现有连接
    if (session?.connection && session?.client) {
      // 检查客户端是否仍然连接
      if (session.client.listenerCount('ready') > 0 || session.client.listenerCount('data') > 0) {
        console.log(`复用现有会话: ${sessionKey}`);
        return session.connection;
      }
      // 如果客户端已断开连接，清理旧会话
      console.log(`会话 ${sessionKey} 已断开连接，创建新会话`);
      this.sessions.delete(sessionKey);
    }

    try {
      const privateKey = fs.readFileSync(path.join(os.homedir(), '.ssh', 'id_rsa'));

      const client = new Client();
      const connection = new Promise<void>((resolve, reject) => {
        client
          .on('ready', () => {
            console.log(`会话 ${sessionKey} 已连接`);
            this.resetTimeout(sessionKey);
            
            // 创建一个交互式shell
            client.shell((err, stream) => {
              if (err) {
                console.error(`创建交互式shell失败: ${err.message}`);
                reject(err);
                return;
              }
              
              console.log(`为会话 ${sessionKey} 创建交互式shell`);
              
              // 获取会话对象
              const sessionData = this.sessions.get(sessionKey);
              if (sessionData) {
                // 设置shell和shellReady标志
                sessionData.shell = stream;
                sessionData.shellReady = true;
                
                // 更新会话
                this.sessions.set(sessionKey, sessionData);
              }
              
              // 处理shell关闭事件
              stream.on('close', () => {
                console.log(`会话 ${sessionKey} 的交互式shell已关闭`);
                const sessionData = this.sessions.get(sessionKey);
                if (sessionData) {
                  sessionData.shellReady = false;
                  this.sessions.set(sessionKey, sessionData);
                }
              });
              
              // 等待shell准备好
              stream.write('echo "Shell ready"\n');
              
              // 解析promise
              resolve();
            });
          })
          .on('error', (err) => {
            console.error(`会话 ${sessionKey} 连接错误:`, err.message);
            reject(err);
          })
          .connect({
            host: host,
            username: username,
            privateKey: privateKey,
            keepaliveInterval: 60000, // 每分钟发送一次keepalive包
          });
      });

      console.log(`创建新会话: ${sessionKey}`);
      this.sessions.set(sessionKey, {
        client,
        connection,
        timeout: null,
        host,
        shell: null,
        shellReady: false
      });

      return connection;
    } catch (error) {
      if (error instanceof Error && error.message.includes('ENOENT')) {
        throw new Error('SSH密钥文件不存在，请确保已经设置了SSH免密登录');
      }
      throw error;
    }
  }

  private resetTimeout(sessionKey: string): void {
    const session = this.sessions.get(sessionKey);
    if (!session) return;

    if (session.timeout) {
      clearTimeout(session.timeout);
    }

    session.timeout = setTimeout(async () => {
      console.log(`Session ${sessionKey} timeout, disconnecting`);
      await this.disconnectSession(sessionKey);
    }, this.sessionTimeout);

    this.sessions.set(sessionKey, session);
  }

  async executeCommand(
    command: string,
    options: {
      host?: string;
      username?: string;
      session?: string;
      env?: Record<string, string>;
    } = {}
  ): Promise<{stdout: string; stderr: string}> {
    const { host, username, session = 'default', env = {} } = options;
    const sessionKey = this.getSessionKey(host, session);

    // 如果指定了host，则使用SSH执行命令
    if (host) {
      if (!username) {
        throw new Error('使用SSH时，username是必需的');
      }
      
      let sessionData = this.sessions.get(sessionKey);
      
      // 检查会话是否存在且有效
      let needNewConnection = false;
      if (!sessionData || sessionData.host !== host) {
        needNewConnection = true;
      } else if (sessionData.client) {
        // 检查客户端是否仍然连接
        if (sessionData.client.listenerCount('ready') === 0 && sessionData.client.listenerCount('data') === 0) {
          console.log(`会话 ${sessionKey} 已断开连接，重新连接`);
          needNewConnection = true;
        }
      } else {
        needNewConnection = true;
      }
      
      // 如果需要新连接，则创建
      if (needNewConnection) {
        console.log(`为命令执行创建新连接: ${sessionKey}`);
        await this.connect(host, username, session);
        sessionData = this.sessions.get(sessionKey);
      } else {
        console.log(`复用现有会话执行命令: ${sessionKey}`);
      }
      
      if (!sessionData || !sessionData.client) {
        throw new Error(`无法创建到 ${host} 的SSH会话`);
      }
      
      this.resetTimeout(sessionKey);

      // 检查是否有交互式shell可用
      if (sessionData.shellReady && sessionData.shell) {
        console.log(`使用交互式shell执行命令: ${command}`);
        return new Promise((resolve, reject) => {
          let stdout = "";
          let stderr = "";
          let commandFinished = false;
          const uniqueMarker = `CMD_END_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
          
          // 构建环境变量设置命令
          const envSetup = Object.entries(env)
            .map(([key, value]) => `export ${key}="${String(value).replace(/"/g, '\\"')}"`)
            .join(' && ');
          
          // 如果有环境变量，先设置环境变量，再执行命令
          const fullCommand = envSetup ? `${envSetup} && ${command}` : command;
          
          // 添加数据处理器
          const dataHandler = (data: Buffer) => {
            const str = data.toString();
            console.log(`Shell数据: ${str}`);
            
            if (str.includes(uniqueMarker)) {
              // 命令执行完成
              commandFinished = true;
              
              // 提取命令输出（从命令开始到标记之前的内容）
              const lines = stdout.split('\n');
              let commandOutput = '';
              let foundCommand = false;
              
              for (const line of lines) {
                if (foundCommand) {
                  if (line.includes(uniqueMarker)) {
                    break;
                  }
                  commandOutput += line + '\n';
                } else if (line.includes(fullCommand)) {
                  foundCommand = true;
                }
              }
              
              // 解析输出
              resolve({ stdout: commandOutput.trim(), stderr });
              
              // 移除处理器
              sessionData.shell.removeListener('data', dataHandler);
              clearTimeout(timeout);
            } else if (!commandFinished) {
              stdout += str;
            }
          };
          
          // 添加错误处理器
          const errorHandler = (err: Error) => {
            stderr += err.message;
            reject(err);
            sessionData.shell.removeListener('data', dataHandler);
            sessionData.shell.removeListener('error', errorHandler);
          };
          
          // 监听数据和错误
          sessionData.shell.on('data', dataHandler);
          sessionData.shell.on('error', errorHandler);
          
          // 执行命令并添加唯一标记
          // 使用一个更明确的方式来执行命令和捕获输出
          sessionData.shell.write(`echo "开始执行命令: ${fullCommand}"\n`);
          sessionData.shell.write(`${fullCommand}\n`);
          sessionData.shell.write(`echo "${uniqueMarker}"\n`);
          
          // 设置超时
          const timeout = setTimeout(() => {
            if (!commandFinished) {
              stderr += "Command execution timed out";
              resolve({ stdout, stderr });
              sessionData.shell.removeListener('data', dataHandler);
              sessionData.shell.removeListener('error', errorHandler);
            }
          }, 30000); // 30秒超时
        });
      } else {
        console.log(`使用exec执行命令: ${command}`);
        return new Promise((resolve, reject) => {
          // 构建环境变量设置命令
          const envSetup = Object.entries(env)
            .map(([key, value]) => `export ${key}="${String(value).replace(/"/g, '\\"')}"`)
            .join(' && ');
          
          // 如果有环境变量，先设置环境变量，再执行命令
          const fullCommand = envSetup ? `${envSetup} && ${command}` : command;
          
          sessionData?.client?.exec(`/bin/bash --login -c "${fullCommand.replace(/"/g, '\\"')}"`, (err, stream) => {
            if (err) {
              reject(err);
              return;
            }

            let stdout = "";
            let stderr = '';

            stream
              .on("data", (data: Buffer) => {
                this.resetTimeout(sessionKey);
                stdout += data.toString();
              })
              .stderr.on('data', (data: Buffer) => {
                stderr += data.toString();
              })
              .on('close', () => {
                resolve({ stdout, stderr });
              })
              .on('error', (err) => {
                reject(err);
              });
          });
        });
      }
    } 
    // 否则在本地执行命令
    else {
      // 在本地执行命令时，也使用会话机制来保持环境变量
      console.log(`使用本地会话执行命令: ${sessionKey}`);
      
      // 检查是否已有本地会话
      let sessionData = this.sessions.get(sessionKey);
      let sessionEnv = {};
      
      if (!sessionData) {
        // 为本地会话创建一个空条目，以便跟踪超时
        sessionData = {
          client: null,
          connection: null,
          timeout: null,
          host: undefined,
          env: { ...env } // 保存初始环境变量
        };
        this.sessions.set(sessionKey, sessionData);
        console.log(`创建新的本地会话: ${sessionKey}`);
        sessionEnv = env;
      } else {
        console.log(`复用现有本地会话: ${sessionKey}`);
        // 合并现有会话环境变量和新的环境变量
        if (!sessionData.env) {
          sessionData.env = {};
        }
        sessionData.env = { ...sessionData.env, ...env };
        sessionEnv = sessionData.env;
        // 更新会话
        this.sessions.set(sessionKey, sessionData);
      }
      
      this.resetTimeout(sessionKey);
      
      return new Promise((resolve, reject) => {
        // 构建环境变量，优先级：系统环境变量 < 会话环境变量 < 当前命令环境变量
        const envVars = { ...process.env, ...sessionEnv };
        
        // 执行命令
        console.log(`执行本地命令: ${command}`);
        exec(command, { env: envVars }, (error, stdout, stderr) => {
          if (error && error.code !== 0) {
            // 我们不直接拒绝，而是返回错误信息作为stderr
            resolve({ stdout, stderr: stderr || error.message });
          } else {
            resolve({ stdout, stderr });
          }
        });
      });
    }
  }

  private async disconnectSession(sessionKey: string): Promise<void> {
    const session = this.sessions.get(sessionKey);
    if (session) {
      if (session.shell) {
        console.log(`关闭会话 ${sessionKey} 的交互式shell`);
        session.shell.end();
        session.shellReady = false;
      }
      if (session.client) {
        console.log(`断开会话 ${sessionKey} 的SSH连接`);
        session.client.end();
      }
      if (session.timeout) {
        clearTimeout(session.timeout);
      }
      console.log(`断开会话连接: ${sessionKey}`);
      this.sessions.delete(sessionKey);
    }
  }

  async disconnect(): Promise<void> {
    const disconnectPromises = Array.from(this.sessions.keys()).map(
      sessionKey => this.disconnectSession(sessionKey)
    );
    
    await Promise.all(disconnectPromises);
    this.sessions.clear();
  }
}