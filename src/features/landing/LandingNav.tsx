import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

const SECTIONS = [
  { id: "the-game", label: "The Game" },
  { id: "life", label: "Life" },
  { id: "jobs", label: "Jobs" },
  { id: "combat", label: "Combat" },
];

/**
 * Minimal floating nav. Absent over the hero, fades in once the user scrolls.
 */
export function LandingNav({ signedIn }: { signedIn: boolean }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > window.innerHeight * 0.72);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b border-hairline/60 backdrop-blur-md transition-opacity duration-500 ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
      style={{ background: "rgba(9,7,22,0.82)" }}
    >
      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-3 sm:px-8">
        <div className="flex min-w-0 items-center gap-8">
          <a
            href="#top"
            className="shrink-0 font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-text"
          >
            Night City Tales
          </a>
          <nav className="hidden items-center gap-6 lg:flex">
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="font-mono text-[10px] uppercase tracking-[0.24em] text-text-dim transition-colors hover:text-ember"
              >
                {s.label}
              </a>
            ))}
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {!signedIn ? (
            <Link
              to="/login"
              className="hidden font-mono text-[10px] uppercase tracking-[0.24em] text-text-dim transition-colors hover:text-text sm:block"
            >
              Sign in
            </Link>
          ) : null}
          <Link
            to={signedIn ? "/roster" : "/login"}
            className="inline-flex h-8 items-center rounded-sm bg-ember px-4 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-ground transition-colors hover:bg-ember-deep"
          >
            {signedIn ? "Continue story" : "Start story"}
          </Link>
        </div>
      </div>
    </header>
  );
}
