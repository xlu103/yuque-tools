# 快速测试指南

## 🔧 修复内容

刚刚修复了以下问题：

1. **数据库迁移逻辑** - 修复了列重复添加的问题
2. **爬取逻辑** - 优化了 book 信息的获取方式
3. **日志输出** - 添加了更详细的调试信息

## 🧪 测试步骤

### 步骤 1：清理旧数据库（推荐）

```bash
# 关闭应用后执行
rm -rf ~/Library/Application\ Support/yuque-desktop/data/yuque-meta.db
```

### 步骤 2：启动应用

```bash
cd packages/yuque-desktop
npm run electron:dev
```

### 步骤 3：查看迁移日志

在控制台中应该看到：
```
Initializing database at: ...
Current schema version: 0
Running migrations from version 0 to 5
Migration v5 completed successfully
```

### 步骤 4：登录并同步

1. 登录你的语雀账号
2. 选择一个**有多级目录**的知识库
3. 打开开发者工具（View -> Toggle Developer Tools）
4. 点击"同步"按钮

### 步骤 5：查看关键日志

在控制台中查找以下日志：

**✅ 成功的标志：**
```
[books:getDocs] Found book info: username/book-slug
[getDocsOfBook] Processing book: username/book-slug
[crawlYuqueBookPage] Crawling: https://www.yuque.com/username/book-slug
[crawlYuqueBookPage] Successfully extracted appData (method X)
[crawlYuqueBookPage] Book: 知识库名称, TOC items: XX
[getDocsOfBook] ✅ Got TOC data with XX items
[getDocsOfBook] ✅ Processed XX documents with hierarchy from TOC
[getDocsOfBook] 📊 Stats: XX with parent, XX folders
```

**❌ 失败的标志：**
```
[crawlYuqueBookPage] No appData found in page
[getDocsOfBook] ⚠️  Crawling failed, falling back to API method
```

### 步骤 6：验证层级显示

1. 同步完成后，切换到"树形视图"（工具栏右侧的文件夹图标）
2. 应该看到：
   - 📁 文件夹图标（TITLE 类型）
   - 📄 文档图标
   - 缩进表示层级
   - 可以展开/收起

### 步骤 7：验证数据库

```bash
node check-hierarchy.js
```

应该看到：
```
✅ 版本正确
✅ uuid
✅ parent_uuid
✅ child_uuid
✅ doc_type
✅ depth
✅ sort_order

📈 文档统计:
   总文档数: XXX
   有 UUID: XXX (XX%)
   有父文档: XXX (XX%)
   文件夹数: XX
   子文档数: XX
```

## 🐛 如果还是看不到层级

### 检查点 1：爬取是否成功？

在控制台搜索 `crawlYuqueBookPage`：
- 如果看到 "Successfully extracted appData" - 爬取成功
- 如果看到 "No appData found" - 爬取失败

**爬取失败的可能原因：**
1. 语雀页面结构变化
2. Cookie 过期（重新登录）
3. 网络问题

### 检查点 2：数据是否保存？

运行 `node check-hierarchy.js`，查看：
- "有 UUID" 的百分比
- "有父文档" 的数量
- "文件夹数" 的数量

如果都是 0，说明数据没有正确保存。

### 检查点 3：知识库本身有层级吗？

在语雀网页版查看该知识库：
- 是否有文件夹/目录？
- 是否有多级结构？

有些知识库可能所有文档都在顶层，这是正常的。

## 📊 调试技巧

### 1. 查看完整的 appData

在 `crawlYuqueBookPage` 函数中添加：
```typescript
console.log('[DEBUG] appData:', JSON.stringify(appData, null, 2))
```

### 2. 查看 TOC 结构

在 `flattenToc` 函数中添加：
```typescript
console.log('[DEBUG] TOC item:', JSON.stringify(item, null, 2))
```

### 3. 测试单个知识库

选择一个简单的、确定有层级的知识库进行测试。

## 🎯 预期结果

如果一切正常，你应该看到：

1. ✅ 数据库迁移成功（v5）
2. ✅ 爬取页面成功
3. ✅ TOC 数据提取成功
4. ✅ 文档有 UUID 和 parent_uuid
5. ✅ 树形视图显示层级
6. ✅ 可以展开/收起文件夹

## 📝 反馈

如果测试后还有问题，请提供：

1. 完整的控制台日志（从同步开始到结束）
2. `node check-hierarchy.js` 的输出
3. 测试的知识库信息（是否确实有层级）
4. 截图（如果可能）

我会根据这些信息进一步调试！
