#!/bin/bash

echo "🧹 清理旧的构建文件..."
rm -rf dist-electron

echo "🗑️  删除旧数据库（可选）..."
read -p "是否删除旧数据库？这会清除所有本地数据 (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]
then
    rm -rf ~/Library/Application\ Support/yuque-desktop/data/yuque-meta.db
    echo "✅ 数据库已删除"
else
    echo "⏭️  保留现有数据库"
fi

echo ""
echo "🔨 重新编译并启动..."
npm run electron:dev
