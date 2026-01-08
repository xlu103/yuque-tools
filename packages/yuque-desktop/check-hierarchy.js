#!/usr/bin/env node

/**
 * 快速诊断脚本 - 检查文档层级功能
 * 
 * 使用方法：
 * node check-hierarchy.js
 */

const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');
const fs = require('fs');

// 获取数据库路径
function getDatabasePath() {
  const platform = os.platform();
  let dbPath;
  
  if (platform === 'darwin') {
    // macOS
    dbPath = path.join(os.homedir(), 'Library', 'Application Support', 'yuque-desktop', 'data', 'yuque-meta.db');
  } else if (platform === 'win32') {
    // Windows
    dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'yuque-desktop', 'data', 'yuque-meta.db');
  } else {
    // Linux
    dbPath = path.join(os.homedir(), '.config', 'yuque-desktop', 'data', 'yuque-meta.db');
  }
  
  return dbPath;
}

function main() {
  console.log('🔍 检查文档层级功能...\n');
  
  const dbPath = getDatabasePath();
  console.log(`📁 数据库路径: ${dbPath}`);
  
  if (!fs.existsSync(dbPath)) {
    console.log('❌ 数据库文件不存在！');
    console.log('   请先运行应用并登录同步。');
    return;
  }
  
  console.log('✅ 数据库文件存在\n');
  
  try {
    const db = new Database(dbPath, { readonly: true });
    
    // 检查 schema 版本
    console.log('📊 检查 Schema 版本:');
    const version = db.prepare('SELECT version FROM schema_version').get();
    console.log(`   当前版本: v${version.version}`);
    
    if (version.version < 5) {
      console.log('   ⚠️  版本过低！需要 v5 才支持层级功能。');
      console.log('   请重新启动应用以触发数据库迁移。\n');
    } else {
      console.log('   ✅ 版本正确\n');
    }
    
    // 检查文档表结构
    console.log('📋 检查文档表结构:');
    const columns = db.prepare("PRAGMA table_info(documents)").all();
    const hierarchyColumns = ['uuid', 'parent_uuid', 'child_uuid', 'doc_type', 'depth', 'sort_order'];
    
    hierarchyColumns.forEach(col => {
      const exists = columns.some(c => c.name === col);
      console.log(`   ${exists ? '✅' : '❌'} ${col}`);
    });
    console.log('');
    
    // 统计文档数据
    console.log('📈 文档统计:');
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        COUNT(uuid) as with_uuid,
        COUNT(parent_uuid) as with_parent,
        COUNT(CASE WHEN doc_type = 'TITLE' THEN 1 END) as folders,
        COUNT(CASE WHEN parent_uuid IS NOT NULL THEN 1 END) as children
      FROM documents
    `).get();
    
    console.log(`   总文档数: ${stats.total}`);
    console.log(`   有 UUID: ${stats.with_uuid} (${(stats.with_uuid/stats.total*100).toFixed(1)}%)`);
    console.log(`   有父文档: ${stats.with_parent} (${(stats.with_parent/stats.total*100).toFixed(1)}%)`);
    console.log(`   文件夹数: ${stats.folders}`);
    console.log(`   子文档数: ${stats.children}`);
    console.log('');
    
    // 显示层级示例
    if (stats.with_parent > 0) {
      console.log('🌳 层级结构示例:');
      const examples = db.prepare(`
        SELECT 
          d.title,
          d.doc_type,
          d.depth,
          p.title as parent_title
        FROM documents d
        LEFT JOIN documents p ON d.parent_uuid = p.uuid
        WHERE d.parent_uuid IS NOT NULL
        LIMIT 5
      `).all();
      
      examples.forEach(ex => {
        const indent = '  '.repeat(ex.depth);
        const icon = ex.doc_type === 'TITLE' ? '📁' : '📄';
        console.log(`   ${indent}${icon} ${ex.title}`);
        if (ex.parent_title) {
          console.log(`   ${indent}   └─ 父文档: ${ex.parent_title}`);
        }
      });
      console.log('');
    }
    
    // 检查知识库
    console.log('📚 知识库统计:');
    const books = db.prepare(`
      SELECT 
        b.name,
        COUNT(d.id) as doc_count,
        COUNT(CASE WHEN d.parent_uuid IS NOT NULL THEN 1 END) as with_hierarchy
      FROM books b
      LEFT JOIN documents d ON b.id = d.book_id
      GROUP BY b.id
      ORDER BY with_hierarchy DESC
      LIMIT 5
    `).all();
    
    books.forEach(book => {
      const percentage = book.doc_count > 0 ? (book.with_hierarchy/book.doc_count*100).toFixed(1) : 0;
      console.log(`   ${book.name}: ${book.with_hierarchy}/${book.doc_count} (${percentage}%) 有层级`);
    });
    console.log('');
    
    // 总结
    console.log('📝 诊断结果:');
    
    if (version.version < 5) {
      console.log('   ❌ 数据库版本过低，需要迁移到 v5');
    } else if (stats.total === 0) {
      console.log('   ⚠️  没有文档数据，请先同步知识库');
    } else if (stats.with_parent === 0) {
      console.log('   ⚠️  所有文档都没有层级信息');
      console.log('   建议：');
      console.log('   1. 选择一个知识库');
      console.log('   2. 点击"强制同步"按钮');
      console.log('   3. 等待同步完成后查看');
    } else {
      console.log('   ✅ 层级功能正常！');
      console.log(`   ${stats.children} 个文档有层级关系`);
      console.log(`   ${stats.folders} 个文件夹`);
    }
    
    db.close();
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
  }
}

main();
