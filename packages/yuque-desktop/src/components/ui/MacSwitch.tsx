import { forwardRef, InputHTMLAttributes } from 'react'

interface MacSwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  label?: string
  description?: string
  checked?: boolean
  onChange?: (checked: boolean) => void
}

export const MacSwitch = forwardRef<HTMLInputElement, MacSwitchProps>(
  ({ label, description, checked = false, onChange, disabled, className = '', id, ...props }, ref) => {
    const switchId = id || label?.toLowerCase().replace(/\s+/g, '-')
    
    return (
      <label 
        htmlFor={switchId}
        className={`flex items-start gap-3 cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      >
        <div className="relative flex-shrink-0 mt-0.5">
          <input
            ref={ref}
            type="checkbox"
            id={switchId}
            checked={checked}
            disabled={disabled}
            onChange={(e) => onChange?.(e.target.checked)}
            className="sr-only peer"
            {...props}
          />
          <div className={`
            w-10 h-6 rounded-full
            transition-colors duration-200 ease-mac
            ${checked ? 'bg-accent' : 'bg-border'}
            peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-1
          `} />
          <div className={`
            absolute top-0.5 left-0.5
            w-5 h-5 rounded-full bg-white
            shadow-sm
            transition-transform duration-200 ease-mac
            ${checked ? 'translate-x-4' : 'translate-x-0'}
          `} />
        </div>
        {(label || description) && (
          <div className="flex flex-col">
            {label && (
              <span className="text-sm font-medium text-text-primary">{label}</span>
            )}
            {description && (
              <span className="text-xs text-text-secondary mt-0.5">{description}</span>
            )}
          </div>
        )}
      </label>
    )
  }
)

MacSwitch.displayName = 'MacSwitch'
