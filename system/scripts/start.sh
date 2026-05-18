#!/bin/bash

# 启动脚本
# 默认读取 system/.env，可通过 ENV_FILE 指定其他配置文件

set -e

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV=${NODE_ENV:-development}

cd "$APP_DIR"
echo "Starting application in $ENV mode..."

if [ -n "$ENV_FILE" ]; then
    echo "Using $ENV_FILE configuration"
elif [ -f ".env.$ENV" ]; then
    export ENV_FILE=".env.$ENV"
    echo "Using $ENV_FILE configuration"
elif [ "$ENV" = "production" ] && [ -f ".env.prod" ]; then
    export ENV_FILE=".env.prod"
    echo "Using $ENV_FILE configuration"
elif [ "$ENV" = "development" ] && [ -f ".env.dev" ]; then
    export ENV_FILE=".env.dev"
    echo "Using $ENV_FILE configuration"
else
    export ENV_FILE=".env"
    echo "Using .env configuration"
fi

# 启动应用
npm run start:dev
