# Requirements Document

## Introduction

本功能为语雀桌面同步工具增加两项用户体验改进：
1. 可调整大小的面板布局 - 允许用户拖动调整左侧知识库列表、中间文档列表和右侧预览面板的宽度，并持久化保存
2. 文档树折叠功能 - 为层级文档树添加折叠/展开控制，包括单节点操作和一键全部折叠/展开

## Glossary

- **Panel_Resizer**: 面板分隔条组件，用户可拖动以调整相邻面板宽度
- **Panel_Layout_Store**: 面板布局存储模块，负责持久化和恢复面板尺寸配置
- **Document_Tree**: 文档树组件，以层级结构展示知识库中的文档
- **Tree_Node**: 文档树中的单个节点，可能包含子节点
- **Collapse_State**: 节点的折叠状态，表示子节点是否可见

## Requirements

### Requirement 1: 可拖动调整面板宽度

**User Story:** As a user, I want to drag panel dividers to resize the sidebar, document list, and preview panel, so that I can customize the layout to my preference.

#### Acceptance Criteria

1. WHEN the user hovers over a panel divider, THE Panel_Resizer SHALL display a visual indicator (cursor change and highlight)
2. WHEN the user drags a panel divider, THE Panel_Resizer SHALL resize the adjacent panels in real-time
3. WHILE the user is dragging, THE Panel_Resizer SHALL enforce minimum width constraints (sidebar: 180px, document list: 250px, preview: 300px)
4. WHILE the user is dragging, THE Panel_Resizer SHALL enforce maximum width constraints to prevent panels from exceeding 50% of window width
5. WHEN the user releases the mouse after dragging, THE Panel_Layout_Store SHALL persist the new panel widths to local storage

### Requirement 2: 面板尺寸持久化

**User Story:** As a user, I want my panel layout preferences to be remembered, so that I don't have to readjust them every time I open the application.

#### Acceptance Criteria

1. WHEN the application starts, THE Panel_Layout_Store SHALL load saved panel widths from local storage
2. IF saved panel widths exist, THEN THE MainLayout SHALL apply them to the panel layout
3. IF no saved panel widths exist, THEN THE MainLayout SHALL use default widths (sidebar: 220px, preview: 500px)
4. WHEN panel widths are saved, THE Panel_Layout_Store SHALL store them as JSON in localStorage with key 'yuque-panel-layout'

### Requirement 3: 单节点折叠/展开

**User Story:** As a user, I want to collapse and expand individual folder nodes in the document tree, so that I can focus on specific sections.

#### Acceptance Criteria

1. WHEN a folder node has children, THE Document_Tree SHALL display a collapse/expand toggle icon
2. WHEN the user clicks the toggle icon on an expanded node, THE Tree_Node SHALL collapse and hide all its children
3. WHEN the user clicks the toggle icon on a collapsed node, THE Tree_Node SHALL expand and show all its direct children
4. WHEN a node is collapsed, THE Tree_Node SHALL display a right-pointing arrow icon
5. WHEN a node is expanded, THE Tree_Node SHALL display a down-pointing arrow icon

### Requirement 4: 一键全部折叠/展开

**User Story:** As a user, I want to collapse or expand all nodes at once, so that I can quickly navigate large document trees.

#### Acceptance Criteria

1. THE Document_Tree SHALL display toolbar buttons for "Collapse All" and "Expand All" actions
2. WHEN the user clicks "Collapse All", THE Document_Tree SHALL collapse all folder nodes in the tree
3. WHEN the user clicks "Expand All", THE Document_Tree SHALL expand all folder nodes in the tree
4. WHEN all nodes are already collapsed, THE "Collapse All" button SHALL remain functional but have no visible effect
5. WHEN all nodes are already expanded, THE "Expand All" button SHALL remain functional but have no visible effect

### Requirement 5: 折叠状态持久化

**User Story:** As a user, I want my collapse/expand preferences to be remembered per knowledge base, so that I can maintain my preferred view.

#### Acceptance Criteria

1. WHEN a node's collapse state changes, THE Document_Tree SHALL persist the state to local storage
2. WHEN the user switches to a different knowledge base, THE Document_Tree SHALL load the saved collapse states for that book
3. IF no saved collapse states exist for a book, THEN THE Document_Tree SHALL default to all nodes expanded
4. WHEN collapse states are saved, THE Document_Tree SHALL store them as JSON with key 'yuque-tree-collapse-{bookId}'
