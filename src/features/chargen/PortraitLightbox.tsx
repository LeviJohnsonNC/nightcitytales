import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * A full-size portrait lightbox. Clicking the portrait opens it in a modal
 * with a neon-noir styled border. Works for generated portraits and
 * static placeholder art.
 */
export function PortraitLightbox({
  src,
  alt,
  subtitle,
  children,
  className,
}: {
  src: string | null | undefined;
  alt: string;
  subtitle?: string | undefined;
  children: React.ReactNode;
  className?: string | undefined;
}) {
  const [open, setOpen] = useState(false);
  if (!src) return <>{children}</>;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`group relative block cursor-pointer text-left ${className ?? ""}`}
        aria-label={`Open ${alt} full size`}
      >
        {children}
        <span className="pointer-events-none absolute inset-0 border border-ember/0 transition-colors duration-200 group-hover:border-ember/60" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[90vw] border-0 bg-transparent p-0 shadow-none sm:max-w-3xl">
          <DialogTitle className="sr-only">{alt}</DialogTitle>
          <div className="relative mx-auto aspect-[3/4] w-full max-w-xl overflow-hidden border border-hairline bg-surface shadow-2xl shadow-black/70">
            <img
              src={src}
              alt={alt}
              className="h-full w-full object-contain"
            />
            {/* Neon-noir border treatment */}
            <div className="pointer-events-none absolute inset-0 border-[6px] border-surface/80" />
            <div className="pointer-events-none absolute inset-0 border border-ember/40" />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-ember/60 to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-ember/60 to-transparent" />
          </div>
          {subtitle && (
            <p className="text-center font-mono text-[10px] uppercase tracking-[0.2em] text-text-dim">
              {subtitle}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
