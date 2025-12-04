#!/bin/bash

# 启动脚本
# 根据NODE_ENV选择对应的环境文件

ENV=${NODE_ENV:-development}

echo "Starting application in $ENV mode..."

# 复制对应的环境文件
if [ "$ENV" = "production" ]; then
    if [ -f ".env.prod" ]; then
        cp .env.prod .env
        echo "Using .env.prod configuration"
    else
        echo "Warning: .env.prod not found, using default .env.dev"
        cp .env.dev .env
    fi
elif [ "$ENV" = "development" ]; then
    cp .env.dev .env
    echo "Using .env.dev configuration"
else
    echo "Unknown environment: $ENV"
    echo "Supported environments: development, production"
    exit 1
fi

# 启动应用
npm run start:dev