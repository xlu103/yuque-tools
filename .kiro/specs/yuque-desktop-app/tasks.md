# Implementation Plan: Yuque Desktop App

## Overview

基于 Electron + Vite + React 构建语雀桌面同步工具，采用 macOS 原生风格设计。分阶段实现：项目搭建 → 核心同步引擎 → UI 界面 → 集成测试。

## Tasks

- [x] 1. 项目初始化和基础架构
  - [x] 1.1 创建 Electron + Vite + React + TypeScript 项目结构
    - 在 packages/yuque-desktop 下初始化项目
    - 配置 electron-vite 或 vite-plugin-electron
    - 设置 TypeScript 配置
    - _Requirements: 项目基础_

  - [x] 1.2 配置 Tailwind CSS 和基础样式
    - 安装 Tailwind CSS
    - 配置 macOS 风格的设计 tokens（颜色、字体、间距）
    - _Requirements: 9.1, 9.4_

  - [x] 1.3 设置类型安全的 IPC 通信层
    - 创建 IPC channel 类型定义
    - 实现 preload 脚本
    - 创建 renderer 端的 IPC 调用 hooks
    - _Requirements: 架构设计_

- [x] 2. 本地存储层 (Meta Store)
  - [x] 2.1 集成 better-sqlite3 并创建数据库 schema
    - 安装 better-sqlite3
    - 创建 documents、books、sync_history、settings 表
    - 实现数据库初始化和迁移逻辑
    - _Requirements: 4.3, 7.1_

  - [x] 2.2 实现 Meta Store CRUD 操作
    - 文档元数据的增删改查
    - 知识库信息存储
    - 设置读写
    - _Requirements: 3.3, 4.3_

  - [ ]* 2.3 编写 Property Test: Settings Persistence Round-Trip
    - **Property 4: Settings Persistence Round-Trip**
    - **Validates: Requirements 3.3, 8.2**

- [x] 3. 认证模块
  - [x] 3.1 复用 yuque-tools-cli 的登录逻辑
    - 导入现有的 loginYuque 函数
    - 适配为 IPC handler
    - 实现会话存储和过期检查
    - _Requirements: 1.1, 1.2, 1.4_

  - [x] 3.2 实现 IPC handlers: auth:login, auth:logout, auth:getSession
    - 登录处理
    - 登出清理
    - 会话状态检查
    - _Requirements: 1.2, 1.5_

  - [ ]* 3.3 编写 Property Test: Session Persistence and Expiry
    - **Property 1: Session Persistence and Expiry**
    - **Validates: Requirements 1.2, 1.4**

- [x] 4. 知识库数据获取
  - [x] 4.1 复用 yuque-tools-cli 的知识库获取逻辑
    - 导入 getBookStacks, getDocsOfBooks 函数
    - 适配为 IPC handler
    - _Requirements: 2.1_

  - [x] 4.2 实现 IPC handlers: books:list, books:getDocs
    - 获取知识库列表
    - 获取知识库下的文档列表
    - 存储到 Meta Store
    - _Requirements: 2.1, 2.4_

  - [ ]* 4.3 编写 Property Test: Document Count Display
    - **Property 3: Document Count Display**
    - **Validates: Requirements 2.4**

- [x] 5. Checkpoint - 核心数据层完成
  - 确保所有测试通过，如有问题请询问用户

- [x] 6. 增量同步引擎
  - [x] 6.1 实现文档变更检测逻辑
    - 对比远程文档列表和本地 Meta Store
    - 识别新增、修改、删除的文档
    - 生成 ChangeSet
    - _Requirements: 4.1, 4.2, 4.4, 4.5_

  - [x] 6.2 实现增量下载逻辑
    - 只下载有变更的文档
    - 更新本地 Meta Store
    - 发送进度事件
    - _Requirements: 4.2, 4.6_

  - [x] 6.3 实现同步历史记录
    - 记录每次同步操作
    - 存储状态和统计信息
    - _Requirements: 7.1, 7.2, 7.3_

  - [ ]* 6.4 编写 Property Test: Incremental Sync Decision
    - **Property 5: Incremental Sync Decision**
    - **Validates: Requirements 4.1, 4.2, 4.4**

  - [ ]* 6.5 编写 Property Test: Deleted Document Detection
    - **Property 6: Deleted Document Detection**
    - **Validates: Requirements 4.5**

  - [ ]* 6.6 编写 Property Test: Sync History Recording
    - **Property 12: Sync History Recording**
    - **Validates: Requirements 7.1, 7.2, 7.3**

- [x] 7. Checkpoint - 同步引擎完成
  - 确保所有测试通过，如有问题请询问用户

- [x] 8. macOS 风格 UI 组件库
  - [x] 8.1 创建基础 macOS 风格组件
    - MacWindow: 原生窗口样式和 traffic lights
    - MacButton: 原生按钮样式
    - MacSwitch: 原生开关
    - MacInput: 原生输入框
    - _Requirements: 9.2, 9.9_

  - [x] 8.2 创建布局组件
    - MacSidebar: 毛玻璃效果侧边栏
    - MacToolbar: 工具栏
    - MacToast: 通知提示
    - _Requirements: 9.5, 9.7, 10.2_

  - [x] 8.3 实现主题系统
    - 跟随系统亮色/暗色模式
    - 使用 CSS 变量管理主题
    - _Requirements: 9.3_

- [x] 9. 登录页面
  - [x] 9.1 创建登录表单 UI
    - 用户名和密码输入框
    - 登录按钮
    - 错误提示
    - _Requirements: 1.1, 1.3_

  - [x] 9.2 连接登录逻辑
    - 调用 auth:login IPC
    - 处理成功/失败状态
    - 跳转到主页面
    - _Requirements: 1.2, 1.3_

- [x] 10. 主界面 - 侧边栏
  - [x] 10.1 创建知识库列表组件
    - 显示所有知识库
    - 区分个人/协作知识库图标
    - 显示文档数量
    - _Requirements: 2.1, 2.2, 2.4_

  - [x] 10.2 实现知识库选择和同步状态摘要
    - 选中状态管理
    - 显示待同步数量
    - _Requirements: 5.4, 6.1_

  - [ ]* 10.3 编写 Property Test: Knowledge Base Type Indicator
    - **Property 2: Knowledge Base Type Indicator**
    - **Validates: Requirements 2.2**

- [x] 11. 主界面 - 文档列表
  - [x] 11.1 创建文档列表组件
    - 显示文档标题和同步状态
    - 状态图标（synced/pending/modified/new/deleted）
    - _Requirements: 5.1_

  - [x] 11.2 实现文档筛选功能
    - 按状态筛选
    - 搜索功能
    - _Requirements: 5.3, 10.4_

  - [x] 11.3 实现文档选择和批量操作
    - 单选/多选
    - 全选知识库
    - _Requirements: 6.1_

  - [ ]* 11.4 编写 Property Test: Filter Correctness
    - **Property 9: Filter Correctness**
    - **Validates: Requirements 5.3**

  - [ ]* 11.5 编写 Property Test: Search Filter Accuracy
    - **Property 14: Search Filter Accuracy**
    - **Validates: Requirements 10.4**

- [x] 12. 同步操作 UI
  - [x] 12.1 创建同步控制按钮
    - Sync All 按钮
    - Force Sync 选项
    - Cancel 按钮
    - _Requirements: 6.2, 6.3, 6.4_

  - [x] 12.2 实现同步进度显示
    - 进度条
    - 当前文档名称
    - 完成/失败统计
    - _Requirements: 4.6, 10.5_

  - [ ]* 12.3 编写 Property Test: Sync Progress Accuracy
    - **Property 7: Sync Progress Accuracy**
    - **Validates: Requirements 4.6**

- [x] 13. Checkpoint - 主界面完成
  - 确保所有测试通过，如有问题请询问用户

- [x] 14. 设置页面
  - [x] 14.1 创建设置面板 UI
    - 同步目录选择器
    - 导出选项（linebreak, latexcode）
    - 主题切换
    - _Requirements: 3.1, 8.1, 9.3_

  - [x] 14.2 实现设置持久化
    - 保存到 Meta Store
    - 应用到同步引擎
    - _Requirements: 3.2, 3.3, 8.2, 8.3_

  - [ ]* 14.3 编写 Property Test: Settings Application
    - **Property 13: Settings Application**
    - **Validates: Requirements 8.3**

- [x] 15. 同步历史页面
  - [x] 15.1 创建同步历史列表
    - 显示最近 50 条记录
    - 时间、状态、文档数量
    - 错误详情展开
    - _Requirements: 7.2, 7.3_

- [x] 16. 窗口管理和快捷键
  - [x] 16.1 实现窗口状态持久化
    - 保存窗口位置和大小
    - 启动时恢复
    - _Requirements: 10.3_

  - [x] 16.2 实现键盘快捷键
    - Cmd+S: 同步
    - Cmd+R: 刷新
    - Cmd+,: 设置
    - _Requirements: 10.1_

  - [ ]* 16.3 编写 Property Test: Window State Persistence
    - **Property 15: Window State Persistence**
    - **Validates: Requirements 10.3**

- [x] 17. 最终集成和优化
  - [x] 17.1 错误处理和边界情况
    - 网络错误处理
    - 目录不可访问处理
    - _Requirements: 2.3, 3.4_

  - [x] 17.2 性能优化
    - 大量文档的虚拟列表
    - 防抖搜索
    - _Requirements: 性能_

- [x] 18. Final Checkpoint
  - 确保所有测试通过，如有问题请询问用户

## Notes

- Tasks marked with `*` are optional property-based tests
- 复用 yuque-tools-cli 的核心 API 逻辑，避免重复实现
- macOS 风格组件基于 Radix UI Primitives 自定义样式
- 使用 fast-check 进行 property-based testing
