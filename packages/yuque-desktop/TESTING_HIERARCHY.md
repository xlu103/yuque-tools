# 测试文档层级功能

## 问题诊断

如果你看不到文档的层级结构，可能是以下原因：

### 1. 数据库迁移问题

检查数据库是否成功迁移到 v5：

```bash
# 查看应用日志，应该看到类似的输出：
# "Current schema version: 4"
# "Running migration to v5: adding document hierarchy fields"
# "Migration completed"
```

### 2. 文档未重新同步

现有的文档数据不包含层级信息，需要重新同步：

**步骤：**
1. 打开应用
2. 选择一个知识库
3. 点击"强制同步"按钮（这会重新下载所有文档）
4. 等待同步完成
5. 切换到"树形视图"查看

### 3. 检查控制台日志

打开开发者工具（View -> Toggle Developer Tools），查看控制台输出：

**应该看到的日志：**
```
[getDocsOfBook] Found book: 知识库名称 (user/slug)
[crawlYuqueBookPage] Crawling: https://www.yuque.com/user/slug
[crawlYuqueBookPage] Successfully extracted appData (method X)
[crawlYuqueBookPage] Book: 知识库名称, TOC items: XX
[getDocsOfBook] Using TOC data from crawled page
[getDocsOfBook] Processed XX documents with hierarchy from TOC
```

**如果看到错误：**
```
[crawlYuqueBookPage] No appData found in page
[getDocsOfBook] Falling back to API method
```

这说明爬取页面失败，可能的原因：
- 语雀页面结构变化
- Cookie 过期
- 网络问题

### 4. 检查数据库内容

可以使用 SQLite 工具查看数据库：

```bash
# 数据库位置（macOS）
~/.config/yuque-desktop/data/yuque-meta.db

# 或者（根据系统）
~/Library/Application Support/yuque-desktop/data/yuque-meta.db
```

**检查 SQL：**
```sql
-- 查看 schema 版本
SELECT * FROM schema_version;

-- 查看文档表结构
PRAGMA table_info(documents);

-- 查看有层级信息的文档
SELECT id, title, uuid, parent_uuid, doc_type, depth 
FROM documents 
WHERE parent_uuid IS NOT NULL 
LIMIT 10;

-- 统计有层级信息的文档数量
SELECT 
  COUNT(*) as total,
  COUNT(uuid) as with_uuid,
  COUNT(parent_uuid) as with_parent,
  COUNT(CASE WHEN doc_type = 'TITLE' THEN 1 END) as folders
FROM documents;
```

## 手动测试步骤

### 步骤 1：清理并重新开始

```bash
# 1. 关闭应用
# 2. 删除数据库（可选，会丢失所有本地数据）
rm -rf ~/.config/yuque-desktop/data/yuque-meta.db

# 3. 重新启动应用
cd packages/yuque-desktop
npm run electron:dev
```

### 步骤 2：登录并同步

1. 使用你的语雀账号登录
2. 等待知识库列表加载
3. 选择一个**包含多级目录**的知识库
4. 点击"同步"按钮

### 步骤 3：查看层级

1. 同步完成后，确保选中"树形视图"（工具栏右侧的文件夹图标）
2. 应该看到：
   - 📁 文件夹图标表示目录（TITLE 类型）
   - 📄 文档图标表示普通文档
   - 缩进表示层级关系
   - 箭头可以展开/收起子文档

### 步骤 4：对比列表视图

1. 切换到"列表视图"（工具栏右侧的列表图标）
2. 应该看到所有文档平铺显示
3. 再切换回"树形视图"验证

## 调试技巧

### 1. 启用详细日志

在 `electron/services/books.ts` 中，所有关键步骤都有日志输出。

### 2. 测试爬取功能

可以单独测试爬取功能：

```typescript
// 在浏览器控制台或 Node.js 中测试
const axios = require('axios');

async function testCrawl() {
  const response = await axios.get('https://www.yuque.com/your-user/your-book');
  const html = response.data;
  
  // 方法 1：查找 decodeURIComponent
  const match1 = html.match(/decodeURIComponent\("(.+?)"\)\);/);
  if (match1) {
    const decoded = decodeURIComponent(match1[1]);
    const data = JSON.parse(decoded);
    console.log('TOC items:', data.book.toc.length);
  }
  
  // 方法 2：查找 window.appData
  const match2 = html.match(/window\.appData\s*=\s*({.+?});/s);
  if (match2) {
    const data = JSON.parse(match2[1]);
    console.log('TOC items:', data.book.toc.length);
  }
}

testCrawl();
```

### 3. 检查 TOC 数据结构

TOC 数据应该类似这样：

```json
{
  "book": {
    "name": "知识库名称",
    "toc": [
      {
        "uuid": "abc123",
        "title": "第一章",
        "type": "TITLE",
        "url": "chapter-1",
        "parent_uuid": null,
        "child_uuid": "def456",
        "depth": 0,
        "children": [
          {
            "uuid": "def456",
            "title": "1.1 节",
            "type": "DOC",
            "url": "section-1-1",
            "parent_uuid": "abc123",
            "depth": 1
          }
        ]
      }
    ]
  }
}
```

## 常见问题

### Q: 为什么有些知识库显示层级，有些不显示？

A: 可能的原因：
1. 该知识库本身没有层级结构（所有文档都在顶层）
2. 爬取该知识库页面失败（检查日志）
3. 该知识库是协作知识库，权限不足

### Q: 层级信息不完整怎么办？

A: 尝试：
1. 重新登录
2. 强制同步该知识库
3. 检查语雀网页版是否能看到正确的层级

### Q: 性能问题

A: 如果知识库文档很多（100+），树形视图可能会有性能问题。建议：
1. 使用列表视图
2. 使用搜索功能快速定位
3. 等待后续优化（虚拟滚动）

## 成功标志

如果功能正常工作，你应该看到：

✅ 数据库迁移成功（日志中显示 v5）
✅ 同步时能看到 TOC 相关日志
✅ 树形视图中文档有缩进
✅ 可以展开/收起文件夹
✅ 文件夹显示 📁 图标
✅ 普通文档显示 📄 图标

## 需要帮助？

如果以上步骤都无法解决问题，请提供：

1. 完整的控制台日志
2. 数据库查询结果
3. 测试的知识库信息（是否有层级结构）
4. 操作系统和应用版本
