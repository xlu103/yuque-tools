# 🎉 打包成功！

## 生成的文件

### macOS 版本

**Apple Silicon (M1/M2/M3/M4):**
- `语雀桌面-1.0.0-arm64.dmg` (108 MB) - 安装包
- `语雀桌面-1.0.0-arm64-mac.zip` (104 MB) - 压缩包

**Intel (x64):**
- `语雀桌面-1.0.0.dmg` (112 MB) - 安装包
- `语雀桌面-1.0.0-mac.zip` (108 MB) - 压缩包

**应用程序:**
- `release/mac-arm64/语雀桌面.app` - Apple Silicon 版本
- `release/mac/语雀桌面.app` - Intel 版本

## 安装和使用

### 方式 1: 直接运行 (开发测试)
```bash
open release/mac-arm64/语雀桌面.app
```

### 方式 2: 安装 DMG
1. 双击 `语雀桌面-1.0.0-arm64.dmg`
2. 将应用拖到 Applications 文件夹
3. 从启动台或 Applications 文件夹打开

### 方式 3: 解压 ZIP
1. 解压 `语雀桌面-1.0.0-arm64-mac.zip`
2. 将 `语雀桌面.app` 移动到 Applications 文件夹
3. 打开应用

## 首次运行

### macOS 安全提示
如果遇到"无法验证开发者"的提示：

**方法 1: 右键打开**
1. 右键点击应用
2. 选择"打开"
3. 点击"打开"确认

**方法 2: 系统设置**
1. 打开"系统设置" → "隐私与安全性"
2. 找到被阻止的应用
3. 点击"仍要打开"

## 应用功能

✅ 语雀知识库同步
✅ 本地文档预览
✅ 全文搜索
✅ 小记管理
✅ 文档树导航
✅ 阅读历史
✅ 自动同步

## 分发方式

### 1. 本地分享
直接分享 DMG 或 ZIP 文件给其他用户

### 2. GitHub Releases
1. 创建新的 Release
2. 上传所有安装包
3. 编写 Release Notes

### 3. 自建下载服务器
将文件上传到服务器，提供下载链接

## 下次打包

```bash
cd packages/yuque-desktop

# 更新版本号
# 编辑 package.json 中的 version

# 打包
npm run build:mac

# 或使用脚本
./build.sh mac
```

## 文件说明

- `.dmg` - macOS 磁盘镜像，双击安装
- `.zip` - 压缩包，解压即用
- `.blockmap` - 增量更新文件（用于自动更新）
- `builder-debug.yml` - 构建调试信息

## 技术细节

- **Electron 版本**: 33.4.11
- **应用大小**: ~108 MB (压缩后)
- **支持系统**: macOS 10.12+
- **架构**: x64 (Intel) + arm64 (Apple Silicon)
- **代码签名**: 未签名（开发版本）

## 生产发布建议

### 1. 代码签名
获取 Apple Developer 证书并签名应用：
- 提升用户信任度
- 避免安全警告
- 支持 Gatekeeper

### 2. 公证 (Notarization)
通过 Apple 公证服务：
- 必需用于 macOS 10.15+
- 提供更好的安全性
- 避免首次运行警告

### 3. 自动更新
配置 electron-updater：
- 自动检查更新
- 后台下载
- 一键升级

## 问题排查

### 应用无法打开
- 检查系统版本 (需要 macOS 10.12+)
- 尝试右键打开
- 查看系统日志

### 功能异常
- 清除应用数据: `~/Library/Application Support/yuque-desktop`
- 重新安装应用
- 查看控制台日志

## 下一步

- [ ] 测试所有功能
- [ ] 收集用户反馈
- [ ] 准备发布说明
- [ ] 上传到分发渠道
- [ ] 配置自动更新（可选）

---

**打包时间**: 2025-01-20
**版本**: 1.0.0
**状态**: ✅ 成功
