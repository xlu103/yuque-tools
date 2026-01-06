# Design Document: Yuque Desktop App

## Overview

基于 Electron 的语雀桌面同步工具，采用 macOS 原生风格设计。复用现有 yuque-tools-cli 的核心 API 层，新增 GUI 界面和智能增量同步引擎。

### 技术栈

- **框架**: Electron + Vite + React 19 + TypeScript
- **UI**: Tailwind CSS + Radix UI Primitives（自定义 macOS 风格）
- **状态管理**: Zustand
- **本地存储**: SQLite (better-sqlite3) 用于元数据存储
- **IPC**: Electron IPC with type-safe wrapper

### 项目结构

```
packages/
├── yuque-tools-cli/          # 现有 CLI（保留，作为核心依赖）
└── yuque-desktop/            # 新建 Electron 应用
    ├── electron/             # Electron 主进程
    │   ├── main.ts
    │   ├── preload.ts
    │   └── ipc/              # IPC handlers
    ├── src/                  # React 渲染进程
    │   ├── components/       # UI 组件
    │   ├── pages/            # 页面
    │   ├── stores/           # Zustand stores
    │   ├── hooks/            # Custom hooks
    │   └── lib/              # 工具函数
    ├── package.json
    └── vite.config.ts
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Renderer Process (React)                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Sidebar   │  │  Main View  │  │   Settings Panel    │  │
│  │  - Books    │  │  - DocList  │  │   - Sync Options    │  │
│  │  - Status   │  │  - Progress │  │   - Theme           │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│                           │                                  │
│                    ┌──────┴──────┐                          │
│                    │ Zustand Store│                          │
│                    └──────┬──────┘                          │
└───────────────────────────┼─────────────────────────────────┘
                            │ IPC
┌───────────────────────────┼─────────────────────────────────┐
│                    Main Process                              │
│  ┌─────────────┐  ┌──────┴──────┐  ┌─────────────────────┐  │
│  │ Window Mgr  │  │ IPC Handler │  │   Sync Engine       │  │
│  └─────────────┘  └─────────────┘  │   - Scheduler       │  │
│                                     │   - Diff Calculator │  │
│  ┌─────────────┐  ┌─────────────┐  └──────────┬──────────┘  │
│  │ Meta Store  │  │ Yuque API   │◄────────────┘             │
│  │  (SQLite)   │  │ (from CLI)  │                           │
│  └─────────────┘  └─────────────┘                           │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### IPC 通信接口

```typescript
// electron/ipc/types.ts
interface IPCChannels {
  // Auth
  'auth:login': (credentials: { userName: string; password: string }) => Promise<LoginResult>
  'auth:logout': () => Promise<void>
  'auth:getSession': () => Promise<Session | null>

  // Knowledge Bases
  'books:list': () => Promise<KnowledgeBase[]>
  'books:getDocs': (bookId: string) => Promise<Document[]>

  // Sync
  'sync:start': (options: SyncOptions) => Promise<void>
  'sync:cancel': () => Promise<void>
  'sync:getStatus': () => Promise<SyncStatus>
  'sync:getChanges': (bookIds: string[]) => Promise<ChangeSet>

  // Settings
  'settings:get': () => Promise<AppSettings>
  'settings:set': (settings: Partial<AppSettings>) => Promise<void>
  'settings:selectDirectory': () => Promise<string | null>

  // Events (main -> renderer)
  'sync:progress': (progress: SyncProgress) => void
  'sync:complete': (result: SyncResult) => void
  'sync:error': (error: Error) => void
}
```

### React 组件结构

```typescript
// 主布局
<AppLayout>
  <Sidebar>
    <UserProfile />
    <BookList />
    <SyncStatusSummary />
  </Sidebar>
  <MainContent>
    <Toolbar />
    <DocumentList />
  </MainContent>
</AppLayout>

// macOS 风格组件
<MacWindow>           // 原生窗口样式
<MacSidebar>          // 毛玻璃侧边栏
<MacButton>           // 原生按钮样式
<MacSwitch>           // 原生开关
<MacProgress>         // 原生进度条
<MacToast>            // 原生通知样式
```

## Data Models

### SQLite Schema

```sql
-- 文档元数据
CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  local_path TEXT,
  remote_updated_at TEXT,
  local_synced_at TEXT,
  sync_status TEXT DEFAULT 'pending', -- synced, pending, modified, new, deleted
  FOREIGN KEY (book_id) REFERENCES books(id)
);

-- 知识库
CREATE TABLE books (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  user_login TEXT NOT NULL,
  type TEXT DEFAULT 'owner', -- owner, collab
  doc_count INTEGER DEFAULT 0
);

-- 同步历史
CREATE TABLE sync_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT DEFAULT 'running', -- running, success, failed, cancelled
  total_docs INTEGER DEFAULT 0,
  synced_docs INTEGER DEFAULT 0,
  error_message TEXT
);

-- 应用设置
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
```

### TypeScript 类型

```typescript
interface KnowledgeBase {
  id: string
  slug: string
  name: string
  userLogin: string
  type: 'owner' | 'collab'
  docCount: number
}

interface Document {
  id: string
  bookId: string
  slug: string
  title: string
  localPath?: string
  remoteUpdatedAt: string
  localSyncedAt?: string
  syncStatus: 'synced' | 'pending' | 'modified' | 'new' | 'deleted'
}

interface SyncProgress {
  current: number
  total: number
  currentDoc: string
  status: 'downloading' | 'writing' | 'comparing'
}

interface ChangeSet {
  new: Document[]
  modified: Document[]
  deleted: Document[]
}

interface AppSettings {
  syncDirectory: string
  linebreak: boolean
  latexcode: boolean
  theme: 'system' | 'light' | 'dark'
}
```



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Session Persistence and Expiry

*For any* valid login, the session SHALL be stored with an expiry time of 24 hours, and *for any* stored session, checking validity SHALL return true if current time is before expiry and false otherwise.

**Validates: Requirements 1.2, 1.4**

### Property 2: Knowledge Base Type Indicator

*For any* knowledge base returned from the API, the UI SHALL display a personal indicator (👤) if `type === 'owner'` and a collaborative indicator (👥) otherwise.

**Validates: Requirements 2.2**

### Property 3: Document Count Display

*For any* knowledge base displayed in the list, the shown document count SHALL equal the `docCount` property from the data model.

**Validates: Requirements 2.4**

### Property 4: Settings Persistence Round-Trip

*For any* settings object saved to the Meta_Store, reading the settings back SHALL return an equivalent object.

**Validates: Requirements 3.3, 8.2**

### Property 5: Incremental Sync Decision

*For any* document, the Sync_Engine SHALL download it if and only if:
- The document does not exist in local Meta_Store (new), OR
- The remote `content_updated_at` is strictly greater than the local `localSyncedAt`

**Validates: Requirements 4.1, 4.2, 4.4**

### Property 6: Deleted Document Detection

*For any* document that exists in local Meta_Store but not in the remote document list, the Sync_Engine SHALL mark its `syncStatus` as 'deleted'.

**Validates: Requirements 4.5**

### Property 7: Sync Progress Accuracy

*For any* sync operation with N documents, the progress events SHALL report `current` values from 0 to N, and the final `current` SHALL equal `total`.

**Validates: Requirements 4.6**

### Property 8: Document Status Consistency

*For any* document in the Meta_Store, its displayed `syncStatus` SHALL match the stored value, and the change summary counts SHALL equal the count of documents with each respective status.

**Validates: Requirements 5.1, 5.4**

### Property 9: Filter Correctness

*For any* filter applied to the document list, the resulting list SHALL contain only documents whose `syncStatus` matches the filter criteria.

**Validates: Requirements 5.3**

### Property 10: Selection State Tracking

*For any* selection action (select/deselect document or book), the selection state SHALL accurately reflect all selected items, and selecting a book SHALL select all its documents.

**Validates: Requirements 6.1**

### Property 11: Force Sync Behavior

*For any* document with `syncStatus === 'synced'`, a force sync operation SHALL re-download the document regardless of timestamp comparison.

**Validates: Requirements 6.3**

### Property 12: Sync History Recording

*For any* completed sync operation, the Meta_Store SHALL contain a history record with correct `started_at`, `completed_at`, `status`, `total_docs`, and `synced_docs` values.

**Validates: Requirements 7.1, 7.2, 7.3**

### Property 13: Settings Application

*For any* export option (linebreak, latexcode), when changed and a sync is performed, the downloaded content SHALL reflect the new option value.

**Validates: Requirements 8.3**

### Property 14: Search Filter Accuracy

*For any* search query string, the filtered results SHALL contain only items where the name or title contains the query (case-insensitive).

**Validates: Requirements 10.4**

### Property 15: Window State Persistence

*For any* window bounds (x, y, width, height) saved on close, reopening the app SHALL restore the window to those exact bounds.

**Validates: Requirements 10.3**

## Error Handling

### Authentication Errors
- Invalid credentials: Display error message, allow retry
- Network failure: Display offline indicator, queue retry
- Session expired: Auto-redirect to login

### Sync Errors
- Document download failure: Log error, continue with next document, report in summary
- File write failure: Check permissions, notify user
- Cancellation: Clean up partial downloads, update status

### Storage Errors
- SQLite corruption: Attempt recovery, offer reset option
- Disk full: Notify user, pause sync

## Testing Strategy

### Unit Tests
- IPC handler functions
- Sync engine logic (timestamp comparison, change detection)
- Meta store CRUD operations
- Settings persistence

### Property-Based Tests
- Use fast-check for TypeScript property testing
- Minimum 100 iterations per property
- Focus on sync logic and data consistency

### Integration Tests
- Full sync flow with mock Yuque API
- IPC communication between main and renderer
- SQLite operations

### E2E Tests
- Playwright for Electron
- Login flow
- Sync operation
- Settings changes
