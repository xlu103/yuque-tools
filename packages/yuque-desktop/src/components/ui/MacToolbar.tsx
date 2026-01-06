import { ReactNode } from 'react'

interface MacToolbarProps {
  children: ReactNode
  className?: string
}

export function MacToolbar({ children, className = '' }: MacToolbarProps) {
  return (
    <div className={`
      h-[52px] flex items-center justify-between px-4
      border-b border-border-light
      bg-bg-primary
      titlebar-drag-region
      ${className}
    `}>
      <div className="flex items-center gap-2 no-drag">
        {children}
      </div>
    </div>
  )
}

interface ToolbarGroupProps {
  children: ReactNode
  className?: string
}

export function ToolbarGroup({ children, className = '' }: ToolbarGroupProps) {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {children}
    </div>
  )
}

interface ToolbarDividerProps {
  className?: string
}

export function ToolbarDivider({ className = '' }: ToolbarDividerProps) {
  return (
    <div className={`w-px h-5 bg-border-light mx-2 ${className}`} />
  )
}

interface ToolbarTitleProps {
  children: ReactNode
  className?: string
}

export function ToolbarTitle({ children, className = '' }: ToolbarTitleProps) {
  return (
    <h1 className={`text-sm font-semibold text-text-primary ${className}`}>
      {children}
    </h1>
  )
}
