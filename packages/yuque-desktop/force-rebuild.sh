#!/bin/bash

echo "🛑 停止所有 Electron 进程..."
pkill -f "electron" || true
pkill -f "vite" || true
sleep 2

echo ""
echo "🧹 清理构建文件..."
rm -rf dist
rm -rf dist-electron
rm -rf node_modules/.vite

echo ""
echo "🗑️  删除旧数据库..."
rm -rf ~/Library/Application\ Support/yuque-desktop/data/yuque-meta.db
echo "✅ 数据库已删除"

echo ""
echo "🔨 重新编译并启动..."
echo "⏳ 请等待编译完成..."
echo ""

npm run electron:dev
