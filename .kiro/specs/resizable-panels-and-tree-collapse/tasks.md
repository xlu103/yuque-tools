# Implementation Plan: Resizable Panels and Tree Collapse

## Overview

本实现计划分为两个主要部分：可调整面板布局和文档树折叠功能。采用增量开发方式，每个任务都可独立验证。

## Tasks

- [x] 1. 实现面板布局状态管理
  - [x] 1.1 创建 panelLayoutStore
    - 创建 `packages/yuque-desktop/src/stores/panelLayoutStore.ts`
    - 实现 sidebarWidth 和 previewWidth 状态
    - 实现 clampWidth 工具函数处理宽度约束
    - 实现 loadLayout 和 saveLayout 方法
    - _Requirements: 1.3, 1.4, 2.1, 2.2, 2.3, 2.4_
  - [ ]* 1.2 编写 panelLayoutStore 属性测试
    - **Property 1: Panel Width Clamping**
    - **Property 2: Panel Layout Round-Trip Persistence**
    - **Validates: Requirements 1.3, 1.4, 1.5, 2.1, 2.2, 2.4**

- [x] 2. 实现 PanelResizer 组件
  - [x] 2.1 创建 PanelResizer 组件
    - 创建 `packages/yuque-desktop/src/components/ui/PanelResizer.tsx`
    - 实现拖动交互逻辑（mousedown, mousemove, mouseup）
    - 实现视觉反馈（hover 状态、拖动状态）
    - 导出组件到 ui/index.ts
    - _Requirements: 1.1, 1.2_

- [x] 3. 集成面板布局到 MainLayout
  - [x] 3.1 修改 MainLayout 使用可调整布局
    - 导入 panelLayoutStore 和 PanelResizer
    - 在 sidebar 和 document list 之间添加 PanelResizer
    - 在 document list 和 preview 之间添加 PanelResizer
    - 应用动态宽度样式
    - 在组件挂载时加载保存的布局
    - 在拖动结束时保存布局
    - _Requirements: 1.1, 1.2, 1.5, 2.1, 2.2, 2.3_

- [x] 4. Checkpoint - 面板布局功能验证
  - 确保所有测试通过，验证面板拖动和持久化功能正常工作

- [x] 5. 实现文档树折叠状态管理
  - [x] 5.1 创建 treeCollapseStore
    - 创建 `packages/yuque-desktop/src/stores/treeCollapseStore.ts`
    - 实现 collapsedNodes 状态（按 bookId 存储）
    - 实现 toggleNode, isCollapsed 方法
    - 实现 collapseAll, expandAll 方法
    - 实现 loadCollapseState, saveCollapseState 方法
    - _Requirements: 3.2, 3.3, 4.2, 4.3, 5.1, 5.2, 5.3, 5.4_
  - [ ]* 5.2 编写 treeCollapseStore 属性测试
    - **Property 3: Toggle Collapse State**
    - **Property 4: Collapse/Expand All Operations**
    - **Property 5: Collapse/Expand All Idempotence**
    - **Property 6: Collapse State Round-Trip Persistence**
    - **Validates: Requirements 3.2, 3.3, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.4**

- [x] 6. 更新 DocumentTree 组件支持折叠功能
  - [x] 6.1 修改 DocumentTree 添加折叠控制
    - 导入 treeCollapseStore
    - 添加 bookId prop 用于状态持久化
    - 在工具栏添加"全部折叠"和"全部展开"按钮
    - 在组件挂载/bookId 变化时加载折叠状态
    - _Requirements: 4.1, 4.2, 4.3_
  - [x] 6.2 修改 DocumentTreeNode 使用折叠状态
    - 使用 treeCollapseStore 的 isCollapsed 判断节点状态
    - 点击箭头时调用 toggleNode 并保存状态
    - 根据折叠状态显示/隐藏子节点
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 5.1_

- [x] 7. 更新 MainLayout 传递 bookId
  - [x] 7.1 修改 MainLayout 传递 bookId 到 DocumentTree
    - 将 selectedBookId 作为 bookId prop 传递给 DocumentTree
    - _Requirements: 5.2_

- [x] 8. Final Checkpoint - 全功能验证
  - 确保所有测试通过
  - 验证面板拖动、持久化、折叠/展开功能正常工作
  - 如有问题请询问用户

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
