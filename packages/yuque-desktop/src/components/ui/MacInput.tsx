import { InputHTMLAttributes, forwardRef } from 'react'

interface MacInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export const MacInput = forwardRef<HTMLInputElement, MacInputProps>(
  ({ label, error, hint, className = '', id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
    
    return (
      <div className="w-full">
        {label && (
          <label 
            htmlFor={inputId}
            className="block text-sm font-medium text-text-primary mb-1.5"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`
            w-full px-3 py-2 text-sm
            bg-bg-primary text-text-primary
            border rounded-md
            transition-all duration-150 ease-mac
            placeholder:text-text-tertiary
            focus:outline-none focus:ring-2 focus:ring-offset-1
            ${error 
              ? 'border-error focus:ring-error' 
              : 'border-border focus:border-accent focus:ring-accent'
            }
            disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-bg-secondary
            ${className}
          `}
          {...props}
        />
        {error && (
          <p className="mt-1.5 text-xs text-error">{error}</p>
        )}
        {hint && !error && (
          <p className="mt-1.5 text-xs text-text-secondary">{hint}</p>
        )}
      </div>
    )
  }
)

MacInput.displayName = 'MacInput'
