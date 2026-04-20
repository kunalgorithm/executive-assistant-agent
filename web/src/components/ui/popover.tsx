import { useState, useRef, useEffect, type ReactNode, type PropsWithChildren } from 'react';

import { cn } from '@/lib/utils';

type PopoverProps = PropsWithChildren<{ trigger: ReactNode; className?: string; align?: 'left' | 'right' }>;
export function Popover({ align = 'right', ...props }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setOpen(false);
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  return (
    <div ref={popoverRef} className="relative">
      <div onClick={() => setOpen((o) => !o)}>{props.trigger}</div>
      {open && (
        <div
          className={cn(
            'absolute top-full mt-1 z-50 rounded-lg bg-admin-surface border border-admin-border shadow-xl',
            align === 'right' ? 'right-0' : 'left-0',
            props.className,
          )}
        >
          {props.children}
        </div>
      )}
    </div>
  );
}
