# 🚀 开始测试文档层级功能

## ⚠️ 重要：你需要重新编译！

你之前看到的错误是因为 **Vite 不会自动重新编译 Electron 主进程代码**。

## 📝 快速开始（3 步）

### 1️⃣ 停止当前应用

如果应用正在运行，先关闭它（`Ctrl+C` 或关闭窗口）

### 2️⃣ 运行重新编译脚本

```bash
cd packages/yuque-desktop
./force-rebuild.sh
```

这个脚本会：
- 停止所有 Electron 进程
- 清理旧的编译文件
- 删除旧数据库（重新开始）
- 重新编译并启动应用

### 3️⃣ 测试层级功能

1. **登录语雀账号**
2. **选择一个有层级结构的知识库**（比如有多级目录的）
3. **点击"同步"按钮**
4. **查看树形视图**（默认就是树形视图，工具栏右侧有 📁 图标）

---

## ✅ 成功标志

### 在控制台中应该看到：

```
Migration v5 completed successfully  ← 迁移成功！
[crawlYuqueBookPage] Crawling: https://...
[crawlYuqueBookPage] Successfully extracted appData
[getDocsOfBook] ✅ Got TOC data with XX items
[getDocsOfBook] 📊 Stats: XX with parent, XX folders
```

### 在界面中应该看到：

```
📁 第一章
  📄 1.1 节
  📄 1.2 节
  📁 1.3 子章节
    📄 1.3.1 小节
📁 第二章
  📄 2.1 节
```

特征：
- ✅ 文件夹有 📁 图标，可以展开/收起
- ✅ 文档有 📄 图标
- ✅ 有缩进表示层级关系
- ✅ 文件夹名称加粗显示

---

## 🐛 如果还有问题

### 查看控制台日志

打开开发者工具（View -> Toggle Developer Tools），搜索：

- `Migration v5` - 检查迁移是否成功
- `crawlYuqueBookPage` - 检查是否爬取了页面
- `Got TOC data` - 检查是否获取到层级数据

### 运行诊断脚本

```bash
node check-hierarchy.js
```

这会显示数据库中的层级数据。

---

## 💡 提示

- 默认视图已经是树形视图，不需要切换
- 如果某个知识库没有层级，会显示为平铺列表
- 可以点击工具栏的 📋 图标切换到列表视图对比
- 小记（__notes__）没有层级结构，会显示为平铺列表

---

## 🎯 下一步

测试成功后，我们可以继续实现：
1. 知识库分组功能
2. 全文搜索增强
3. 其他你想要的功能

有问题随时告诉我！
