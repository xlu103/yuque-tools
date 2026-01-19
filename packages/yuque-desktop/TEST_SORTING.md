# 知识库排序功能测试指南

## 功能说明

知识库现在会按照**最近访问时间**自动排序（置顶区域除外）。

## 测试步骤

### 1. 启动应用
```bash
cd packages/yuque-desktop
npm run dev
```

### 2. 测试排序

**初始状态**：
- 所有知识库按名称 A-Z 排序（因为都没有访问记录）

**操作**：
1. 点击知识库 A
2. 点击知识库 B  
3. 点击知识库 C
4. 再次点击知识库 A

**预期结果**：
- 知识库 A 应该排在最前面（最近访问）
- 知识库 C 排第二
- 知识库 B 排第三
- 其他未访问的知识库按名称排序

### 3. 验证持久化

1. 关闭应用
2. 重新打开应用
3. 知识库顺序应该保持不变

### 4. 检查 localStorage

打开浏览器开发者工具（如果是 Electron 应用，按 Cmd+Option+I）：

```javascript
// 查看存储的数据
JSON.parse(localStorage.getItem('yuque-book-organize'))

// 应该看到类似这样的结构：
{
  "pinnedBookIds": [],
  "groups": [],
  "lastAccessedTimes": {
    "book-id-1": 1234567890123,
    "book-id-2": 1234567890456,
    "book-id-3": 1234567890789
  }
}
```

## 排序规则

```
📌 置顶区域（手动排序，不受影响）
├─ 知识库 A
└─ 知识库 B

📁 分组 1（按访问时间排序）
├─ 知识库 C (2分钟前访问) ⬅️ 最新
├─ 知识库 D (1小时前访问)
└─ 知识库 E (未访问，按名称)

📚 其他知识库（按访问时间排序）
├─ 知识库 F (刚刚访问) ⬅️ 最新
├─ 知识库 G (昨天访问)
└─ 知识库 H (未访问，按名称)
```

## 如果功能没生效

1. **清除缓存**：
   ```javascript
   localStorage.removeItem('yuque-book-organize')
   ```

2. **检查控制台**：看是否有错误信息

3. **重新编译**：
   ```bash
   npm run build
   npm run dev
   ```

4. **验证代码**：
   - 检查 `bookOrganizeStore.ts` 是否有 `lastAccessedTimes`
   - 检查 `BookList.tsx` 是否有排序逻辑
   - 检查 `MainLayout.tsx` 是否调用了 `handleSelectBook`
