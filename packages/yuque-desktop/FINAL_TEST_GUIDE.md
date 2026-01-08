# 🎯 最终测试指南 - 文档层级功能

## ⚠️ 重要提示

**你刚才看到的错误是因为运行的是旧代码！**

Vite 在开发模式下会编译 Electron 主进程代码到 `dist-electron/main.js`，但如果代码已经编译过，它不会自动重新编译。

## 🔧 正确的测试步骤

### 步骤 1：停止当前运行的应用

按 `Ctrl+C` 或关闭应用窗口

### 步骤 2：清理旧的编译文件

```bash
cd packages/yuque-desktop
rm -rf dist-electron
```

### 步骤 3：删除旧数据库（推荐）

```bash
rm -rf ~/Library/Application\ Support/yuque-desktop/data/yuque-meta.db
```

### 步骤 4：重新启动开发服务器

```bash
npm run electron:dev
```

**或者使用快捷脚本：**

```bash
./restart-dev.sh
```

---

## 📊 验证编译是否成功

启动后，在控制台中查找以下日志：

### ✅ 正确的迁移日志

```
Initializing database at: ...
Current schema version: 0
Running migrations from version 0 to 5
Running migration to v5: adding document hierarchy fields
Migration v5 completed successfully  ← 这个很重要！
Migration completed
```

### ❌ 错误的迁移日志（旧代码）

```
Migration v5 failed: SqliteError: duplicate column name: uuid
```

如果看到错误，说明还在运行旧代码，需要重新执行步骤 2-4。

---

## 🧪 测试爬取功能

### 步骤 1：登录并选择知识库

1. 登录你的语雀账号
2. 等待知识库列表加载
3. 选择一个**确定有多级目录**的知识库

### 步骤 2：打开开发者工具

View -> Toggle Developer Tools

### 步骤 3：点击同步

点击工具栏的"同步"按钮

### 步骤 4：查看关键日志

在控制台中搜索以下关键词：

#### 🔍 搜索 "books:getDocs"

应该看到：
```
books:getDocs called for: 37865319
[books:getDocs] Found book info: username/book-slug  ← 新增的日志
```

#### 🔍 搜索 "getDocsOfBook"

应该看到：
```
[getDocsOfBook] Processing book: username/book-slug  ← 新增的日志
```

#### 🔍 搜索 "crawlYuqueBookPage"

**这是最关键的！** 应该看到：

```
[crawlYuqueBookPage] Crawling: https://www.yuque.com/username/book-slug
[crawlYuqueBookPage] Successfully extracted appData (method 1/2/3)
[crawlYuqueBookPage] Book: 知识库名称, TOC items: XX
```

#### 🔍 搜索 "✅ Got TOC"

如果爬取成功，应该看到：
```
[getDocsOfBook] ✅ Got TOC data with XX items
[getDocsOfBook] ✅ Processed XX documents with hierarchy from TOC
[getDocsOfBook] 📊 Stats: XX with parent, XX folders
```

---

## 🌳 验证层级显示

### 步骤 1：切换到树形视图

点击工具栏右侧的 📁 图标（树形视图）

### 步骤 2：检查显示效果

应该看到：

```
📁 第一章
  📄 1.1 节
  📄 1.2 节
  📁 1.3 子章节
    📄 1.3.1 小节
📁 第二章
  📄 2.1 节
📄 独立文档
```

特征：
- ✅ 文件夹有 📁 图标
- ✅ 文档有 📄 图标
- ✅ 有缩进表示层级
- ✅ 可以点击箭头展开/收起
- ✅ 文件夹名称加粗

### 步骤 3：对比列表视图

切换到列表视图（📋 图标），应该看到所有文档平铺显示，没有层级。

---

## 🐛 故障排查

### 问题 1：还是看不到爬取日志

**原因：** 还在运行旧代码

**解决：**
1. 完全关闭应用
2. 删除 `dist-electron` 目录
3. 重新运行 `npm run electron:dev`

### 问题 2：看到 "Crawling failed"

**可能原因：**
1. Cookie 过期 - 重新登录
2. 网络问题 - 检查网络连接
3. 语雀页面结构变化 - 需要更新爬取逻辑

**调试方法：**
在浏览器中手动访问：`https://www.yuque.com/your-username/your-book-slug`
看是否能正常访问

### 问题 3：爬取成功但没有层级

**检查：**
1. 运行 `node check-hierarchy.js` 查看数据库
2. 确认知识库在语雀网页版确实有层级结构
3. 查看 `[getDocsOfBook] 📊 Stats` 日志，确认有 "with parent" 和 "folders"

### 问题 4：数据库迁移失败

**解决：**
```bash
# 删除数据库重新开始
rm -rf ~/Library/Application\ Support/yuque-desktop/data/yuque-meta.db

# 重新启动
npm run electron:dev
```

---

## 📝 成功的完整日志示例

```
Initializing database at: /Users/xxx/Library/Application Support/yuque-desktop/data/yuque-meta.db
Current schema version: 0
Running migrations from version 0 to 5
Migration v5 completed successfully
Migration completed

books:getDocs called for: 37865319
[books:getDocs] Found book info: luxu/my-book
[getDocsOfBook] Processing book: luxu/my-book
[crawlYuqueBookPage] Crawling: https://www.yuque.com/luxu/my-book
[crawlYuqueBookPage] Successfully extracted appData (method 1)
[crawlYuqueBookPage] Book: 我的知识库, TOC items: 50
[getDocsOfBook] ✅ Got TOC data with 50 items
[getDocsOfBook] ✅ Processed 50 documents with hierarchy from TOC
[getDocsOfBook] 📊 Stats: 35 with parent, 5 folders
Fetched and stored 50 documents for book 37865319
```

---

## 🎯 下一步

如果测试成功：
1. ✅ 层级功能完成
2. 可以继续实现知识库分组功能
3. 可以继续实现搜索增强功能

如果测试失败：
1. 提供完整的控制台日志
2. 运行 `node check-hierarchy.js` 并提供输出
3. 告诉我测试的知识库是否确实有层级结构

---

## 💡 提示

- 使用 `Cmd+F` 在控制台中搜索关键词
- 可以在控制台中输入 `clear()` 清空日志
- 如果日志太多，可以在 Console 设置中启用 "Preserve log"
