# Requirements Document

## Introduction

本文档定义了语雀桌面同步工具的增强功能需求，包括图片本地化、附件下载、文档搜索、快捷操作、断点续传和统计功能。

## Glossary

- **Sync_Engine**: 同步引擎，负责文档下载和本地存储
- **Image_Processor**: 图片处理器，负责下载和替换文档中的图片链接
- **Attachment_Downloader**: 附件下载器，负责下载文档中的附件文件
- **Search_Engine**: 搜索引擎，负责本地文档的全文搜索
- **File_Manager**: 文件管理器，负责打开本地文件和外部链接
- **Statistics_Service**: 统计服务，负责计算同步数据统计信息

## Requirements

### Requirement 1: 图片本地化

**User Story:** As a user, I want document images to be downloaded locally, so that images remain accessible even when offline or if Yuque links expire.

#### Acceptance Criteria

1. WHEN the Sync_Engine downloads a document, THE Image_Processor SHALL extract all image URLs from the markdown content
2. WHEN an image URL is detected, THE Image_Processor SHALL download the image to a local `assets` folder alongside the document
3. WHEN an image is successfully downloaded, THE Image_Processor SHALL replace the original URL in markdown with a relative local path
4. IF an image download fails, THEN THE Image_Processor SHALL keep the original URL and log the failure
5. THE Image_Processor SHALL support common image formats including PNG, JPG, JPEG, GIF, WebP, and SVG
6. THE Image_Processor SHALL generate unique filenames to avoid conflicts (using hash or original filename)
7. WHEN a document is re-synced, THE Image_Processor SHALL only download new or changed images

### Requirement 2: 附件下载

**User Story:** As a user, I want document attachments to be downloaded locally, so that I have complete offline access to all document resources.

#### Acceptance Criteria

1. WHEN the Sync_Engine downloads a document, THE Attachment_Downloader SHALL extract all attachment URLs from the markdown content
2. WHEN an attachment URL is detected, THE Attachment_Downloader SHALL download the file to a local `attachments` folder
3. WHEN an attachment is successfully downloaded, THE Attachment_Downloader SHALL replace the original URL with a relative local path
4. IF an attachment download fails, THEN THE Attachment_Downloader SHALL keep the original URL and log the failure
5. THE Attachment_Downloader SHALL preserve the original filename when saving attachments
6. THE Attachment_Downloader SHALL handle filename conflicts by appending a number suffix

### Requirement 3: 文档搜索

**User Story:** As a user, I want to search through my synced documents, so that I can quickly find specific content.

#### Acceptance Criteria

1. THE Search_Engine SHALL provide a search input in the main interface
2. WHEN a user enters a search query, THE Search_Engine SHALL search through document titles
3. WHEN a user enters a search query, THE Search_Engine SHALL search through document content
4. THE Search_Engine SHALL display search results with document title, book name, and matching snippet
5. WHEN a user clicks a search result, THE System SHALL navigate to that document
6. THE Search_Engine SHALL support Chinese character search
7. THE Search_Engine SHALL perform search with minimal latency (under 500ms for typical queries)

### Requirement 4: 打开本地文件

**User Story:** As a user, I want to open synced documents in my preferred editor, so that I can view or edit the markdown files directly.

#### Acceptance Criteria

1. THE DocumentList SHALL display an "open file" action for each synced document
2. WHEN a user clicks "open file", THE File_Manager SHALL open the markdown file with the system default application
3. IF the local file does not exist, THEN THE File_Manager SHALL display an error message
4. THE File_Manager SHALL support opening files on macOS, Windows, and Linux

### Requirement 5: 打开语雀原文

**User Story:** As a user, I want to quickly access the original document on Yuque, so that I can view the latest version or edit online.

#### Acceptance Criteria

1. THE DocumentList SHALL display an "open in Yuque" action for each document
2. WHEN a user clicks "open in Yuque", THE File_Manager SHALL open the Yuque document URL in the default browser
3. THE System SHALL construct the correct Yuque URL using userLogin, bookSlug, and docSlug

### Requirement 6: 断点续传

**User Story:** As a user, I want sync to resume from where it stopped, so that I don't have to re-download already synced documents after an interruption.

#### Acceptance Criteria

1. THE Sync_Engine SHALL track sync progress in the database during sync operations
2. WHEN sync is interrupted (cancelled, error, or app closed), THE Sync_Engine SHALL preserve the current progress state
3. WHEN sync is restarted, THE Sync_Engine SHALL skip documents that were already successfully synced in the interrupted session
4. THE Sync_Engine SHALL provide an option to resume the last interrupted sync
5. WHEN all documents from an interrupted sync are completed, THE Sync_Engine SHALL mark the sync session as complete

### Requirement 7: 导出统计

**User Story:** As a user, I want to see statistics about my synced documents, so that I can understand my sync status and storage usage.

#### Acceptance Criteria

1. THE Statistics_Service SHALL calculate the total number of synced documents
2. THE Statistics_Service SHALL calculate the total number of knowledge bases
3. THE Statistics_Service SHALL calculate the total storage space used by synced files
4. THE Statistics_Service SHALL calculate the number of documents by sync status (synced, failed, pending)
5. THE System SHALL display statistics in a dedicated panel or section
6. THE Statistics_Service SHALL show the last successful sync time
7. THE Statistics_Service SHALL update statistics after each sync operation
