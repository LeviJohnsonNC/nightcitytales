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
import { itemArtSlug, itemArtUrl } from "./itemArt";

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
  const [failed, setFailed] = useState(false);
  const url = failed ? null : itemArtUrl(kind, itemId, !large);
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
      {url ? (
        <img
          src={url}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
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
