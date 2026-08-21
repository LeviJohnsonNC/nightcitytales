import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { getCurrentUser, onAuthChange, signOut, type AuthUser } from "@/lib/backend";
import homepageArt from "@/assets/homepage-skyline-v2.png.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Night City Tales · Cyberpunk RED Character Builder" },
      {
        name: "description",
        content:
          "Build Cyberpunk RED characters the right way: guided, rules-accurate, and fast. Roll an edgerunner and keep your whole crew saved to your account.",
      },
      { property: "og:title", content: "Night City Tales · Cyberpunk RED Character Builder" },
      {
        property: "og:description",
        content:
          "Build Cyberpunk RED characters the right way: guided, rules-accurate, and fast. Roll an edgerunner and keep your whole crew saved to your account.",
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
            "linear-gradient(90deg, rgba(13,10,31,0.96) 0%, rgba(13,10,31,0.88) 40%, rgba(13,10,31,0.55) 70%, rgba(13,10,31,0.25) 100%)",
        }}
      />
      {/* Bottom vignette to ground the content against the skyline. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(to top, rgba(13,10,31,0.85) 0%, rgba(13,10,31,0.35) 35%, transparent 70%)",
        }}
      />

      <div className="relative z-10 mx-auto w-full max-w-5xl px-6 py-16">
        <div className="max-w-2xl">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.35em] text-ember text-glow">
            Cyberpunk RED
          </p>
          <h1 className="mt-4 max-w-3xl font-display text-5xl leading-[0.95] tracking-[-0.02em] text-chrome sm:text-7xl">
            Night City Tales
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-text-muted">
            Build an edgerunner for Cyberpunk RED, one honest roll at a time. The math is real,
            the dice don't cheat, and your whole crew stays saved to your account. Night City is
            not going to survive itself.
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
        </div>
      </div>
    </main>
  );
}
