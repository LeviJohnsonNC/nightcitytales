/**
 * Ambient weather for the landing key art. Purely decorative: slow fog and
 * occasional AV headlight sweeps. No rain, no glitch, no scanlines.
 */

const AV_SWEEPS = [
  { top: "32%", duration: "17s", delay: "0s", width: "14vw", opacity: 0.4, drift: "-3vh" },
  { top: "58%", duration: "23s", delay: "6s", width: "10vw", opacity: 0.28, drift: "-2vh" },
  { top: "71%", duration: "29s", delay: "12s", width: "8vw", opacity: 0.2, drift: "-1.5vh" },
];

export function Atmosphere({ av = true }: { av?: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Fog banks, drifting slowly across the mid-ground. */}
      <div
        className="lp-fog absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 55% 30% at 30% 78%, rgba(150,170,255,0.14), transparent 70%), radial-gradient(ellipse 45% 25% at 70% 90%, rgba(255,61,154,0.08), transparent 70%)",
        }}
      />
      {av
        ? AV_SWEEPS.map((s) => (
            <div
              key={s.top}
              className="lp-av absolute left-0 h-px"
              style={
                {
                  top: s.top,
                  width: s.width,
                  opacity: s.opacity,
                  animationDuration: s.duration,
                  animationDelay: s.delay,
                  "--lp-av-drift": s.drift,
                } as React.CSSProperties
              }
            >
              <div
                className="h-px w-full"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, rgba(255,225,180,0.35) 75%, rgba(255,245,220,0.6) 100%)",
                  boxShadow: "0 0 8px 1px rgba(255,220,170,0.2)",
                }}
              />
            </div>
          ))
        : null}
    </div>
  );
}

/** A small signage plate that flickers now and then, like a failing tube. */
export function SignFlicker({
  className,
  slow = false,
  color = "rgba(52,213,230,0.8)",
}: {
  className?: string;
  slow?: boolean;
  color?: string;
}) {
  return (
    <div
      aria-hidden
      className={`${slow ? "lp-flicker-slow" : "lp-flicker"} pointer-events-none absolute ${className ?? ""}`}
      style={{ background: color, filter: "blur(14px)" }}
    />
  );
}

/*
 * Windows catching the last of the light: tiny warm specks that glint on and
 * off at staggered intervals. Kept to the skyline — the band across the top
 * and the far edges — so none of them land on the character in the hero.
 * Positions are percentages of the hero frame.
 */
const GLINTS: Array<{
  left: string;
  top: string;
  size: number;
  delay: string;
  duration: string;
  color: string;
}> = [
  // Top skyline band, across the frame.
  { left: "12%", top: "11%", size: 2, delay: "0s", duration: "7s", color: "rgba(255,214,150,0.9)" },
  {
    left: "21%",
    top: "8%",
    size: 2,
    delay: "2.4s",
    duration: "9s",
    color: "rgba(255,230,190,0.85)",
  },
  {
    left: "30%",
    top: "13%",
    size: 3,
    delay: "5.1s",
    duration: "8s",
    color: "rgba(255,200,130,0.9)",
  },
  {
    left: "38%",
    top: "7%",
    size: 2,
    delay: "1.2s",
    duration: "11s",
    color: "rgba(255,235,200,0.8)",
  },
  {
    left: "47%",
    top: "10%",
    size: 2,
    delay: "6.8s",
    duration: "7s",
    color: "rgba(255,214,150,0.9)",
  },
  {
    left: "51%",
    top: "4%",
    size: 2,
    delay: "3.3s",
    duration: "10s",
    color: "rgba(255,225,170,0.8)",
  },
  {
    left: "84%",
    top: "5%",
    size: 2,
    delay: "7.9s",
    duration: "9s",
    color: "rgba(255,214,150,0.9)",
  },
  {
    left: "88%",
    top: "11%",
    size: 3,
    delay: "1.8s",
    duration: "8s",
    color: "rgba(255,225,170,0.85)",
  },
  // Left mid-ground towers (behind the copy scrim — reads as distant city).
  {
    left: "6%",
    top: "32%",
    size: 2,
    delay: "3.9s",
    duration: "10s",
    color: "rgba(255,214,150,0.7)",
  },
  {
    left: "15%",
    top: "41%",
    size: 2,
    delay: "6.2s",
    duration: "7s",
    color: "rgba(255,200,130,0.7)",
  },
  {
    left: "26%",
    top: "28%",
    size: 2,
    delay: "0.4s",
    duration: "11s",
    color: "rgba(255,235,200,0.65)",
  },
  {
    left: "33%",
    top: "47%",
    size: 2,
    delay: "8.6s",
    duration: "9s",
    color: "rgba(255,214,150,0.7)",
  },
  // Far right edge — the sliver of skyline past the character's shoulder.
  {
    left: "96%",
    top: "22%",
    size: 2,
    delay: "2.1s",
    duration: "8s",
    color: "rgba(255,230,190,0.85)",
  },
  {
    left: "98%",
    top: "38%",
    size: 2,
    delay: "5.6s",
    duration: "10s",
    color: "rgba(255,200,130,0.8)",
  },
  {
    left: "95%",
    top: "52%",
    size: 2,
    delay: "1.5s",
    duration: "7s",
    color: "rgba(255,214,150,0.75)",
  },
];

export function WindowGlints() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {GLINTS.map((g) => (
        <div
          key={`${g.left}-${g.top}`}
          className="lp-glint absolute rounded-full"
          style={{
            left: g.left,
            top: g.top,
            width: g.size,
            height: g.size,
            background: g.color,
            boxShadow: `0 0 ${g.size * 3}px ${g.size}px ${g.color}`,
            animationDelay: g.delay,
            animationDuration: g.duration,
          }}
        />
      ))}
    </div>
  );
}
