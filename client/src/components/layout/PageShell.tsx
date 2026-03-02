import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageShellProps = {
  kicker?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  canopyClassName?: string;
};

export function PageShell({
  kicker,
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
  canopyClassName,
}: PageShellProps) {
  return (
    <div className={cn("min-h-screen rsf-app-shell", className)}>
      <section className={cn("rsf-page-canopy", canopyClassName)}>
        <div className="container mx-auto px-4 py-10 sm:py-12">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-4xl space-y-3">
              {kicker ? (
                <span className="rsf-kicker border-white/12 bg-white/8 text-slate-100">
                  {kicker}
                </span>
              ) : null}
              <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
                {title}
              </h1>
              {description ? (
                <div className="max-w-3xl text-sm text-slate-200/90 sm:text-base">
                  {description}
                </div>
              ) : null}
            </div>
            {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
          </div>
        </div>
      </section>

      <section className={cn("container mx-auto px-4 py-8 sm:py-10", contentClassName)}>
        {children}
      </section>
    </div>
  );
}
