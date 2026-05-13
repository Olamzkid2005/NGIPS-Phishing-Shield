import { cn } from '@/utils';

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  variant?: 'default' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'default' | 'lg';
  showLabel?: boolean;
}

const Progress = ({
  className,
  value,
  max = 100,
  variant = 'default',
  size = 'default',
  showLabel,
  ...props
}: ProgressProps) => {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  const variants = {
    default: 'bg-primary-600',
    success: 'bg-safe-600',
    warning: 'bg-warning-600',
    danger: 'bg-danger-600',
  };

  const sizes = {
    sm: 'h-1.5',
    default: 'h-2.5',
    lg: 'h-4',
  };

  return (
    <div className={cn('w-full', className)} {...props}>
      <div className={cn('w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700', sizes[size])}>
        <div
          className={cn('h-full rounded-full transition-all duration-300', variants[variant])}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <span className="mt-1 block text-xs text-gray-500">{percentage.toFixed(0)}%</span>
      )}
    </div>
  );
};

export { Progress };