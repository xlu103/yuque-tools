import { ReactNode } from 'react'

interface MacSidebarProps {
  children: ReactNode
  className?: string
  topContent?: ReactNode
  bottomContent?: ReactNode
}

export function MacSidebar({ children, className = '', topContent, bottomContent }: MacSidebarProps) {
  return (
    <aside className={`mac-sidebar flex flex-col ${className}`}>
      {/* Titlebar drag region for traffic lights */}
      <div className="h-[52px] flex-shrink-0 titlebar-drag-region" />
      
      {/* Fixed top content */}
      {topContent && (
        <div className="flex-shrink-0 px-3 pb-2">
          {topContent}
        </div>
      )}
      
      {/* Sidebar content - scrollable */}
      <div className="flex-1 overflow-y-auto px-3 min-h-0">
        {children}
      </div>
      
      {/* Fixed bottom content */}
      {bottomContent && (
        <div className="flex-shrink-0 px-3 pb-4 pt-2 border-t border-border-light">
          {bottomContent}
        </div>
      )}
    </aside>
  )
}

interface SidebarSectionProps {
  title?: string
  children: ReactNode
  className?: string
}

export function SidebarSection({ title, children, className = '' }: SidebarSectionProps) {
  return (
    <div className={`mb-4 ${className}`}>
      {title && (
        <h3 className="px-2 mb-2 text-xs font-semibold text-text-secondary uppercase tracking-wider">
          {title}
        </h3>
      )}
      <div className="space-y-0.5">
        {children}
      </div>
    </div>
  )
}

interface SidebarItemProps {
  icon?: ReactNode
  label: string
  badge?: string | number
  selected?: boolean
  onClick?: () => void
  className?: string
}

export function SidebarItem({ 
  icon, 
  label, 
  badge, 
  selected = false, 
  onClick,
  className = '' 
}: SidebarItemProps) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-2 px-2 py-1.5 rounded-md
        text-sm text-left
        transition-colors duration-150 ease-mac
        ${selected 
          ? 'bg-accent text-white' 
          : 'text-text-primary hover:bg-bg-tertiary'
        }
        ${className}
      `}
    >
      {icon && (
        <span className={`flex-shrink-0 ${selected ? 'text-white' : 'text-text-secondary'}`}>
          {icon}
        </span>
      )}
      <span className="flex-1 truncate">{label}</span>
      {badge !== undefined && (
        <span className={`
          flex-shrink-0 px-1.5 py-0.5 text-xs rounded-full
          ${selected 
            ? 'bg-white/20 text-white' 
            : 'bg-bg-tertiary text-text-secondary'
          }
        `}>
          {badge}
        </span>
      )}
    </button>
  )
}
