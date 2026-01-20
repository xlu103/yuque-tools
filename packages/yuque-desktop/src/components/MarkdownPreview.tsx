import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
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
  isPanel?: boolean
  fontSize?: number
}

interface TocItem {
  id: string
  text: string
  level: number
}

// 从文本中移除 HTML 标签和 Markdown 格式，提取纯文本
function extractPlainText(text: string): string {
  // Remove HTML tags
  let plainText = text.replace(/<[^>]+>/g, '')
  
  // Remove markdown formatting
  plainText = plainText.replace(/[*_`\[\]]/g, '').trim()
  
  // Decode HTML entities
  plainText = plainText
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
  
  return plainText
}

// 从 React 子元素中提取纯文本（递归处理）
function extractTextFromChildren(children: any): string {
  if (typeof children === 'string') {
    return children
  }
  
  if (typeof children === 'number') {
    return String(children)
  }
  
  if (Array.isArray(children)) {
    return children.map(extractTextFromChildren).join('')
  }
  
  if (children && typeof children === 'object') {
    // React element
    if (children.props && children.props.children) {
      return extractTextFromChildren(children.props.children)
    }
  }
  
  return ''
}

// 从 Markdown 内容提取目录
function extractToc(content: string): TocItem[] {
  const headingRegex = /^(#{1,6})\s+(.+)$/gm
  const toc: TocItem[] = []
  let match
  
  while ((match = headingRegex.exec(content)) !== null) {
    const level = match[1].length
    const text = extractPlainText(match[2])
    const id = text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w\u4e00-\u9fa5-]/g, '')
    console.log('[TOC] raw:', match[2], 'text:', text, 'id:', id)
    toc.push({ id, text, level })
  }
  
  return toc
}

// 检测内容是否主要是 HTML（纯 HTML 文档）
function isHtmlContent(content: string): boolean {
  // 只有当内容以 HTML 文档标签开头时才认为是纯 HTML
  return content.trim().startsWith('<!DOCTYPE') || content.trim().startsWith('<html')
}

// 处理语雀特殊语法：:::info, :::warning 等
function processYuqueAdmonitions(content: string): string {
  // 匹配 :::type 内容 ::: 格式（支持单行和多行）
  // 单行格式: :::info 内容:::
  // 多行格式: :::info\n内容\n:::
  return content
    // 先处理多行格式
    .replace(
      /^:::(info|warning|danger|success|tip|note)?\s*\n([\s\S]*?)\n:::\s*$/gm,
      (_, type, text) => {
        const admonitionType = (type || 'info').toLowerCase()
        const config = getAdmonitionConfig(admonitionType)
        return `\n<div class="admonition ${config.className}"><span class="admonition-icon">${config.icon}</span><div class="admonition-content">\n\n${text.trim()}\n\n</div></div>\n`
      }
    )
    // 再处理单行格式
    .replace(
      /:::(info|warning|danger|success|tip|note)?\s*([^:]+?):::/gi,
      (_, type, text) => {
        const admonitionType = (type || 'info').toLowerCase()
        const config = getAdmonitionConfig(admonitionType)
        return `<div class="admonition ${config.className}"><span class="admonition-icon">${config.icon}</span><div class="admonition-content">${text.trim()}</div></div>`
      }
    )
}

function getAdmonitionConfig(type: string): { icon: string; className: string } {
  const typeConfig: Record<string, { icon: string; className: string }> = {
    info: { icon: 'ℹ️', className: 'admonition-info' },
    warning: { icon: '⚠️', className: 'admonition-warning' },
    danger: { icon: '🚨', className: 'admonition-danger' },
    success: { icon: '✅', className: 'admonition-success' },
    tip: { icon: '💡', className: 'admonition-tip' },
    note: { icon: '📝', className: 'admonition-note' },
  }
  return typeConfig[type] || typeConfig.info
}

// 处理分割线：确保 --- 被正确识别
function processHorizontalRules(content: string): string {
  return content.replace(/^---\s*$/gm, '\n---\n')
}

// 图片组件 - 通过 IPC 加载本地图片
// 图片查看器状态 - 使用简单的模块级状态避免 prop drilling
// let imageViewerState: { src: string; show: (src: string) => void } | null = null

// 图片查看器组件
function ImageViewer({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center cursor-zoom-out animate-fade-in"
      onClick={onClose}
    >
      <img src={src} alt="" className="max-w-[90vw] max-h-[90vh] object-contain" />
      <button 
        className="absolute top-4 right-4 text-white/70 hover:text-white p-2"
        onClick={onClose}
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

function LocalImage({ src, alt, fileDir, onImageClick }: { src?: string; alt?: string; fileDir: string; onImageClick?: (src: string) => void }) {
  const [imageSrc, setImageSrc] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!src) {
      setError(true)
      setLoading(false)
      return
    }

    // 如果是网络图片或 data URL，直接使用
    if (src.startsWith('http') || src.startsWith('data:')) {
      setImageSrc(src)
      setLoading(false)
      return
    }

    // 本地图片，通过 IPC 读取
    const loadImage = async () => {
      try {
        let fullPath: string
        if (src.startsWith('/') || src.match(/^[A-Za-z]:/)) {
          fullPath = src
        } else {
          const normalizedDir = fileDir.replace(/\\/g, '/')
          const normalizedSrc = src.replace(/\\/g, '/')
          fullPath = `${normalizedDir}/${normalizedSrc}`
        }
        
        const result = await window.electronAPI['file:readImage'](fullPath)
        if (result.success && result.dataUrl) {
          setImageSrc(result.dataUrl)
          setError(false)
        } else {
          setError(true)
        }
      } catch {
        setError(true)
      } finally {
        setLoading(false)
      }
    }

    loadImage()
  }, [src, fileDir])

  if (loading) {
    return <span className="inline-block w-16 h-16 bg-bg-tertiary rounded animate-pulse" />
  }

  if (error || !imageSrc) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 bg-bg-tertiary rounded text-xs text-text-tertiary">
        📷 图片加载失败
      </span>
    )
  }

  return (
    <img 
      src={imageSrc} 
      alt={alt || ''} 
      className="max-w-full h-auto rounded cursor-zoom-in hover:opacity-90 transition-opacity" 
      loading="lazy"
      onClick={() => onImageClick?.(imageSrc)}
    />
  )
}


export function MarkdownPreview({ 
  filePath, 
  title, 
  onClose,
  onOpenExternal,
  onShowInFolder,
  isPanel = false,
  fontSize = 16
}: MarkdownPreviewProps) {
  const isElectron = useIsElectron()
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewingImage, setViewingImage] = useState<string | null>(null)
  const [showToc, setShowToc] = useState(true)
  const contentRef = useRef<HTMLDivElement>(null)

  // 获取文件所在目录
  const fileDir = useMemo(() => {
    const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
    return filePath.substring(0, lastSlash)
  }, [filePath])

  // 提取目录
  const toc = useMemo(() => extractToc(content), [content])

  // 滚动到指定标题
  const scrollToHeading = useCallback((id: string) => {
    const el = contentRef.current?.querySelector(`[data-heading-id="${id}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  // 加载文件内容
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

  // 判断是否使用 HTML 渲染
  const useHtmlRender = useMemo(() => isHtmlContent(content), [content])
  
  // 预处理 Markdown 内容
  const processedContent = useMemo(() => {
    if (useHtmlRender) return content
    let processed = content
    processed = processHorizontalRules(processed)
    processed = processYuqueAdmonitions(processed)
    return processed
  }, [content, useHtmlRender])

  return (
    <div className={`flex flex-col bg-bg-primary ${isPanel ? 'h-full' : 'h-screen w-screen'}`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-bg-secondary">
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
            <button onClick={onShowInFolder} className="p-1.5 rounded hover:bg-bg-tertiary text-text-secondary hover:text-text-primary" title="在文件夹中显示">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </button>
          )}
          {onOpenExternal && (
            <button onClick={onOpenExternal} className="p-1.5 rounded hover:bg-bg-tertiary text-text-secondary hover:text-text-primary" title="用外部程序打开">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </button>
          )}
          {toc.length > 0 && (
            <button 
              onClick={() => setShowToc(!showToc)} 
              className={`p-1.5 rounded hover:bg-bg-tertiary transition-colors ${showToc ? 'text-accent' : 'text-text-secondary hover:text-text-primary'}`} 
              title="目录"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </button>
          )}
          <button onClick={loadContent} className="p-1.5 rounded hover:bg-bg-tertiary text-text-secondary hover:text-text-primary" title="刷新">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          {isPanel && (
            <button onClick={onClose} className="p-1.5 rounded hover:bg-bg-tertiary text-text-secondary hover:text-text-primary" title="关闭">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Content with TOC */}
      <div className="flex-1 flex overflow-hidden">
        {/* TOC Sidebar */}
        {showToc && toc.length > 0 && (
          <div className="w-56 flex-shrink-0 border-r border-border-light overflow-auto bg-bg-secondary/50 p-3">
            <div className="text-xs font-medium text-text-tertiary mb-2">目录</div>
            <nav className="space-y-0.5">
              {toc.map((item, i) => (
                <button
                  key={i}
                  onClick={() => scrollToHeading(item.id)}
                  className="block w-full text-left text-sm text-text-secondary hover:text-text-primary truncate py-1 hover:bg-bg-tertiary rounded px-2 transition-colors"
                  style={{ paddingLeft: `${(item.level - 1) * 12 + 8}px` }}
                  title={item.text}
                >
                  {item.text}
                </button>
              ))}
            </nav>
          </div>
        )}

        {/* Main Content */}
        <div ref={contentRef} className="flex-1 overflow-auto">
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
              <MacButton variant="secondary" size="sm" onClick={loadContent} className="mt-3">重试</MacButton>
          </div>
        ) : useHtmlRender ? (
          <article className="markdown-body p-6 prose prose-slate dark:prose-invert max-w-none" style={{ fontSize }} dangerouslySetInnerHTML={{ __html: content }} />
        ) : (
          <article className="markdown-body p-6 prose prose-slate dark:prose-invert max-w-none" style={{ fontSize }}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              components={{
                img: ({ src, alt }) => <LocalImage src={src} alt={alt} fileDir={fileDir} onImageClick={setViewingImage} />,
                a: ({ href, children }) => (
                  <a href={href} className="text-accent hover:underline" target="_blank" rel="noopener noreferrer">{children}</a>
                ),
                code: ({ className, children, ...props }) => {
                  if (!className) {
                    return <code className="px-1.5 py-0.5 bg-bg-tertiary rounded text-sm font-mono text-red-600" {...props}>{children}</code>
                  }
                  return <code className={`${className} block`} {...props}>{children}</code>
                },
                pre: ({ children }) => <pre className="bg-bg-tertiary p-4 rounded-lg overflow-x-auto text-sm">{children}</pre>,
                table: ({ children }) => <div className="overflow-x-auto my-4"><table className="min-w-full border-collapse border border-border">{children}</table></div>,
                th: ({ children }) => <th className="border border-border bg-bg-secondary px-4 py-2 text-left font-medium">{children}</th>,
                td: ({ children }) => <td className="border border-border px-4 py-2">{children}</td>,
                blockquote: ({ children }) => <blockquote className="border-l-4 border-accent pl-4 my-4 text-text-secondary italic">{children}</blockquote>,
                ul: ({ children }) => <ul className="list-disc pl-6 my-2 space-y-1">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-6 my-2 space-y-1">{children}</ol>,
                li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                h1: ({ children }) => {
                  const rawText = extractTextFromChildren(children)
                  const text = extractPlainText(rawText)
                  const id = text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w\u4e00-\u9fa5-]/g, '')
                  console.log('[H1] rawText:', rawText, 'text:', text, 'id:', id)
                  return <h1 data-heading-id={id} className="text-2xl font-bold mt-6 mb-4 pb-2 border-b border-border">{children}</h1>
                },
                h2: ({ children }) => {
                  const rawText = extractTextFromChildren(children)
                  const text = extractPlainText(rawText)
                  const id = text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w\u4e00-\u9fa5-]/g, '')
                  console.log('[H2] rawText:', rawText, 'text:', text, 'id:', id)
                  return <h2 data-heading-id={id} className="text-xl font-bold mt-5 mb-3 pb-1 border-b border-border-light">{children}</h2>
                },
                h3: ({ children }) => {
                  const rawText = extractTextFromChildren(children)
                  const text = extractPlainText(rawText)
                  const id = text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w\u4e00-\u9fa5-]/g, '')
                  console.log('[H3] rawText:', rawText, 'text:', text, 'id:', id)
                  return <h3 data-heading-id={id} className="text-lg font-semibold mt-4 mb-2">{children}</h3>
                },
                h4: ({ children }) => {
                  const rawText = extractTextFromChildren(children)
                  const text = extractPlainText(rawText)
                  const id = text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w\u4e00-\u9fa5-]/g, '')
                  console.log('[H4] rawText:', rawText, 'text:', text, 'id:', id)
                  return <h4 data-heading-id={id} className="text-base font-semibold mt-3 mb-2">{children}</h4>
                },
                p: ({ children }) => <p className="my-3 leading-relaxed">{children}</p>,
                hr: () => <hr className="my-6 border-t border-border" />,
                input: ({ type, checked }) => {
                  if (type === 'checkbox') {
                    return <input type="checkbox" checked={checked} readOnly className="mr-2 rounded border-border" />
                  }
                  return <input type={type} />
                },
              }}
            >
              {processedContent}
            </ReactMarkdown>
          </article>
        )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-border-light bg-bg-secondary">
        <p className="text-xs text-text-tertiary truncate" title={filePath}>{filePath}</p>
      </div>

      {/* Image Viewer */}
      {viewingImage && <ImageViewer src={viewingImage} onClose={() => setViewingImage(null)} />}
    </div>
  )
}
