# Remote Operations MCP Server

这是一个用于远程主机操作的MCP服务器,提供了执行命令、获取系统信息等功能。

## 功能特性

1. 远程命令执行 (execute_command)
2. 系统资源监控 (get_system_info)
3. 进程管理 (list_processes, kill_process)

## 远程主机系统特性

### Conda环境管理

1. 环境位置
   - Conda安装路径: `/home/weidwonder/softwares/minicoda3`
   - 环境初始化脚本: `/home/weidwonder/softwares/minicoda3/etc/profile.d/conda.sh`

2. 环境激活
   - 需要先source初始化脚本: `source /home/weidwonder/softwares/minicoda3/etc/profile.d/conda.sh`
   - 然后才能激活环境: `conda activate <env_name>`
   - 在执行命令时需要组合这两个步骤:
     ```bash
     source /home/weidwonder/softwares/minicoda3/etc/profile.d/conda.sh && conda activate <env_name>
     ```

3. 常见问题
   - conda命令未找到: 需要先source初始化脚本
   - 环境激活失败: 检查环境名称是否正确
   - 长时间运行的命令: 建议使用nohup在后台运行

### 项目部署

1. 项目路径
   - 主要项目目录: `/home/weidwonder/projects/taging_album/`
   - 确保在执行命令时使用正确的项目路径

2. 文件权限
   - 使用SSH密钥认证
   - 密钥位置: `~/.ssh/id_rsa`
   - 确保对项目目录有正确的读写权限

3. 系统资源
   - 可以使用get_system_info工具监控资源使用情况
   - CPU使用率、内存使用率和磁盘使用率的实时监控

### 执行命令注意事项

1. 命令超时
   - 默认超时时间为60秒
   - 长时间运行的命令建议使用nohup
   - 使用nohup时记得重定向输出:
     ```bash
     nohup command > output.log 2>&1 &
     ```

2. 环境变量
   - 每个命令都在新的会话中执行
   - 需要显式设置所需的环境变量
   - 多个命令使用 && 连接可以保持环境变量

3. 错误处理
   - 命令执行失败会返回stderr信息
   - 可以通过检查stderr判断命令是否成功
   - 建议在执行关键命令前后进行验证

## 使用示例

1. 激活Conda环境并执行Python脚本
```bash
source /home/weidwonder/softwares/minicoda3/etc/profile.d/conda.sh && conda activate ero_alb && python script.py
```

2. 后台运行长时间任务
```bash
nohup python long_running_script.py > output.log 2>&1 &
```

3. 获取系统信息
```typescript
const result = await use_mcp_tool("remote-ops", "get_system_info", {});
```

4. 执行远程命令
```typescript
const result = await use_mcp_tool("remote-ops", "execute_command", {
  command: "your_command_here"
});
```

## 最佳实践

1. 命令执行
   - 总是使用完整路径
   - 组合多个命令时使用 && 连接
   - 对于长时间运行的命令使用nohup

2. 环境管理
   - 在每次会话开始时初始化conda
   - 使用正确的环境名称
   - 验证环境激活是否成功

3. 错误处理
   - 检查命令的stderr输出
   - 为长时间运行的命令添加日志
   - 使用适当的超时设置

4. 资源监控
   - 定期检查系统资源使用情况
   - 注意磁盘空间使用
   - 监控关键进程的状态
