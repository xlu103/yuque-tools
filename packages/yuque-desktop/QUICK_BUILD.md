# 🚀 快速打包指南

## 第一次打包前的准备

### 1. 准备图标（重要！）
```bash
# 将你的图标文件放到 build/ 目录
# macOS: build/icon.icns
# Windows: build/icon.ico
# Linux: build/icons/*.png

# 如果没有图标，可以暂时注释掉 electron-builder.json 中的 icon 配置
```

### 2. 安装依赖并重建 native 模块
```bash
cd packages/yuque-desktop
npm install
npm run rebuild
```

## 开始打包

### macOS 版本（推荐在 macOS 上打包）
```bash
npm run build:mac
```

### Windows 版本
```bash
npm run build:win
```

### Linux 版本
```bash
npm run build:linux
```

## 打包输出

所有打包文件会输出到 `release/` 目录：
- macOS: `.dmg` 和 `.zip` 文件
- Windows: `.exe` 安装包和便携版
- Linux: `.AppImage`, `.deb`, `.rpm`

## 测试打包后的应用

```bash
# macOS
open release/mac/语雀桌面.app

# 或直接安装 dmg 文件测试
```

## 常见问题

**Q: better-sqlite3 编译失败？**
```bash
npm run rebuild
```

**Q: 打包文件太大？**
检查是否包含了不必要的文件，查看 `electron-builder.json` 的 `files` 配置。

**Q: macOS 提示"无法验证开发者"？**
右键点击应用 → 打开，或在系统设置中允许。

详细文档请查看 `BUILD_CHECKLIST.md`
