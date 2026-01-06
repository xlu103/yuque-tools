# Requirements Document

## Introduction

语雀桌面同步工具 - 基于 Electron 的桌面应用，提供可视化界面管理语雀知识库的增量同步。复用现有 yuque-tools-cli 的核心逻辑，增加 GUI 界面和智能增量同步能力。

## Glossary

- **Desktop_App**: Electron 桌面应用程序
- **Sync_Engine**: 同步引擎，负责增量同步逻辑
- **Meta_Store**: 本地元数据存储，记录文档同步状态
- **Yuque_API**: 语雀 API 服务层（复用现有 CLI 核心）
- **Knowledge_Base**: 语雀知识库
- **Document**: 知识库中的单个文档

## Requirements

### Requirement 1: 用户登录

**User Story:** As a user, I want to login with my Yuque account, so that I can access my knowledge bases.

#### Acceptance Criteria

1. WHEN the user opens the app for the first time, THE Desktop_App SHALL display a login form with username and password fields
2. WHEN the user submits valid credentials, THE Desktop_App SHALL authenticate with Yuque and store the session
3. WHEN the user submits invalid credentials, THE Desktop_App SHALL display an error message
4. WHILE the user is logged in, THE Desktop_App SHALL persist the session for 24 hours
5. WHEN the session expires, THE Desktop_App SHALL prompt the user to re-login

### Requirement 2: 知识库列表展示

**User Story:** As a user, I want to see all my knowledge bases, so that I can choose which ones to sync.

#### Acceptance Criteria

1. WHEN the user is logged in, THE Desktop_App SHALL fetch and display all accessible knowledge bases
2. THE Desktop_App SHALL distinguish personal (👤) and collaborative (👥) knowledge bases with visual indicators
3. WHEN fetching knowledge bases fails, THE Desktop_App SHALL display an error message with retry option
4. THE Desktop_App SHALL display the document count for each knowledge base

### Requirement 3: 同步目录配置

**User Story:** As a user, I want to configure the local sync directory, so that I can control where documents are saved.

#### Acceptance Criteria

1. THE Desktop_App SHALL provide a directory picker to select the sync destination
2. WHEN no directory is configured, THE Desktop_App SHALL use a default directory
3. THE Desktop_App SHALL persist the directory configuration across app restarts
4. WHEN the configured directory is inaccessible, THE Desktop_App SHALL notify the user

### Requirement 4: 增量同步

**User Story:** As a user, I want to sync only changed documents, so that I can save time and bandwidth.

#### Acceptance Criteria

1. WHEN the user initiates a sync, THE Sync_Engine SHALL compare remote document timestamps with local Meta_Store
2. THE Sync_Engine SHALL only download documents where remote `content_updated_at` is newer than local record
3. THE Meta_Store SHALL persist document metadata (id, slug, content_updated_at, local_path) to local storage
4. WHEN a document is newly created on Yuque, THE Sync_Engine SHALL download it as a new file
5. WHEN a document is deleted on Yuque, THE Sync_Engine SHALL mark it as deleted in Meta_Store (not auto-delete local file)
6. THE Desktop_App SHALL display sync progress with document name and status

### Requirement 5: 同步状态展示

**User Story:** As a user, I want to see the sync status of each document, so that I know what has changed.

#### Acceptance Criteria

1. THE Desktop_App SHALL display sync status for each document: synced, pending, modified, new, deleted
2. WHEN hovering over a document, THE Desktop_App SHALL show last sync time and remote update time
3. THE Desktop_App SHALL provide a filter to show only documents with pending changes
4. THE Desktop_App SHALL display a summary of changes before sync (X new, Y modified, Z deleted)

### Requirement 6: 手动同步控制

**User Story:** As a user, I want to manually control which documents to sync, so that I can selectively update content.

#### Acceptance Criteria

1. THE Desktop_App SHALL allow selecting individual documents or entire knowledge bases for sync
2. THE Desktop_App SHALL provide a "Sync All" button to sync all pending changes
3. THE Desktop_App SHALL provide a "Force Sync" option to re-download even if no changes detected
4. WHEN sync is in progress, THE Desktop_App SHALL allow canceling the operation

### Requirement 7: 同步历史记录

**User Story:** As a user, I want to see sync history, so that I can track what was synced and when.

#### Acceptance Criteria

1. THE Meta_Store SHALL record each sync operation with timestamp, document count, and status
2. THE Desktop_App SHALL display recent sync history (last 50 operations)
3. WHEN a sync fails, THE Desktop_App SHALL log the error details for troubleshooting

### Requirement 8: 导出选项配置

**User Story:** As a user, I want to configure export options, so that I can customize the output format.

#### Acceptance Criteria

1. THE Desktop_App SHALL provide options for: linebreak preservation, LaTeX code export
2. THE Desktop_App SHALL persist export options across app restarts
3. WHEN export options change, THE Desktop_App SHALL apply them to subsequent syncs

### Requirement 9: macOS 原生风格 UI 设计

**User Story:** As a user, I want a native macOS-style interface, so that the app feels consistent with my system.

#### Acceptance Criteria

1. THE Desktop_App SHALL follow Apple Human Interface Guidelines for macOS
2. THE Desktop_App SHALL use native macOS window controls (traffic lights) and titlebar style
3. THE Desktop_App SHALL support system-level light/dark mode and follow system preference
4. THE Desktop_App SHALL use SF Pro or system font for typography
5. THE Desktop_App SHALL use a sidebar navigation layout similar to Finder/Notes app
6. THE Desktop_App SHALL implement native macOS animations (spring animations, fade transitions)
7. THE Desktop_App SHALL use vibrancy/blur effects for sidebar background where appropriate
8. THE Desktop_App SHALL support native drag-and-drop interactions
9. THE Desktop_App SHALL use macOS-style form controls (switches, checkboxes, buttons)
10. THE Desktop_App SHALL display loading states with native-style progress indicators

### Requirement 10: 用户体验优化

**User Story:** As a user, I want a smooth and intuitive experience, so that I can efficiently manage my documents.

#### Acceptance Criteria

1. THE Desktop_App SHALL provide keyboard shortcuts for common actions (Cmd/Ctrl+S for sync, Cmd/Ctrl+R for refresh)
2. THE Desktop_App SHALL show toast notifications for important events (sync complete, errors)
3. THE Desktop_App SHALL remember window size and position across restarts
4. THE Desktop_App SHALL provide a search/filter function to quickly find knowledge bases or documents
5. WHEN performing long operations, THE Desktop_App SHALL show progress indicators
6. THE Desktop_App SHALL provide contextual tooltips for UI elements

