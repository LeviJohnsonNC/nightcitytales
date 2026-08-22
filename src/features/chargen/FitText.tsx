import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface FitTextProps {
  children: React.ReactNode;
  /** Minimum scale factor applied to the inherited font size. */
  min?: number;
  className?: string;
  as?: "h3" | "p" | "span" | "div";
}

/**
 * Renders a single line of text, shrinking the font size (never below `min`)
 * so it fits the available width instead of truncating with an ellipsis.
 */
export function FitText({ children, min = 0.6, className, as = "span" }: FitTextProps) {
  const Tag = as;
  const outerRef = useRef<HTMLElement | null>(null);
  const innerRef = useRef<HTMLSpanElement | null>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const measure = () => {
      const available = outer.clientWidth;
      if (!available) return;
      // Measure at natural size by resetting first.
      inner.style.fontSize = "100%";
      const needed = inner.scrollWidth;
      const next = needed > available ? Math.max(min, available / needed) : 1;
      inner.style.fontSize = `${next * 100}%`;
      setScale(next);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(outer);
    return () => ro.disconnect();
  }, [children, min, scale]);

  return (
    <Tag ref={outerRef as never} className={cn("block min-w-0 overflow-hidden", className)}>
      <span ref={innerRef} className="block whitespace-nowrap">
        {children}
      </span>
    </Tag>
  );
}
