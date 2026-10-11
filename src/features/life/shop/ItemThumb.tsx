/**
 * An item's picture, or the drawn stand-in while its file has not landed.
 * Presentation only; which picture is `itemArt.ts`.
 */
import {
  Bomb,
  Box,
  Bug,
  Crosshair,
  Droplet,
  Hammer,
  Lock,
  Package,
  Scissors,
  Shield,
  ShieldHalf,
  Shirt,
  Sparkles,
  Swords,
  Timer,
  ToggleRight,
  Volume2,
  Wind,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { itemArtSlug, itemPictures } from "./itemArt";

const ICONS: Record<string, LucideIcon> = {
  pistol: Crosshair,
  smg: Crosshair,
  rifle: Crosshair,
  shotgun: Crosshair,
  heavy: Bomb,
  exotic: Sparkles,
  melee: Swords,
  "armor-light": Shirt,
  "armor-heavy": ShieldHalf,
  shield: Shield,
  ammo: Box,
  gear: Package,
  "find-sound_puck": Volume2,
  "find-hush_wrap": Wind,
  "find-foam_cutters": Scissors,
  "find-gel_tube": Droplet,
  "find-relay_clip": ToggleRight,
  "find-timer_fuse": Timer,
  "find-crawler": Bug,
  "find-pneumatic_driver": Wrench,
  "find-tool_roll": Hammer,
  "find-lock_gun": Lock,
};

export function ItemThumb({
  kind,
  itemId,
  className,
  large = false,
  hot = false,
}: {
  kind: string;
  itemId: string;
  className?: string;
  /** The full-size picture rather than the 640px cut. */
  large?: boolean;
  hot?: boolean;
}) {
  // How many of this item's pictures have failed to load: each falls back to
  // the next. Kept against the id, so a thumb reused for another item starts over.
  const [failed, setFailed] = useState({ itemId, count: 0 });
  const count = failed.itemId === itemId ? failed.count : 0;
  const picture = itemPictures(kind, itemId, !large)[count] ?? null;
  const Icon = ICONS[itemArtSlug(kind, itemId)] ?? Package;
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-[radial-gradient(circle_at_50%_35%,rgba(161,92,255,0.28),rgba(13,10,31,0.95)_70%)]",
        hot &&
          "bg-[radial-gradient(circle_at_50%_35%,rgba(255,77,77,0.3),rgba(13,10,31,0.95)_70%)]",
        className,
      )}
    >
      {picture ? (
        <>
          {picture.fit === "contain" && (
            // The same picture, blurred to fill the frame behind the whole one.
            <img
              src={picture.url}
              alt=""
              aria-hidden
              loading="lazy"
              className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-md"
            />
          )}
          <img
            key={picture.url}
            src={picture.url}
            alt=""
            loading="lazy"
            className={cn(
              "absolute inset-0 h-full w-full",
              picture.fit === "contain" ? "object-contain p-[4%]" : "object-cover",
            )}
            style={picture.fit === "cover" ? { objectPosition: picture.focus } : undefined}
            onError={() => setFailed({ itemId, count: count + 1 })}
          />
        </>
      ) : (
        <Icon
          aria-hidden
          strokeWidth={1.25}
          className={cn(
            "absolute left-1/2 top-1/2 h-1/2 w-1/2 -translate-x-1/2 -translate-y-1/2 opacity-80",
            hot ? "text-danger" : "text-accent",
          )}
        />
      )}
    </div>
  );
}
