import { cn } from '@/lib/utils';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

const Skeleton = ({ className, ...props }: SkeletonProps): JSX.Element => {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />;
};

export { Skeleton };
