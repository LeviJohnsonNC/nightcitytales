/**
 * Ambient weather for the landing key art. Purely decorative: drifting rain,
 * slow fog, an occasional AV headlight sweep. No glitch, no scanlines.
 */
export function Atmosphere({ rain = true, av = true }: { rain?: boolean; av?: boolean }) {
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
      {rain ? <div className="lp-rain absolute -inset-[20%]" /> : null}
      {av ? (
        <div className="lp-av absolute left-0 top-[44%] h-px w-[14vw] opacity-40">
          <div
            className="h-px w-full"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(255,225,180,0.35) 75%, rgba(255,245,220,0.6) 100%)",
              boxShadow: "0 0 8px 1px rgba(255,220,170,0.2)",
            }}
          />
        </div>

      ) : null}
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
