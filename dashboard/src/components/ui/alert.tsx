import { cn } from '@/utils';

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger';
  title?: string;
}

const Alert = ({ className, variant = 'default', title, children, ...props }: AlertProps) => {
  const variants = {
    default: 'border-gray-300 bg-gray-50 text-gray-800 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100',
    success: 'border-safe-300 bg-safe-50 text-safe-800 dark:border-safe-700 dark:bg-safe-900/30 dark:text-safe-200',
    warning: 'border-warning-300 bg-warning-50 text-warning-800 dark:border-warning-700 dark:bg-warning-900/30 dark:text-warning-200',
    danger: 'border-danger-300 bg-danger-50 text-danger-800 dark:border-danger-700 dark:bg-danger-900/30 dark:text-danger-200',
  };

  const icons = {
    default: '💡',
    success: '✅',
    warning: '⚠️',
    danger: '🚨',
  };

  return (
    <div
      className={cn(
        'relative flex gap-3 rounded-lg border p-4',
        variants[variant],
        className
      )}
      role="alert"
      {...props}
    >
      <span className="text-xl">{icons[variant]}</span>
      <div className="flex-1">
        {title && <h4 className="mb-1 font-semibold">{title}</h4>}
        <div className="text-sm opacity-90">{children}</div>
      </div>
    </div>
  );
};

export { Alert };