interface MacProgressProps {
  value: number
  max?: number
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  label?: string
  className?: string
}

export function MacProgress({ 
  value, 
  max = 100, 
  size = 'md', 
  showLabel = false,
  label,
  className = '' 
}: MacProgressProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100))
  
  const heights = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3'
  }
  
  return (
    <div className={`w-full ${className}`}>
      {(showLabel || label) && (
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-xs text-text-secondary">{label || '进度'}</span>
          <span className="text-xs text-text-secondary">{Math.round(percentage)}%</span>
        </div>
      )}
      <div className={`w-full bg-bg-tertiary rounded-full overflow-hidden ${heights[size]}`}>
        <div 
          className="h-full bg-accent rounded-full transition-all duration-300 ease-mac"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
