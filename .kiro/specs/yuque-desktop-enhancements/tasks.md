# Implementation Plan: Yuque Desktop Enhancements

## Overview

本实现计划将增强功能分为 7 个主要模块，按依赖关系和优先级排序实现。

## Tasks

- [x] 1. 数据库 Schema 扩展
  - [x] 1.1 添加 sync_sessions 表用于断点续传
    - 创建表结构和索引
    - _Requirements: 6.1, 6.2_
  - [x] 1.2 添加 resources 表用于图片和附件记录
    - 创建表结构和索引
    - _Requirements: 1.2, 2.2_
  - [x] 1.3 更新数据库版本和迁移逻辑
    - 增加 SCHEMA_VERSION
    - 添加迁移 SQL
    - _Requirements: 1.2, 2.2, 6.1_

- [x] 2. 图片处理器实现
  - [x] 2.1 实现 URL 提取函数
    - 支持 markdown 图片语法 `![](url)`
    - 支持 HTML img 标签
    - 支持语雀 CDN 链接
    - _Requirements: 1.1, 1.5_
  - [x] 2.2 编写 URL 提取的 property test
    - **Property 1: Resource URL Extraction Completeness**
    - **Validates: Requirements 1.1**
  - [x] 2.3 实现图片下载函数
    - 下载图片到 assets 目录
    - 生成唯一文件名
    - _Requirements: 1.2, 1.6_
  - [x] 2.4 编写文件名唯一性的 property test
    - **Property 3: Unique Filename Generation**
    - **Validates: Requirements 1.6**
  - [x] 2.5 实现 markdown 链接替换函数
    - 替换远程 URL 为本地相对路径
    - 处理下载失败的情况
    - _Requirements: 1.3, 1.4_
  - [x] 2.6 编写 URL 替换的 property test
    - **Property 2: URL Replacement Consistency**
    - **Validates: Requirements 1.3**
  - [x] 2.7 集成到同步引擎
    - 在文档下载后处理图片
    - 记录资源到数据库
    - _Requirements: 1.7_

- [x] 3. 附件下载器实现
  - [x] 3.1 实现附件 URL 提取函数
    - 识别语雀附件链接
    - 提取文件名
    - _Requirements: 2.1_
  - [x] 3.2 实现附件下载函数
    - 下载到 attachments 目录
    - 保留原始文件名
    - 处理文件名冲突
    - _Requirements: 2.2, 2.5, 2.6_
  - [x] 3.3 编写文件名保留的 property test
    - **Property 4: Attachment Filename Preservation**
    - **Validates: Requirements 2.5**
  - [x] 3.4 实现 markdown 链接替换
    - 替换附件 URL 为本地路径
    - _Requirements: 2.3, 2.4_
  - [x] 3.5 集成到同步引擎
    - 在文档下载后处理附件
    - _Requirements: 2.1, 2.2_

- [x] 4. Checkpoint - 图片和附件功能验证
  - 确保图片和附件下载正常工作
  - 验证 markdown 链接替换正确
  - 确保所有测试通过

- [x] 5. 文件管理器实现
  - [x] 5.1 实现打开本地文件功能
    - 使用 Electron shell.openPath
    - 处理文件不存在的情况
    - _Requirements: 4.2, 4.3, 4.4_
  - [x] 5.2 实现打开语雀链接功能
    - 构建正确的语雀 URL
    - 使用 shell.openExternal
    - _Requirements: 5.2, 5.3_
  - [x] 5.3 编写 URL 构建的 property test
    - **Property 6: Yuque URL Construction**
    - **Validates: Requirements 5.3**
  - [x] 5.4 添加 IPC 接口
    - file:open
    - file:openInYuque
    - file:showInFolder
    - _Requirements: 4.2, 5.2_
  - [ ] 5.5 更新 DocumentList 组件
    - 添加打开文件按钮
    - 添加打开语雀按钮
    - 添加在文件夹中显示按钮
    - _Requirements: 4.1, 5.1_

- [-] 6. 搜索功能实现
  - [x] 6.1 实现搜索服务
    - 标题搜索（数据库查询）
    - 内容搜索（文件读取）
    - 生成匹配片段
    - _Requirements: 3.2, 3.3, 3.4, 3.6_
  - [x] 6.2 编写搜索准确性的 property test
    - **Property 5: Search Result Accuracy**
    - **Validates: Requirements 3.2, 3.3, 3.6**
  - [ ] 6.3 添加 IPC 接口
    - search:query
    - _Requirements: 3.2, 3.3_
  - [ ] 6.4 创建搜索 UI 组件
    - 搜索输入框
    - 搜索结果列表
    - 结果点击跳转
    - _Requirements: 3.1, 3.4, 3.5_

- [x] 7. Checkpoint - 文件管理和搜索功能验证
  - 确保打开文件功能正常
  - 确保搜索功能正常
  - 确保所有测试通过

- [ ] 8. 断点续传实现
  - [x] 8.1 实现同步会话管理
    - 创建会话
    - 更新进度
    - 标记完成
    - _Requirements: 6.1, 6.2_
  - [ ] 8.2 实现会话恢复逻辑
    - 检测中断的会话
    - 跳过已完成的文档
    - _Requirements: 6.3, 6.5_
  - [ ] 8.3 编写断点续传的 property test
    - **Property 7: Resume Sync Skips Completed Documents**
    - **Validates: Requirements 6.3**
  - [ ] 8.4 添加恢复同步的 UI
    - 检测到中断会话时提示
    - 提供恢复或重新开始选项
    - _Requirements: 6.4_

- [-] 9. 统计功能实现
  - [x] 9.1 实现统计服务
    - 文档数量统计
    - 知识库数量统计
    - 存储空间计算
    - 状态分布统计
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.6_
  - [ ] 9.2 编写统计准确性的 property test
    - **Property 8: Statistics Accuracy**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4**
  - [ ] 9.3 添加 IPC 接口
    - stats:get
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  - [ ] 9.4 创建统计面板 UI
    - 显示各项统计数据
    - 格式化存储空间显示
    - _Requirements: 7.5, 7.6_
  - [ ] 9.5 集成到主界面
    - 在设置或侧边栏添加入口
    - _Requirements: 7.5_

- [ ] 10. Final Checkpoint - 完整功能验证
  - 确保所有功能正常工作
  - 确保所有测试通过
  - 验证各功能之间的集成

## Notes

- 所有测试任务都是必须完成的
- 图片和附件处理会增加同步时间，考虑添加进度提示
- 搜索功能可以后续优化为 FTS5 全文搜索
- 统计中的存储空间计算可能较慢，考虑缓存
