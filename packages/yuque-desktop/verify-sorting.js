#!/usr/bin/env node

/**
 * 验证知识库排序功能是否正确实现
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 验证知识库排序功能...\n');

// 检查文件是否存在
const files = [
  'src/stores/bookOrganizeStore.ts',
  'src/components/BookList.tsx',
  'src/components/MainLayout.tsx'
];

let allFilesExist = true;
files.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} 不存在`);
    allFilesExist = false;
  }
});

if (!allFilesExist) {
  console.log('\n❌ 部分文件缺失');
  process.exit(1);
}

console.log('\n📝 检查关键代码...\n');

// 检查 bookOrganizeStore.ts
const storeContent = fs.readFileSync(path.join(__dirname, 'src/stores/bookOrganizeStore.ts'), 'utf8');
const checks = [
  { name: 'lastAccessedTimes 字段', pattern: /lastAccessedTimes:\s*Record<string,\s*number>/ },
  { name: 'updateLastAccessed 方法', pattern: /updateLastAccessed:\s*\(bookId:\s*string\)\s*=>\s*void/ },
  { name: 'getLastAccessed 方法', pattern: /getLastAccessed:\s*\(bookId:\s*string\)\s*=>\s*number/ },
  { name: 'updateLastAccessed 实现', pattern: /updateLastAccessed:\s*\(bookId:\s*string\)\s*=>\s*\{/ },
  { name: 'Date.now() 调用', pattern: /Date\.now\(\)/ }
];

checks.forEach(check => {
  if (check.pattern.test(storeContent)) {
    console.log(`✅ ${check.name}`);
  } else {
    console.log(`❌ ${check.name} 未找到`);
  }
});

// 检查 BookList.tsx
const bookListContent = fs.readFileSync(path.join(__dirname, 'src/components/BookList.tsx'), 'utf8');
const bookListChecks = [
  { name: 'getLastAccessed 引用', pattern: /getLastAccessed/ },
  { name: '排序逻辑 (ungrouped)', pattern: /ungrouped\.sort/ },
  { name: '排序逻辑 (grouped)', pattern: /grouped\.forEach.*sort/ }
];

console.log('');
bookListChecks.forEach(check => {
  if (check.pattern.test(bookListContent)) {
    console.log(`✅ ${check.name}`);
  } else {
    console.log(`❌ ${check.name} 未找到`);
  }
});

// 检查 MainLayout.tsx
const mainLayoutContent = fs.readFileSync(path.join(__dirname, 'src/components/MainLayout.tsx'), 'utf8');
const mainLayoutChecks = [
  { name: 'useBookOrganizeStore 导入', pattern: /useBookOrganizeStore/ },
  { name: 'updateLastAccessed 引用', pattern: /updateLastAccessed/ },
  { name: 'handleSelectBook 函数', pattern: /handleSelectBook/ }
];

console.log('');
mainLayoutChecks.forEach(check => {
  if (check.pattern.test(mainLayoutContent)) {
    console.log(`✅ ${check.name}`);
  } else {
    console.log(`❌ ${check.name} 未找到`);
  }
});

console.log('\n✨ 验证完成！\n');
console.log('📌 下一步：');
console.log('1. 运行 npm run dev 启动应用');
console.log('2. 点击几个不同的知识库');
console.log('3. 观察知识库列表是否按最近访问时间排序');
console.log('4. 打开开发者工具，查看 localStorage.getItem("yuque-book-organize")');
