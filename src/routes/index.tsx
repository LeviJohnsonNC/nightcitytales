import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { getCurrentUser, onAuthChange, signOut, type AuthUser } from "@/lib/backend";
import homepageArt from "@/assets/homepage-skyline.png.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Night City Tales — Cyberpunk RED Character Builder" },
      {
        name: "description",
        content:
          "Roll up Cyberpunk RED characters with a guided wizard and keep your whole roster saved to your account.",
      },
      { property: "og:title", content: "Night City Tales — Cyberpunk RED Character Builder" },
      {
        property: "og:description",
        content:
          "Roll up Cyberpunk RED characters with a guided wizard and keep your whole roster saved to your account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthChange(setUser);
    void getCurrentUser().then(setUser);
    return unsubscribe;
  }, []);

  return (
    <main className="relative flex min-h-screen w-full items-center overflow-hidden">
      {/* Key art. The figure and car sit on the right third, so we anchor there. */}
      <img
        src={homepageArt.url}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover"
        style={{ objectPosition: "75% 50%" }}
      />
      {/* Left-to-right scrim: ground dominates the text side, then opens toward the city. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(90deg, rgba(20,16,19,0.96) 0%, rgba(20,16,19,0.88) 40%, rgba(20,16,19,0.55) 70%, rgba(20,16,19,0.25) 100%)",
        }}
      />
      {/* Bottom vignette to ground the content against the skyline. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(to top, rgba(20,16,19,0.85) 0%, rgba(20,16,19,0.35) 35%, transparent 70%)",
        }}
      />

      <div className="relative z-10 mx-auto w-full max-w-5xl px-6 py-16">
        <div className="max-w-2xl">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.35em] text-ember">
            Cyberpunk RED
          </p>
          <h1 className="mt-4 max-w-3xl font-display text-5xl leading-[0.95] tracking-[-0.02em] text-text sm:text-7xl">
            Night City Tales
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-text-muted">
            A character builder for Cyberpunk RED. Roll up an edgerunner step by step, keep the
            math honest, and keep your whole roster saved to your account.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            {user ? (
              <>
                <Button asChild size="lg">
                  <Link to="/roster">Go to roster</Link>
                </Button>
                <Button variant="ghost" onClick={() => void signOut()}>
                  Sign out
                </Button>
                <span className="font-mono text-xs uppercase tracking-widest text-text-dim">
                  {user.email}
                </span>
              </>
            ) : (
              <Button asChild size="lg">
                <Link to="/login">Sign in</Link>
              </Button>
            )}
          </div>

          <dl className="mt-16 grid max-w-2xl grid-cols-3 gap-px border border-hairline bg-hairline">
            {[
              { k: "Roles", v: "10" },
              { k: "Build methods", v: "3" },
              { k: "Steps", v: "11" },
            ].map((s) => (
              <div key={s.k} className="bg-surface/90 px-4 py-5 backdrop-blur-[2px]">
                <dt className="font-mono text-[10px] uppercase tracking-[0.25em] text-text-muted">
                  {s.k}
                </dt>
                <dd className="num mt-2 text-3xl font-semibold text-text">{s.v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </main>
  );
}
