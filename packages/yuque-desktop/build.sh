#!/bin/bash

# 语雀桌面应用打包脚本
# 使用方法: ./build.sh [mac|win|linux|all]

set -e

echo "🚀 开始打包语雀桌面应用..."

# 清理旧的构建文件
echo "📦 清理旧的构建文件..."
rm -rf dist dist-electron release

# 类型检查
echo "🔍 运行类型检查..."
npm run typecheck

# 构建前端
echo "🏗️  构建前端代码..."
npm run build

# 重建 native 模块
echo "🔧 重建 native 模块..."
npm run rebuild || true

# 根据参数打包
PLATFORM=${1:-mac}

case $PLATFORM in
  mac)
    echo "🍎 打包 macOS 版本..."
    electron-builder --mac --config electron-builder.json
    ;;
  win)
    echo "🪟 打包 Windows 版本..."
    electron-builder --win --config electron-builder.json
    ;;
  linux)
    echo "🐧 打包 Linux 版本..."
    electron-builder --linux --config electron-builder.json
    ;;
  all)
    echo "🌍 打包所有平台版本..."
    electron-builder --mac --win --linux --config electron-builder.json
    ;;
  *)
    echo "❌ 未知平台: $PLATFORM"
    echo "使用方法: ./build.sh [mac|win|linux|all]"
    exit 1
    ;;
esac

echo "✅ 打包完成！"
echo "📁 输出目录: release/"
ls -lh release/
