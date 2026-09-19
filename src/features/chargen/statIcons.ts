/**
 * One icon per STAT.
 *
 * The sheet's STAT cards used to carry a band chevron — up, down, double-up —
 * which said the same thing as the colour beside it and nothing about which
 * STAT you were looking at. These say what the STAT IS, so a card is
 * recognisable before its three letters are read.
 *
 * Presentation only, and deliberately not in the engine: what REF means to the
 * rules is a number, and this is a picture of it.
 */
import {
  Anchor,
  Brain,
  Clover,
  Dumbbell,
  Flame,
  Footprints,
  Hand,
  Heart,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { StatKey } from "@/engine";

export const STAT_ICONS: Record<StatKey, LucideIcon> = {
  int: Brain,
  ref: Zap,
  dex: Hand,
  tech: Wrench,
  // Nerve under fire rather than temperature.
  cool: Flame,
  will: Anchor,
  luck: Clover,
  move: Footprints,
  body: Dumbbell,
  emp: Heart,
};
