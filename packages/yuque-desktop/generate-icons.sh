#!/bin/bash

# 图标生成脚本
# 需要 ImageMagick 和 iconutil (macOS)
# 安装: brew install imagemagick

set -e

echo "🎨 开始生成应用图标..."

# 检查 ImageMagick
if ! command -v magick &> /dev/null && ! command -v convert &> /dev/null; then
    echo "❌ 错误: 未找到 ImageMagick"
    echo "请运行: brew install imagemagick"
    exit 1
fi

# 使用 magick 或 convert
if command -v magick &> /dev/null; then
    CONVERT="magick"
else
    CONVERT="convert"
fi

# 检查源文件
if [ ! -f "build/icon-source.png" ] && [ ! -f "build/icon-source.svg" ]; then
    echo "❌ 错误: 找不到源图标文件"
    echo "请将 1024x1024 的 PNG 或 SVG 文件放到 build/icon-source.png 或 build/icon-source.svg"
    exit 1
fi

# 确定源文件
if [ -f "build/icon-source.png" ]; then
    SOURCE="build/icon-source.png"
else
    SOURCE="build/icon-source.svg"
    echo "📝 将 SVG 转换为 PNG..."
    $CONVERT -background none -density 300 "$SOURCE" -resize 1024x1024 build/icon-source.png
    SOURCE="build/icon-source.png"
fi

echo "✅ 使用源文件: $SOURCE"

# 创建临时目录
mkdir -p build/icons
mkdir -p build/icon.iconset

# 生成 macOS 图标集
echo "🍎 生成 macOS 图标..."
$CONVERT "$SOURCE" -resize 16x16 build/icon.iconset/icon_16x16.png
$CONVERT "$SOURCE" -resize 32x32 build/icon.iconset/icon_16x16@2x.png
$CONVERT "$SOURCE" -resize 32x32 build/icon.iconset/icon_32x32.png
$CONVERT "$SOURCE" -resize 64x64 build/icon.iconset/icon_32x32@2x.png
$CONVERT "$SOURCE" -resize 128x128 build/icon.iconset/icon_128x128.png
$CONVERT "$SOURCE" -resize 256x256 build/icon.iconset/icon_128x128@2x.png
$CONVERT "$SOURCE" -resize 256x256 build/icon.iconset/icon_256x256.png
$CONVERT "$SOURCE" -resize 512x512 build/icon.iconset/icon_256x256@2x.png
$CONVERT "$SOURCE" -resize 512x512 build/icon.iconset/icon_512x512.png
$CONVERT "$SOURCE" -resize 1024x1024 build/icon.iconset/icon_512x512@2x.png

# 使用 iconutil 生成 .icns (仅 macOS)
if command -v iconutil &> /dev/null; then
    iconutil -c icns build/icon.iconset -o build/icon.icns
    echo "✅ 生成 icon.icns"
else
    echo "⚠️  警告: iconutil 不可用，跳过 .icns 生成"
    echo "   在 macOS 上运行此脚本以生成 .icns 文件"
fi

# 生成 Windows 图标
echo "🪟 生成 Windows 图标..."
$CONVERT "$SOURCE" \
    \( -clone 0 -resize 16x16 \) \
    \( -clone 0 -resize 32x32 \) \
    \( -clone 0 -resize 48x48 \) \
    \( -clone 0 -resize 64x64 \) \
    \( -clone 0 -resize 128x128 \) \
    \( -clone 0 -resize 256x256 \) \
    -delete 0 build/icon.ico
echo "✅ 生成 icon.ico"

# 生成 Linux 图标
echo "🐧 生成 Linux 图标..."
for size in 16 32 48 64 128 256 512; do
    $CONVERT "$SOURCE" -resize ${size}x${size} build/icons/${size}x${size}.png
    echo "  ✓ ${size}x${size}.png"
done

# 清理临时文件
rm -rf build/icon.iconset

echo ""
echo "🎉 图标生成完成！"
echo ""
echo "生成的文件："
echo "  📁 build/icon.icns (macOS)"
echo "  📁 build/icon.ico (Windows)"
echo "  📁 build/icons/*.png (Linux)"
echo ""
echo "现在可以运行打包命令了："
echo "  npm run build:mac"
