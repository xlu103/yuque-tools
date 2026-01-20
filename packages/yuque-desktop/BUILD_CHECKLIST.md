# 📦 打包前检查清单

## 必须完成的步骤

### 1. 准备图标文件
- [ ] macOS: `build/icon.icns` (512x512 或更大)
- [ ] Windows: `build/icon.ico` (256x256 包含多个尺寸)
- [ ] Linux: `build/icons/` 目录下的 PNG 文件 (16x16 到 512x512)

**快速生成图标工具：**
- 在线工具: https://www.icoconverter.com/
- 命令行: `npm install -g electron-icon-builder`

### 2. 更新版本信息
- [ ] 更新 `package.json` 中的 `version`
- [ ] 更新 `package.json` 中的 `description`
- [ ] 更新 `electron-builder.json` 中的 `copyright`

### 3. 代码质量检查
```bash
# 类型检查
npm run typecheck

# 运行测试
npm run test

# 本地开发测试
npm run dev
```

### 4. 清理和构建
```bash
# 清理旧文件
rm -rf dist dist-electron release node_modules/.cache

# 重新安装依赖（可选，确保依赖完整）
npm install

# 重建 native 模块
npm run rebuild
```

## 打包命令

### macOS (推荐在 macOS 上打包)
```bash
# 方式 1: 使用脚本
./build.sh mac

# 方式 2: 使用 npm
npm run build:mac
```

**输出文件：**
- `release/语雀桌面-1.0.0-arm64.dmg` (Apple Silicon)
- `release/语雀桌面-1.0.0-x64.dmg` (Intel)
- `release/语雀桌面-1.0.0-arm64-mac.zip`
- `release/语雀桌面-1.0.0-x64-mac.zip`

### Windows (可在 macOS/Linux 上交叉编译)
```bash
# 方式 1: 使用脚本
./build.sh win

# 方式 2: 使用 npm
npm run build:win
```

**输出文件：**
- `release/语雀桌面-1.0.0-x64.exe` (安装包)
- `release/语雀桌面-1.0.0-x64.exe.blockmap`
- `release/语雀桌面-1.0.0-x64-portable.exe` (便携版)

### Linux
```bash
# 方式 1: 使用脚本
./build.sh linux

# 方式 2: 使用 npm
npm run build:linux
```

**输出文件：**
- `release/语雀桌面-1.0.0.AppImage`
- `release/语雀桌面-1.0.0.deb`
- `release/语雀桌面-1.0.0.rpm`

### 所有平台
```bash
./build.sh all
# 或
npm run build:all
```

## 常见问题

### 1. better-sqlite3 编译失败
```bash
# 重新编译 native 模块
npm run rebuild

# 或手动编译
./node_modules/.bin/electron-rebuild -f -w better-sqlite3
```

### 2. macOS 签名问题
如果没有开发者证书，在 `electron-builder.json` 中设置：
```json
"mac": {
  "identity": null
}
```

### 3. Windows 打包在 macOS 上失败
需要安装 Wine:
```bash
brew install wine-stable
```

### 4. 打包文件太大
检查 `electron-builder.json` 中的 `files` 配置，确保只包含必要文件：
```json
"files": [
  "dist/**/*",
  "dist-electron/**/*",
  "package.json"
]
```

## 测试打包后的应用

### macOS
```bash
open release/mac/语雀桌面.app
```

### Windows (在 macOS 上)
```bash
# 需要 Wine
wine release/语雀桌面-1.0.0-x64.exe
```

### Linux
```bash
chmod +x release/语雀桌面-1.0.0.AppImage
./release/语雀桌面-1.0.0.AppImage
```

## 发布前最终检查

- [ ] 应用能正常启动
- [ ] 所有功能正常工作
- [ ] 数据库读写正常
- [ ] 文件同步功能正常
- [ ] 搜索功能正常
- [ ] 设置保存正常
- [ ] 应用图标显示正确
- [ ] 应用名称显示正确
- [ ] 版本号正确

## 发布渠道

1. **GitHub Releases**
   - 上传所有平台的安装包
   - 编写 Release Notes
   - 标注版本号

2. **自建服务器**
   - 提供下载链接
   - 配置自动更新服务器

3. **Mac App Store** (需要付费开发者账号)
   - 需要额外配置和审核

4. **Microsoft Store** (需要开发者账号)
   - 需要额外配置和审核

## 自动更新配置 (可选)

在 `electron-builder.json` 中配置：
```json
"publish": {
  "provider": "github",
  "owner": "your-username",
  "repo": "yuque-desktop"
}
```

然后在主进程中添加自动更新逻辑。
