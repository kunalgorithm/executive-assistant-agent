import { cn } from '@/lib/utils';

export function LoadingSpinner(props: Readonly<{ className?: string; text?: string }>) {
  return (
    <div className={cn('min-h-[50vh] flex items-center justify-center', props.className)}>
      <div className="flex flex-col items-center gap-4" role="status" aria-live="polite" aria-busy="true">
        <div className="relative">
          <span
            className="block h-8 w-8 animate-spin rounded-full border-2 border-primary/20 border-t-primary"
            aria-hidden="true"
          />
          <span className="absolute inset-0 rounded-full animate-pulse-slow bg-primary/5" aria-hidden="true" />
        </div>
        <p className="text-sm text-muted-foreground tracking-tight font-instrument">
          {props.text || 'loading'}
          <span className="inline-flex ml-0.5 gap-px">
            <span className="animate-bounce [animation-delay:0ms]">.</span>
            <span className="animate-bounce [animation-delay:150ms]">.</span>
            <span className="animate-bounce [animation-delay:300ms]">.</span>
          </span>
        </p>
      </div>
    </div>
  );
}
