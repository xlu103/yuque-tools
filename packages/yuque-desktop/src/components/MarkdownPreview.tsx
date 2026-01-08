import { useState, useEffect, useCallback, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { MacButton } from './ui/MacButton'
import { useIsElectron } from '../hooks'

interface MarkdownPreviewProps {
  filePath: string
  title: string
  onClose: () => void
  onOpenExternal?: () => void
  onShowInFolder?: () => void
  isPanel?: boolean  // 是否为边栏模式
}

// 检测内容是否主要是 HTML（包含大量 HTML 标签）
function isHtmlContent(content: string): boolean {
  // 检测是否包含 HTML 特有的标签或属性
  const htmlPatterns = [
    /<font\s+style=/i,
    /<span\s+style=/i,
    /<div\s+style=/i,
    /style="[^"]*color:/i,
    /style="[^"]*background/i,
  ]
  return htmlPatterns.some(pattern => pattern.test(content))
}

// 处理 HTML 内容中的相对路径图片
function processHtmlImages(html: string, baseDir: string): string {
  return html.replace(
    /(<img[^>]*\ssrc=["'])(?!http|data:|file:\/\/)([^"']+)(["'][^>]*>)/gi,
    `$1file://${baseDir}/$2$3`
  )
}

export function MarkdownPreview({ 
  filePath, 
  title, 
  onClose,
  onOpenExternal,
  onShowInFolder,
  isPanel = false
}: MarkdownPreviewProps) {
  const isElectron = useIsElectron()
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 获取文件所在目录，用于处理相对路径
  const fileDir = useMemo(() => {
    return filePath.substring(0, filePath.lastIndexOf('/'))
  }, [filePath])

  // Load file content
  const loadContent = useCallback(async () => {
    if (!isElectron || !filePath) return
    
    setLoading(true)
    setError(null)
    
    try {
      const result = await window.electronAPI['file:readContent'](filePath)
      if (result.success && result.content) {
        setContent(result.content)
      } else {
        setError(result.error || '读取文件失败')
      }
    } catch (err) {
      setError('读取文件失败')
      console.error('Failed to read file:', err)
    } finally {
      setLoading(false)
    }
  }, [isElectron, filePath])

  useEffect(() => {
    loadContent()
  }, [loadContent])

  // 处理图片路径，将相对路径转换为 file:// 协议
  const processImageSrc = useCallback((src: string | undefined): string => {
    if (!src) return ''
    if (src.startsWith('http') || src.startsWith('data:') || src.startsWith('file://')) {
      return src
    }
    // 相对路径转换为绝对路径
    return `file://${fileDir}/${src}`
  }, [fileDir])

  // 判断是否使用 HTML 渲染
  const useHtmlRender = useMemo(() => isHtmlContent(content), [content])
  
  // 处理后的 HTML 内容
  const processedHtml = useMemo(() => {
    if (!useHtmlRender) return ''
    return processHtmlImages(content, fileDir)
  }, [content, fileDir, useHtmlRender])

  return (
    <div className={`flex flex-col bg-bg-primary ${isPanel ? 'h-full' : 'h-screen w-screen'}`}>
      {/* Header */}
      <div className={`flex items-center gap-2 px-3 py-2 border-b border-border bg-bg-secondary`}>
        {!isPanel && (
          <div className="pl-16">
            <MacButton variant="ghost" size="sm" onClick={onClose}>
              <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              返回
            </MacButton>
          </div>
        )}
        
        <h3 className={`text-sm font-medium text-text-primary truncate ${isPanel ? 'flex-1' : ''}`} title={title}>
          {title}
        </h3>
        
        <div className="flex items-center gap-1 ml-auto">
          {onShowInFolder && (
            <button
              onClick={onShowInFolder}
              className="p-1.5 rounded hover:bg-bg-tertiary text-text-secondary hover:text-text-primary"
              title="在文件夹中显示"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </button>
          )}
          {onOpenExternal && (
            <button
              onClick={onOpenExternal}
              className="p-1.5 rounded hover:bg-bg-tertiary text-text-secondary hover:text-text-primary"
              title="用外部程序打开"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </button>
          )}
          <button
            onClick={loadContent}
            className="p-1.5 rounded hover:bg-bg-tertiary text-text-secondary hover:text-text-primary"
            title="刷新"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          {isPanel && (
            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-bg-tertiary text-text-secondary hover:text-text-primary"
              title="关闭"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full">
            <svg className="w-12 h-12 text-error mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-text-secondary">{error}</p>
            <MacButton variant="secondary" size="sm" onClick={loadContent} className="mt-3">
              重试
            </MacButton>
          </div>
        ) : useHtmlRender ? (
          // HTML 渲染模式 - 直接渲染 HTML 以保留内联样式
          <article 
            className="markdown-body p-6 max-w-4xl mx-auto prose prose-slate dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: processedHtml }}
          />
        ) : (
          // Markdown 渲染模式
          <article className="markdown-body p-6 max-w-4xl mx-auto prose prose-slate dark:prose-invert">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              components={{
                // 自定义图片渲染，处理相对路径
                img: ({ src, alt, ...props }) => (
                  <img 
                    src={processImageSrc(src)} 
                    alt={alt} 
                    {...props} 
                    className="max-w-full h-auto rounded" 
                    loading="lazy"
                  />
                ),
                // 自定义链接渲染
                a: ({ href, children, ...props }) => (
                  <a 
                    href={href} 
                    {...props} 
                    className="text-accent hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {children}
                  </a>
                ),
                // 代码块样式
                code: ({ className, children, ...props }) => {
                  const isInline = !className
                  if (isInline) {
                    return (
                      <code className="px-1.5 py-0.5 bg-bg-tertiary rounded text-sm font-mono text-red-600" {...props}>
                        {children}
                      </code>
                    )
                  }
                  return (
                    <code className={`${className} block`} {...props}>
                      {children}
                    </code>
                  )
                },
                // 预格式化代码块
                pre: ({ children, ...props }) => (
                  <pre className="bg-bg-tertiary p-4 rounded-lg overflow-x-auto text-sm" {...props}>
                    {children}
                  </pre>
                ),
                // 表格样式
                table: ({ children, ...props }) => (
                  <div className="overflow-x-auto my-4">
                    <table className="min-w-full border-collapse border border-border" {...props}>
                      {children}
                    </table>
                  </div>
                ),
                th: ({ children, ...props }) => (
                  <th className="border border-border bg-bg-secondary px-4 py-2 text-left font-medium" {...props}>
                    {children}
                  </th>
                ),
                td: ({ children, ...props }) => (
                  <td className="border border-border px-4 py-2" {...props}>
                    {children}
                  </td>
                ),
                // 引用块
                blockquote: ({ children, ...props }) => (
                  <blockquote className="border-l-4 border-accent pl-4 my-4 text-text-secondary italic" {...props}>
                    {children}
                  </blockquote>
                ),
                // 列表样式
                ul: ({ children, ...props }) => (
                  <ul className="list-disc pl-6 my-2 space-y-1" {...props}>
                    {children}
                  </ul>
                ),
                ol: ({ children, ...props }) => (
                  <ol className="list-decimal pl-6 my-2 space-y-1" {...props}>
                    {children}
                  </ol>
                ),
                li: ({ children, ...props }) => (
                  <li className="leading-relaxed" {...props}>
                    {children}
                  </li>
                ),
                // 标题样式
                h1: ({ children, ...props }) => (
                  <h1 className="text-2xl font-bold mt-6 mb-4 pb-2 border-b border-border" {...props}>
                    {children}
                  </h1>
                ),
                h2: ({ children, ...props }) => (
                  <h2 className="text-xl font-bold mt-5 mb-3 pb-1 border-b border-border-light" {...props}>
                    {children}
                  </h2>
                ),
                h3: ({ children, ...props }) => (
                  <h3 className="text-lg font-semibold mt-4 mb-2" {...props}>
                    {children}
                  </h3>
                ),
                h4: ({ children, ...props }) => (
                  <h4 className="text-base font-semibold mt-3 mb-2" {...props}>
                    {children}
                  </h4>
                ),
                // 段落
                p: ({ children, ...props }) => (
                  <p className="my-3 leading-relaxed" {...props}>
                    {children}
                  </p>
                ),
                // 水平线
                hr: ({ ...props }) => (
                  <hr className="my-6 border-border" {...props} />
                ),
                // 任务列表
                input: ({ type, checked, ...props }) => {
                  if (type === 'checkbox') {
                    return (
                      <input 
                        type="checkbox" 
                        checked={checked} 
                        readOnly 
                        className="mr-2 rounded border-border"
                        {...props}
                      />
                    )
                  }
                  return <input type={type} {...props} />
                },
              }}
            >
              {content}
            </ReactMarkdown>
          </article>
        )}
      </div>

      {/* Footer - file path */}
      <div className="px-4 py-2 border-t border-border-light bg-bg-secondary">
        <p className="text-xs text-text-tertiary truncate" title={filePath}>
          {filePath}
        </p>
      </div>
    </div>
  )
}
