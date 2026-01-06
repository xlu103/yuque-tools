import { ButtonHTMLAttributes, forwardRef } from 'react'

interface MacButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

export const MacButton = forwardRef<HTMLButtonElement, MacButtonProps>(
  ({ variant = 'primary', size = 'md', loading, disabled, className = '', children, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center font-medium transition-all duration-150 ease-mac rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1'
    
    const variants = {
      primary: 'bg-accent text-white hover:bg-accent-hover active:bg-accent-active focus-visible:ring-accent',
      secondary: 'bg-bg-tertiary text-text-primary hover:bg-border-light active:bg-border focus-visible:ring-border',
      ghost: 'bg-transparent text-text-primary hover:bg-bg-tertiary active:bg-border-light focus-visible:ring-border',
      danger: 'bg-error text-white hover:opacity-90 active:opacity-80 focus-visible:ring-error'
    }
    
    const sizes = {
      sm: 'px-3 py-1 text-xs',
      md: 'px-4 py-1.5 text-sm',
      lg: 'px-5 py-2 text-base'
    }
    
    const disabledStyles = 'opacity-50 cursor-not-allowed pointer-events-none'
    
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${disabled || loading ? disabledStyles : ''} ${className}`}
        {...props}
      >
        {loading && (
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        )}
        {children}
      </button>
    )
  }
)

MacButton.displayName = 'MacButton'
