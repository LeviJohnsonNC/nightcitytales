import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Gentle scroll reveal. Elements fade and rise once, then stay put.
 *
 * It wraps its child in a block of its own — a `div`, or an `li` when the thing
 * revealed is a list item. A `div` between an `ol` and its `li`s leaves the list
 * with children it is not allowed to have and the items with no list, which a
 * screen reader reads as neither (found by the browser tests' axe scan).
 */
export function Reveal({
  children,
  delay = 0,
  className,
  as = "div",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "li";
}) {
  const Tag = as as "div";
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            observer.disconnect();
          }
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.08 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={`lp-reveal ${shown ? "is-in" : ""} ${className ?? ""}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
}
