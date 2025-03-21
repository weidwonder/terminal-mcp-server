#!/bin/bash

# 进入项目目录并激活conda环境
cd ~/projects/taging_album/ || exit
source /home/weidwonder/softwares/minicoda3/etc/profile.d/conda.sh
conda activate ero_alb

# 拉取最新代码
git pull

# 查找并杀死占用3001端口的进程
pid=$(lsof -t -i:3001)
if [ ! -z "$pid" ]; then
    kill $pid
fi

# 启动项目
nohup ./start_dev.py > /dev/null 2>&1 &

echo "Deployment completed!"