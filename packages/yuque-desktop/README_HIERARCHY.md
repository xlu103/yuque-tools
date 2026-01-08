# 🌳 文档层级功能 - 完整实现

## ⚠️ 重要：如何正确测试

你遇到的问题是因为 **Vite 在开发模式下不会自动重新编译 Electron 主进程代码**。

### 🔧 正确的启动方式

**请使用以下命令彻底重新编译：**

```bash
cd packages/yuque-desktop

# 方法 1：使用脚本（推荐）
./force-rebuild.sh

# 方法 2：手动执行
pkill -f "electron"
rm -rf dist-electron
rm -rf ~/Library/Application\ Support/yuque-desktop/data/yuque-meta.db
npm run electron:dev
```

---

## 📋 已修复的问题

### 1. 数据库迁移逻辑
- ✅ 检查列是否存在再添加
- ✅ 避免 "duplicate column" 错误

### 2. 外键约束问题
- ✅ 确保 `__notes__` book 在数据库中存在
- ✅ 修复 FOREIGN KEY constraint failed 错误

### 3. 爬取逻辑
- ✅ 从数据库获取 book 信息
- ✅ 3 种方法提取 TOC 数据
- ✅ 详细的日志输出

---

## 🎯 验证步骤

### 步骤 1：确认编译成功

启动后，在控制台查找：

```
Initializing database at: ...
Current schema version: 0
Running migrations from version 0 to 5
Migration completed  ← 应该没有错误！
```

**如果还看到 "Migration v5 failed"，说明还在用旧代码！**

### 步骤 2：登录并选择知识库

1. 登录语雀账号
2. 选择一个有多级目录的知识库
3. 打开开发者工具

### 步骤 3：查找关键日志

点击"同步"后，在控制台搜索：

#### 🔍 搜索 "Found book info"

应该看到：
```
[books:getDocs] Found book info: username/book-slug
```

#### 🔍 搜索 "Processing book"

应该看到：
```
[getDocsOfBook] Processing book: username/book-slug
```

#### 🔍 搜索 "Crawling"

**这是最关键的！** 应该看到：
```
[crawlYuqueBookPage] Crawling: https://www.yuque.com/username/book-slug
[crawlYuqueBookPage] Successfully extracted appData (method X)
[crawlYuqueBookPage] Book: 知识库名称, TOC items: XX
```

#### 🔍 搜索 "✅ Got TOC"

如果成功，应该看到：
```
[getDocsOfBook] ✅ Got TOC data with XX items
[getDocsOfBook] ✅ Processed XX documents with hierarchy from TOC
[getDocsOfBook] 📊 Stats: XX with parent, XX folders
```

### 步骤 4：查看树形视图

1. 切换到树形视图（📁 图标）
2. 应该看到层级结构
3. 可以展开/收起文件夹

---

## 🐛 如果还是不行

### 问题：还是看到旧的错误日志

**原因：** Vite 缓存了旧代码

**解决：**
```bash
# 完全停止
pkill -f "electron"
pkill -f "vite"

# 清理所有缓存
rm -rf dist
rm -rf dist-electron  
rm -rf node_modules/.vite
rm -rf ~/Library/Application\ Support/yuque-desktop/data/yuque-meta.db

# 重新启动
npm run electron:dev
```

### 问题：看不到爬取日志

**可能原因：**
1. 代码还是旧的 - 重新编译
2. book 信息没找到 - 检查是否看到 "Found book info"

**调试：**
在控制台搜索 `getDocsOfBook`，看看执行到哪一步了

### 问题：爬取失败

如果看到：
```
[crawlYuqueBookPage] No appData found in page
[getDocsOfBook] ⚠️  Crawling failed, falling back to API method
```

**可能原因：**
1. Cookie 过期 - 重新登录
2. 语雀页面结构变化
3. 网络问题

---

## 📊 成功的完整日志示例

```
Initializing database at: /Users/xxx/Library/Application Support/yuque-desktop/data/yuque-meta.db
Current schema version: 0
Running migrations from version 0 to 5
Migration completed

books:getDocs called for: 37865319
[books:getDocs] Found book info: xlu103/my-book
[getDocsOfBook] Processing book: xlu103/my-book
[crawlYuqueBookPage] Crawling: https://www.yuque.com/xlu103/my-book
[crawlYuqueBookPage] Successfully extracted appData (method 1)
[crawlYuqueBookPage] Book: 我的知识库, TOC items: 50
[getDocsOfBook] ✅ Got TOC data with 50 items
[getDocsOfBook] ✅ Processed 50 documents with hierarchy from TOC
[getDocsOfBook] 📊 Stats: 35 with parent, 5 folders
[books:getDocs] Status summary before upsert: { new: 50 }
Fetched and stored 50 documents for book 37865319
```

---

## 🎉 成功标志

如果看到以下内容，说明功能正常：

1. ✅ 迁移完成，没有错误
2. ✅ 看到 "Found book info" 日志
3. ✅ 看到 "Crawling" 日志
4. ✅ 看到 "Successfully extracted appData" 日志
5. ✅ 看到 "✅ Got TOC data" 日志
6. ✅ 看到 "📊 Stats: XX with parent, XX folders" 日志
7. ✅ 树形视图显示层级结构

---

## 💡 提示

- 使用 `./force-rebuild.sh` 确保完全重新编译
- 在控制台使用 `Cmd+F` 搜索关键词
- 如果日志太多，可以先 `clear()` 清空
- 测试时选择一个简单的、确定有层级的知识库

---

## 📝 下一步

如果测试成功：
- ✅ 层级功能完成
- 可以继续实现知识库分组
- 可以继续实现搜索增强

如果还有问题：
- 提供完整的控制台日志（从启动到同步完成）
- 运行 `node check-hierarchy.js` 并提供输出
- 告诉我测试的知识库信息
