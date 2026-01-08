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
  isPanel?: boolean
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
function LocalImage({ src, alt, fileDir }: { src?: string; alt?: string; fileDir: string }) {
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
        // 构建完整路径 - Windows 使用反斜杠
        let fullPath: string
        if (src.startsWith('/') || src.match(/^[A-Za-z]:/)) {
          fullPath = src
        } else {
          // 相对路径，拼接目录
          fullPath = `${fileDir}\\${src.replace(/\//g, '\\')}`
        }
        
        console.log('[LocalImage] Loading:', fullPath)
        const result = await window.electronAPI['file:readImage'](fullPath)
        if (result.success && result.dataUrl) {
          setImageSrc(result.dataUrl)
        } else {
          console.error('[LocalImage] Failed:', result.error)
          setError(true)
        }
      } catch (err) {
        console.error('[LocalImage] Error:', err)
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

  return <img src={imageSrc} alt={alt || ''} className="max-w-full h-auto rounded" loading="lazy" />
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

  // 获取文件所在目录
  const fileDir = useMemo(() => {
    // Windows 路径保持反斜杠
    const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
    return filePath.substring(0, lastSlash)
  }, [filePath])

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
            <MacButton variant="secondary" size="sm" onClick={loadContent} className="mt-3">重试</MacButton>
          </div>
        ) : useHtmlRender ? (
          <article className="markdown-body p-6 max-w-4xl mx-auto prose prose-slate dark:prose-invert" dangerouslySetInnerHTML={{ __html: content }} />
        ) : (
          <article className="markdown-body p-6 max-w-4xl mx-auto prose prose-slate dark:prose-invert">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              components={{
                img: ({ src, alt }) => <LocalImage src={src} alt={alt} fileDir={fileDir} />,
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
                h1: ({ children }) => <h1 className="text-2xl font-bold mt-6 mb-4 pb-2 border-b border-border">{children}</h1>,
                h2: ({ children }) => <h2 className="text-xl font-bold mt-5 mb-3 pb-1 border-b border-border-light">{children}</h2>,
                h3: ({ children }) => <h3 className="text-lg font-semibold mt-4 mb-2">{children}</h3>,
                h4: ({ children }) => <h4 className="text-base font-semibold mt-3 mb-2">{children}</h4>,
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

      {/* Footer */}
      <div className="px-4 py-2 border-t border-border-light bg-bg-secondary">
        <p className="text-xs text-text-tertiary truncate" title={filePath}>{filePath}</p>
      </div>
    </div>
  )
}
