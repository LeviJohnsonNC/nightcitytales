import { cn } from "@/lib/utils";
import { uploadedAsset } from "./art";

/**
 * A large image behind interface text: a fixer's venue, a scene, a chapter.
 *
 * Every backdrop is an uploaded file named in `docs/art-style.md`, and until it
 * has been uploaded this renders nothing, so each screen keeps its plain look
 * and the art can arrive in any order. The scrim darkens the side the text sits
 * on; the art guide asks for that side of the picture to be the quiet one too.
 */
export function Backdrop({
  name,
  text = "left",
  className,
}: {
  /** The uploaded file's name, without the extension. */
  name: string | null | undefined;
  /** Which side interface text sits on, so the scrim darkens it. */
  text?: "left" | "right" | "all";
  className?: string;
}) {
  const url = name ? uploadedAsset(name) : null;
  if (!url) return null;
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0", className)}>
      <img src={url} alt="" className="h-full w-full object-cover" />
      <div
        className={cn(
          "absolute inset-0",
          text === "left" && "bg-gradient-to-r from-background via-background/85 to-background/30",
          text === "right" && "bg-gradient-to-l from-background via-background/85 to-background/30",
          text === "all" && "bg-background/75",
        )}
      />
    </div>
  );
}
