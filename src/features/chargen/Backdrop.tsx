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
  focus,
  drift = false,
  scrim,
  className,
}: {
  /** The uploaded file's name, without the extension. */
  name: string | null | undefined;
  /** Which side interface text sits on, so the scrim darkens it. */
  text?: "left" | "right" | "all";
  /** Where the crop centres, as CSS object-position, when the middle is the wrong part to keep. */
  focus?: string;
  /** A very slow push-in, for a scene the player sits on rather than a step's banner. */
  drift?: boolean;
  /** Replaces the default scrim, for a picture whose quiet side is narrower than half. */
  scrim?: string;
  className?: string;
}) {
  const url = name ? uploadedAsset(name) : null;
  if (!url) return null;
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0", className)}>
      <img
        src={url}
        alt=""
        style={focus ? { objectPosition: focus } : undefined}
        className={cn("h-full w-full object-cover", drift && "cg-drift")}
      />
      <div
        className={cn(
          "absolute inset-0",
          scrim ??
            cn(
              text === "left" &&
                "bg-gradient-to-r from-background via-background/85 to-background/30",
              text === "right" &&
                "bg-gradient-to-l from-background via-background/85 to-background/30",
              text === "all" && "bg-background/75",
            ),
        )}
      />
    </div>
  );
}
