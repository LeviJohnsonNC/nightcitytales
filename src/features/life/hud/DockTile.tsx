import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A square action tile for the dock: an icon, a short word, and an optional
 * badge. It is the trigger of a sheet, so it forwards its ref and props.
 */
export const DockTile = forwardRef<
  HTMLButtonElement,
  { icon: ReactNode; label: string; badge?: string | null } & Omit<
    ComponentPropsWithoutRef<"button">,
    "children"
  >
>(function DockTile({ icon, label, badge, className, ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      {...props}
      className={cn(
        "group relative flex min-h-20 flex-col items-center justify-center gap-1.5 border border-hairline bg-surface/60 text-sm font-medium transition-[border-color,box-shadow,transform] hover:border-accent/70 hover:shadow-[0_0_14px_-4px_var(--color-accent)] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-accent motion-reduce:transition-none",
        className,
      )}
    >
      <span aria-hidden className="text-accent transition-transform group-hover:scale-110">
        {icon}
      </span>
      <span>{label}</span>
      {badge && (
        <span className="absolute right-1.5 top-1.5 bg-ember px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-background">
          {badge}
        </span>
      )}
    </button>
  );
});
