# Design Document

## Overview

本设计文档描述语雀桌面同步工具增强功能的技术实现方案，包括图片本地化、附件下载、文档搜索、快捷操作、断点续传和统计功能。

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Renderer Process                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ SearchPanel │  │ StatsPanel  │  │ DocumentList        │  │
│  │             │  │             │  │ (open file/yuque)   │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │ IPC
┌─────────────────────────────────────────────────────────────┐
│                       Main Process                           │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                   Sync Engine                        │    │
│  │  ┌───────────────┐  ┌────────────────────────────┐  │    │
│  │  │ImageProcessor │  │ AttachmentDownloader       │  │    │
│  │  └───────────────┘  └────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │  SearchService  │  │ StatisticsService│                   │
│  └─────────────────┘  └─────────────────┘                   │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │  FileManager    │  │ SyncProgress DB │                   │
│  └─────────────────┘  └─────────────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Image Processor

负责处理文档中的图片下载和链接替换。

```typescript
interface ImageProcessor {
  // 从 markdown 中提取所有图片 URL
  extractImageUrls(markdown: string): string[]
  
  // 下载图片并返回本地路径
  downloadImage(url: string, targetDir: string): Promise<string | null>
  
  // 处理文档中的所有图片，返回替换后的 markdown
  processImages(markdown: string, docDir: string): Promise<string>
  
  // 生成唯一文件名
  generateUniqueFilename(url: string, existingFiles: Set<string>): string
}
```

图片 URL 匹配模式：
- `![alt](url)` - 标准 markdown 图片
- `<img src="url">` - HTML img 标签
- 语雀特有的图片 CDN 链接

### 2. Attachment Downloader

负责处理文档中的附件下载。

```typescript
interface AttachmentDownloader {
  // 从 markdown 中提取所有附件 URL
  extractAttachmentUrls(markdown: string): AttachmentInfo[]
  
  // 下载附件并返回本地路径
  downloadAttachment(url: string, targetDir: string, filename: string): Promise<string | null>
  
  // 处理文档中的所有附件，返回替换后的 markdown
  processAttachments(markdown: string, docDir: string): Promise<string>
}

interface AttachmentInfo {
  url: string
  filename: string
  displayText: string
}
```

附件 URL 匹配模式：
- `[filename](url)` - 带有 yuque 附件域名的链接
- 语雀附件域名：`cdn.nlark.com`, `www.yuque.com/attachments`

### 3. Search Service

负责本地文档搜索。

```typescript
interface SearchService {
  // 搜索文档
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>
  
  // 构建搜索索引（可选，用于优化性能）
  buildIndex(): Promise<void>
}

interface SearchOptions {
  limit?: number
  bookId?: string
  searchContent?: boolean
}

interface SearchResult {
  docId: string
  title: string
  bookId: string
  bookName: string
  snippet: string
  matchType: 'title' | 'content'
  localPath: string
}
```

搜索实现方案：
- 简单方案：直接查询数据库 + 读取文件内容
- 优化方案：使用 SQLite FTS5 全文搜索扩展

### 4. File Manager

负责打开本地文件和外部链接。

```typescript
interface FileManager {
  // 用系统默认应用打开文件
  openFile(filePath: string): Promise<void>
  
  // 在浏览器中打开 URL
  openUrl(url: string): Promise<void>
  
  // 构建语雀文档 URL
  buildYuqueUrl(userLogin: string, bookSlug: string, docSlug: string): string
  
  // 在文件管理器中显示文件
  showInFolder(filePath: string): Promise<void>
}
```

### 5. Statistics Service

负责计算和提供统计信息。

```typescript
interface StatisticsService {
  // 获取完整统计信息
  getStatistics(): Promise<SyncStatistics>
  
  // 计算目录大小
  calculateDirectorySize(dirPath: string): Promise<number>
}

interface SyncStatistics {
  totalDocuments: number
  syncedDocuments: number
  failedDocuments: number
  pendingDocuments: number
  totalBooks: number
  totalStorageBytes: number
  lastSyncTime: string | null
  imageCount: number
  attachmentCount: number
}
```

### 6. Sync Progress Tracking (断点续传)

扩展现有同步引擎，支持断点续传。

```typescript
interface SyncSession {
  id: number
  bookIds: string[]
  totalDocs: number
  completedDocIds: string[]
  status: 'running' | 'interrupted' | 'completed'
  startedAt: string
  updatedAt: string
}

interface SyncProgressTracker {
  // 创建新的同步会话
  createSession(bookIds: string[], totalDocs: number): number
  
  // 标记文档完成
  markDocCompleted(sessionId: number, docId: string): void
  
  // 获取未完成的会话
  getInterruptedSession(): SyncSession | null
  
  // 恢复中断的会话
  resumeSession(sessionId: number): Promise<void>
}
```

## Data Models

### 数据库 Schema 扩展

```sql
-- 同步会话表（用于断点续传）
CREATE TABLE IF NOT EXISTS sync_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_ids TEXT NOT NULL,  -- JSON array of book IDs
  total_docs INTEGER DEFAULT 0,
  completed_doc_ids TEXT DEFAULT '[]',  -- JSON array of completed doc IDs
  status TEXT DEFAULT 'running' CHECK(status IN ('running', 'interrupted', 'completed')),
  started_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 资源表（图片和附件）
CREATE TABLE IF NOT EXISTS resources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  doc_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('image', 'attachment')),
  remote_url TEXT NOT NULL,
  local_path TEXT,
  filename TEXT,
  size_bytes INTEGER,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'downloaded', 'failed')),
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (doc_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_resources_doc_id ON resources(doc_id);
CREATE INDEX IF NOT EXISTS idx_resources_type ON resources(type);
```

### 文件目录结构

```
sync_directory/
├── 知识库A/
│   ├── 文档1.md
│   ├── 文档1_assets/
│   │   ├── image1.png
│   │   └── image2.jpg
│   ├── 文档1_attachments/
│   │   └── file.pdf
│   ├── 文档2.md
│   └── ...
└── 知识库B/
    └── ...
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do.*

### Property 1: Resource URL Extraction Completeness

*For any* valid markdown content containing image or attachment URLs, the extraction functions SHALL return all URLs that match the supported patterns (markdown images, HTML img tags, and Yuque-specific links).

**Validates: Requirements 1.1, 2.1**

### Property 2: URL Replacement Consistency

*For any* markdown content processed for images or attachments, if a resource is successfully downloaded, the original URL SHALL be replaced with a valid relative local path, and the resulting markdown SHALL be valid.

**Validates: Requirements 1.3, 2.3**

### Property 3: Unique Filename Generation

*For any* set of resource URLs processed for a single document, the generated local filenames SHALL be unique (no collisions).

**Validates: Requirements 1.6, 2.6**

### Property 4: Attachment Filename Preservation

*For any* attachment download, the saved filename SHALL contain the original filename from the URL or link text.

**Validates: Requirements 2.5**

### Property 5: Search Result Accuracy

*For any* search query, if a document's title or content contains the query string, that document SHALL appear in the search results with the correct metadata (title, book name, snippet).

**Validates: Requirements 3.2, 3.3, 3.4, 3.6**

### Property 6: Yuque URL Construction

*For any* valid combination of userLogin, bookSlug, and docSlug, the constructed Yuque URL SHALL follow the format `https://www.yuque.com/{userLogin}/{bookSlug}/{docSlug}`.

**Validates: Requirements 5.3**

### Property 7: Resume Sync Skips Completed Documents

*For any* resumed sync session, documents that were marked as completed in the interrupted session SHALL NOT be re-downloaded.

**Validates: Requirements 6.3**

### Property 8: Statistics Accuracy

*For any* state of the database and file system, the statistics service SHALL return counts and sizes that accurately reflect the actual data.

**Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.7**

## Error Handling

### 图片/附件下载失败
- 保留原始 URL，不影响文档同步
- 记录失败信息到 resources 表
- 下次同步时可重试失败的资源

### 搜索错误
- 文件读取失败时跳过该文档
- 返回部分结果而不是完全失败

### 文件打开失败
- 文件不存在：提示用户重新同步
- 权限问题：显示具体错误信息

### 断点续传
- 会话数据损坏：创建新会话重新开始
- 文档状态不一致：以数据库记录为准

## Testing Strategy

### Unit Tests
- URL 提取正则表达式测试
- 文件名生成逻辑测试
- URL 构建测试
- 统计计算测试

### Property-Based Tests
- 使用 fast-check 生成随机 markdown 内容测试 URL 提取
- 生成随机文件名测试唯一性
- 生成随机搜索查询测试搜索准确性

### Integration Tests
- 完整的图片下载和替换流程
- 断点续传场景测试
- 搜索功能端到端测试

### 测试框架
- Vitest 作为测试运行器
- fast-check 用于 property-based testing
- 每个 property test 至少运行 100 次迭代
