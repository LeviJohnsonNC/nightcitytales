/**
 * One face, drawn one way.
 *
 * The keeper behind a counter, a person in the room, a walk-on at the bar and
 * the name card on hover were each drawing a picture of a person their own way,
 * which is much of why the faces felt bolted on. This is the plate they share: a
 * square with the Counter's violet backing, the picture anchored to the head
 * (every portrait here composes the face high in the frame), a ring that can
 * carry how they feel about the character, and initials when there is no picture
 * or it fails to load.
 *
 * Presentation only. It is told what to draw and decides nothing.
 */
import { useState } from "react";
import { cn } from "@/lib/utils";
import { initialsOf } from "./faceInitials";

export function FacePlate({
  src,
  srcSet,
  sizes,
  name,
  alt = "",
  ringClass,
  className,
}: {
  src?: string | null | undefined;
  srcSet?: string | undefined;
  sizes?: string | undefined;
  /** Who it is, for the initials when the picture is missing. */
  name: string;
  /** What a screen reader hears. Empty when the caption beside it already says. */
  alt?: string;
  /** A ring colour from the disposition bands, when the face is somebody the character knows. */
  ringClass?: string | undefined;
  /** Size and shape come from the caller: `size-14`, `size-20`. */
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const picture = failed ? null : (src ?? null);
  return (
    <span
      className={cn(
        "relative block shrink-0 overflow-hidden border-2 bg-[radial-gradient(circle_at_50%_30%,rgba(161,92,255,0.35),rgba(13,10,31,0.95)_70%)]",
        ringClass ?? "border-hairline/70",
        className,
      )}
    >
      {picture ? (
        <img
          src={picture}
          {...(srcSet ? { srcSet } : {})}
          {...(sizes ? { sizes } : {})}
          alt={alt}
          className="absolute inset-0 h-full w-full object-cover object-top"
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          aria-hidden
          className="absolute inset-0 grid place-items-center font-display text-lg font-extrabold text-accent"
        >
          {initialsOf(name)}
        </span>
      )}
    </span>
  );
}
