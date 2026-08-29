import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { getCurrentUser, onAuthChange, type AuthUser } from "@/lib/backend";
import { Atmosphere, SignFlicker, WindowGlints } from "@/features/landing/Atmosphere";
import { Reveal } from "@/features/landing/Reveal";
import { LandingNav } from "@/features/landing/LandingNav";
import heroArt from "@/assets/hero-one.jpg.asset.json";
import lifeArt from "@/assets/hero-two.jpg.asset.json";
import fixerArt from "@/assets/hero-three.jpg.asset.json";
import alleyArt from "@/assets/hero-four.jpg.asset.json";
import combatArt from "@/assets/hero-five.jpg.asset.json";
import streetArt from "@/assets/hero-six.jpg.asset.json";
import dawnArt from "@/assets/hero-seven.jpg.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Night City Tales · Live Your Life in Night City" },
      {
        name: "description",
        content:
          "A solo Cyberpunk RED campaign run by an AI Game Master. Take dangerous jobs, build relationships, make enemies, and live with everything that follows.",
      },
      { property: "og:title", content: "Night City Tales · Live Your Life in Night City" },
      {
        property: "og:description",
        content:
          "A solo Cyberpunk RED campaign run by an AI Game Master. Take dangerous jobs, build relationships, make enemies, and live with everything that follows.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

/* ---------- small shared pieces ---------- */

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.34em] text-text-dim">
      {children}
    </p>
  );
}

function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`border border-hairline/70 bg-surface/60 backdrop-blur-sm ${className ?? ""}`}
      style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)" }}
    >
      {children}
    </div>
  );
}

/* ---------- page ---------- */

function Index() {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthChange(setUser);
    void getCurrentUser().then(setUser);
    return unsubscribe;
  }, []);

  const signedIn = Boolean(user);
  const startLabel = signedIn ? "Continue your story" : "Start your story";
  const startTo = signedIn ? "/roster" : "/login";

  return (
    <div id="top" className="relative w-full overflow-x-hidden">
      <LandingNav signedIn={signedIn} />

      {/* ============================ 1. HERO ============================ */}
      <section className="relative min-h-[100svh] w-full overflow-hidden">
        <img
          src={heroArt.url}
          alt=""
          aria-hidden
          className="lp-drift absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: "72% 45%" }}
        />
        {/* Copy-side scrim: heavy left, opening toward the skyline. */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(90deg, rgba(8,6,20,0.97) 0%, rgba(9,7,24,0.9) 34%, rgba(10,8,26,0.5) 62%, rgba(10,8,26,0.15) 100%)",
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(to top, rgba(8,6,20,0.92) 0%, rgba(8,6,20,0.3) 32%, transparent 65%)",
          }}
        />
        {/* Signage glow — kept to the skyline and copy-side scrim, never on the
            character (the jacket occupies the center-right of the frame). */}
        <SignFlicker className="right-[3%] top-[14%] h-14 w-8 rounded-full" />
        <SignFlicker
          slow
          className="right-[10%] top-[6%] h-8 w-12 rounded-full"
          color="rgba(255,61,154,0.6)"
        />
        <SignFlicker
          className="right-[2%] top-[34%] h-6 w-10 rounded-full"
          color="rgba(161,92,255,0.6)"
        />
        <SignFlicker
          slow
          className="right-[26%] top-[9%] h-5 w-14 rounded-full"
          color="rgba(255,177,77,0.5)"
        />
        <SignFlicker
          className="right-[44%] top-[5%] h-10 w-5 rounded-full"
          color="rgba(52,213,230,0.55)"
        />
        <SignFlicker
          slow
          className="left-[8%] top-[24%] h-9 w-12 rounded-full"
          color="rgba(255,61,154,0.5)"
        />
        <SignFlicker
          className="left-[22%] top-[52%] h-5 w-10 rounded-full"
          color="rgba(52,213,230,0.5)"
        />
        <SignFlicker
          slow
          className="left-[4%] top-[70%] h-6 w-8 rounded-full"
          color="rgba(255,177,77,0.45)"
        />
        <WindowGlints />
        <Atmosphere />

        <div className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-6xl items-center px-5 py-24 sm:px-8">
          <div className="lp-boot w-full max-w-xl lg:max-w-[45%]">
            <Eyebrow>A solo RPG powered by an AI Game Master</Eyebrow>
            <h1 className="mt-5 pb-[0.08em] font-display text-[2.75rem] leading-[1.04] tracking-[-0.03em] text-chrome sm:text-6xl xl:text-7xl">
              Live your life in Night City.
            </h1>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-text-muted sm:text-lg">
              Take dangerous jobs. Build relationships. Make enemies. Fight to survive. And live
              with everything that follows.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-5">
              <Button asChild size="lg" className="uppercase tracking-[0.18em]">
                <Link to={startTo}>{startLabel}</Link>
              </Button>
              <a
                href="#the-game"
                className="font-mono text-[11px] uppercase tracking-[0.22em] text-text-muted transition-colors hover:text-text"
              >
                See how it plays ↓
              </a>
            </div>

            <p className="mt-10 font-mono text-[10px] uppercase tracking-[0.24em] text-text-dim">
              Built on Cyberpunk RED · Solo play · Persistent campaign
            </p>
          </div>
        </div>
      </section>

      {/* ======================= 2. WHAT IS THIS ======================= */}
      <section id="the-game" className="relative border-t border-hairline/50 py-24 sm:py-32">
        <div className="mx-auto max-w-5xl px-5 text-center sm:px-8">
          <Reveal>
            <h2 className="mx-auto max-w-3xl font-display text-3xl leading-[1.12] tracking-[-0.03em] text-text sm:text-5xl">
              Not a chatbot. A world that plays back.
            </h2>
          </Reveal>
          <Reveal delay={80}>
            <div className="mx-auto mt-8 max-w-2xl space-y-4 text-base leading-relaxed text-text-muted">
              <p>
                Night City Tales is a solo Cyberpunk RED campaign where an AI Game Master runs a
                persistent world around your character.
              </p>
              <p>
                Your friends remember you. Your enemies remember you. Rent comes due. Armor gets
                shredded. Deals go bad. Jobs have consequences.
              </p>
            </div>
          </Reveal>

          <div className="mt-16 grid gap-4 text-left md:grid-cols-3">
            {[
              {
                key: "LIVE",
                body: "Wake up wounded. Your landlord wants rent. Your ripperdoc has something interesting for sale. Your fixer keeps calling.",
              },
              {
                key: "WORK",
                body: "Take jobs on your terms. Investigate. Negotiate. Improvise. Walk away if the money isn't worth the blood.",
              },
              {
                key: "SURVIVE",
                body: "When violence starts, combat becomes tactical. Position. Cover. Range. Armor. Ammunition. Consequences.",
              },
            ].map((card, i) => (
              <Reveal key={card.key} delay={120 + i * 90}>
                <Panel className="h-full p-6">
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.3em] text-cool">
                    {card.key}
                  </p>
                  <p className="mt-4 text-sm leading-relaxed text-text-muted">{card.body}</p>
                </Panel>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============================= 3. LIFE ============================= */}
      <section id="life" className="relative border-t border-hairline/50 py-24 sm:py-32">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <div className="relative overflow-hidden border border-hairline">
              <img
                src={lifeArt.url}
                alt="A cramped Night City apartment at night, rain on the window, gear spread across the table"
                className="h-full w-full object-cover"
                loading="lazy"
              />
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  backgroundImage:
                    "linear-gradient(to top, rgba(8,6,20,0.9) 0%, rgba(8,6,20,0.15) 45%, transparent 75%)",
                }}
              />
              <Atmosphere av={false} />
              <div className="absolute inset-x-0 bottom-0 grid grid-cols-2 gap-2 p-4 sm:grid-cols-4">
                {[
                  { label: "Rent due", value: "3 days", tone: "text-amber" },
                  { label: "Razor", value: "Wants to talk", tone: "text-ember" },
                  { label: "Armor SP", value: "6 / 11", tone: "text-cool" },
                  { label: "Balance", value: "€$740", tone: "text-amber" },
                ].map((chip) => (
                  <div
                    key={chip.label}
                    className="border border-hairline/80 bg-ground/80 px-3 py-2 backdrop-blur-sm"
                  >
                    <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-text-dim">
                      {chip.label}
                    </p>
                    <p className={`num mt-1 text-[13px] font-semibold ${chip.tone}`}>
                      {chip.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal delay={90}>
            <div>
              <Eyebrow>Life</Eyebrow>
              <h2 className="mt-5 font-display text-3xl leading-[1.1] tracking-[-0.03em] text-text sm:text-4xl">
                You're not always on a mission. You're alive.
              </h2>
              <div className="mt-6 space-y-4 text-base leading-relaxed text-text-muted">
                <p>Jobs are only part of your story.</p>
                <p>
                  Between gigs, Night City keeps moving. Spend time with people you care about.
                  Repair your gear. Chase rumors. Pay your rent. Visit your ripperdoc. Get drunk.
                  Make promises. Break them.
                </p>
                <p className="text-text">
                  Ignore a problem today and it may be waiting outside your apartment tomorrow.
                </p>
              </div>
              <p className="mt-8 inline-block border-l-2 border-ember pl-4 font-mono text-[11px] uppercase tracking-[0.26em] text-text">
                Your life. Your priorities.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ==================== 4. NIGHT CITY REMEMBERS ==================== */}
      <section
        className="relative border-t border-hairline/50 py-24 sm:py-32"
        style={{ background: "#06050f" }}
      >
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <Reveal>
            <div className="text-center">
              <Eyebrow>Every choice leaves a mark</Eyebrow>
              <h2 className="mt-5 font-display text-3xl leading-[1.1] tracking-[-0.03em] text-text sm:text-5xl">
                Night City remembers.
              </h2>
            </div>
          </Reveal>

          <div className="mt-16 grid items-center gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <Reveal delay={80}>
              <div className="relative mx-auto max-w-sm">
                <div
                  aria-hidden
                  className="absolute -inset-6 rounded-full opacity-60 blur-3xl"
                  style={{
                    background:
                      "radial-gradient(circle at 50% 50%, rgba(255,61,154,0.22), transparent 65%)",
                  }}
                />
                <img
                  src={fixerArt.url}
                  alt="A fixer waiting at a bar, city lights behind the glass"
                  className="relative w-full border border-hairline object-cover"
                  loading="lazy"
                />
                <div className="relative mt-4 space-y-3 text-sm leading-relaxed text-text-muted">
                  <p>Help someone and they may come back months later.</p>
                  <p>Screw over a fixer and your calls may stop getting answered.</p>
                  <p>Leave witnesses and somebody may start asking questions.</p>
                  <p className="text-text">
                    The campaign keeps track of the people, promises, debts, injuries and enemies
                    you accumulate.
                  </p>
                </div>
              </div>
            </Reveal>

            <div className="grid gap-4 sm:grid-cols-2">
              <Reveal delay={140}>
                <Panel className="h-full p-5">
                  <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-text-dim">
                    Razor
                  </p>
                  <p className="num mt-3 text-lg font-semibold text-cool">Trust 4 / 6</p>
                  <div className="mt-2 flex gap-1">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <span
                        key={i}
                        className={`h-1 flex-1 ${i < 4 ? "bg-cool" : "bg-hairline"}`}
                        aria-hidden
                      />
                    ))}
                  </div>
                  <p className="mt-3 text-sm text-text-muted">You showed up when it mattered.</p>
                </Panel>
              </Reveal>
              <Reveal delay={200}>
                <Panel className="h-full p-5">
                  <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-text-dim">
                    Arasaka investigation
                  </p>
                  <p className="mt-3 font-mono text-lg tracking-[0.3em] text-amber">● ● ● ○ ○ ○</p>
                  <p className="mt-3 text-sm text-text-muted">
                    Someone is looking for the prototype.
                  </p>
                </Panel>
              </Reveal>
              <Reveal delay={260}>
                <Panel className="h-full p-5">
                  <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-text-dim">
                    Rent
                  </p>
                  <p className="num mt-3 text-lg font-semibold text-amber">2 days</p>
                  <p className="mt-3 text-sm text-text-muted">€$600 due.</p>
                </Panel>
              </Reveal>
              <Reveal delay={320}>
                <Panel className="h-full p-5">
                  <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-text-dim">
                    Viktor
                  </p>
                  <p className="mt-3 font-mono text-lg uppercase tracking-[0.12em] text-text">
                    Owed a favor
                  </p>
                  <p className="mt-3 text-sm text-text-muted">He hasn't collected yet.</p>
                </Panel>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ============================= 5. JOBS ============================= */}
      <section id="jobs" className="relative overflow-hidden border-t border-hairline/50">
        <img
          src={alleyArt.url}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(90deg, rgba(6,5,15,0.96) 0%, rgba(6,5,15,0.86) 45%, rgba(6,5,15,0.55) 100%)",
          }}
        />
        <Atmosphere />
        <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 px-5 py-24 sm:px-8 sm:py-32 lg:grid-cols-2">
          <Reveal>
            <div>
              <Eyebrow>Jobs</Eyebrow>
              <h2 className="mt-5 font-display text-3xl leading-[1.1] tracking-[-0.03em] text-text sm:text-4xl">
                Every job begins with a choice.
              </h2>
              <div className="mt-6 space-y-3 text-base leading-relaxed text-text-muted">
                <p>A fixer calls.</p>
                <p>The money's good.</p>
                <p>The details aren't.</p>
                <p>
                  Ask questions. Negotiate. Do your legwork. Find another way in. Betray the client.
                  Abandon the job entirely.
                </p>
              </div>
              <p className="mt-8 font-display text-xl tracking-[-0.02em] text-text sm:text-2xl">
                The GM gives you situations, not solutions.
              </p>
            </div>
          </Reveal>

          <Reveal delay={110}>
            <Panel className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-text-dim">
                    Incoming · Fixer
                  </p>
                  <p className="mt-2 font-display text-2xl tracking-[-0.02em] text-text">Dino</p>
                </div>
                <p className="num text-lg font-semibold text-amber">€$2,000</p>
              </div>
              <p className="mt-5 border-l-2 border-hairline pl-4 text-sm leading-relaxed text-text-muted">
                "Need someone tonight. Quiet extraction."
              </p>
              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                {["Hear him out", "Who's paying?", "Negotiate", "Not tonight"].map((choice) => (
                  <div
                    key={choice}
                    className="cursor-default border border-ember/45 px-3 py-2 text-sm text-text transition-colors hover:border-ember hover:bg-ember/10"
                  >
                    {choice}
                  </div>
                ))}
              </div>
              <p className="mt-3 border border-dashed border-hairline px-3 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-text-dim">
                Do something else…
              </p>
            </Panel>
          </Reveal>
        </div>
      </section>

      {/* ============================ 6. COMBAT ============================ */}
      <section id="combat" className="relative border-t border-hairline/50 py-24 sm:py-32">
        <div className="mx-auto max-w-6xl px-5 text-center sm:px-8">
          <Reveal>
            <h2 className="mx-auto max-w-3xl font-display text-3xl leading-[1.1] tracking-[-0.03em] text-text sm:text-5xl">
              When talking stops, the game changes.
            </h2>
          </Reveal>
          <Reveal delay={70}>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-text-muted">
              Cyberpunk RED combat becomes a tactical battlefield.
            </p>
          </Reveal>
        </div>

        <Reveal delay={120}>
          <div className="relative mt-14 w-full overflow-hidden border-y border-hairline">
            <img
              src={combatArt.url}
              alt="Top-down tactical view of a Night City warehouse with cover, vehicles and armed figures"
              className="h-[46vh] w-full object-cover sm:h-[62vh]"
              loading="lazy"
            />
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                backgroundImage:
                  "linear-gradient(to top, rgba(6,5,15,0.85) 0%, rgba(6,5,15,0.1) 45%, rgba(6,5,15,0.35) 100%)",
              }}
            />
            <div className="absolute inset-x-0 bottom-0 mx-auto flex max-w-6xl flex-wrap gap-x-6 gap-y-2 px-5 py-5 sm:px-8">
              {[
                "Move into position",
                "Use cover",
                "Manage range",
                "Ablate armor",
                "Run out of ammo",
                "Get hurt",
              ].map((t) => (
                <span
                  key={t}
                  className="font-mono text-[10px] uppercase tracking-[0.24em] text-cool"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal delay={80}>
          <p className="mx-auto mt-12 max-w-xl px-5 text-center font-display text-xl leading-snug tracking-[-0.02em] text-text sm:text-2xl">
            The rules engine handles the numbers.
            <br />
            You handle surviving.
          </p>
        </Reveal>
      </section>

      {/* ====================== 7. FREEFORM ACTIONS ====================== */}
      <section
        className="relative overflow-hidden border-t border-hairline/50"
        style={{ background: "#040309" }}
      >
        <img
          src={streetArt.url}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover opacity-20"
          loading="lazy"
        />
        <div aria-hidden className="absolute inset-0" style={{ background: "rgba(4,3,9,0.82)" }} />
        <div className="relative z-10 mx-auto max-w-4xl px-5 py-24 sm:px-8 sm:py-32">
          <Reveal>
            <h2 className="font-display text-3xl leading-[1.08] tracking-[-0.03em] text-text sm:text-5xl">
              No button for your idea? Try it anyway.
            </h2>
          </Reveal>

          <Reveal delay={90}>
            <div className="mt-12">
              <div className="flex flex-wrap gap-2">
                {["Shoot", "Move", "Reload", "Aim"].map((b) => (
                  <span
                    key={b}
                    className="border border-hairline px-4 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-text-dim"
                  >
                    {b}
                  </span>
                ))}
                <span className="border border-ember px-4 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-ember">
                  Do something else…
                </span>
              </div>

              <Panel className="mt-4 p-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-text-dim">
                  Your action
                </p>
                <p className="mt-3 border-l-2 border-ember pl-4 text-base text-text">
                  Shoot the sprinkler pipe above them and kill the lights.
                </p>
              </Panel>

              <Panel className="mt-3 p-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-cool">
                  Handgun check · DV 15
                </p>
                <p className="mt-3 text-base leading-relaxed text-text-muted">
                  The pipe ruptures. Water rains across the warehouse as half the room falls into
                  darkness.
                </p>
              </Panel>
            </div>
          </Reveal>

          <Reveal delay={140}>
            <p className="mt-12 max-w-xl font-display text-xl leading-snug tracking-[-0.02em] text-text sm:text-2xl">
              You're playing a tactical RPG. You're just not trapped inside its buttons.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ============================ 8. THE GM ============================ */}
      <section className="relative border-t border-hairline/50 py-24 sm:py-32">
        <div className="mx-auto max-w-4xl px-5 sm:px-8">
          <Reveal>
            <Eyebrow>The AI Game Master</Eyebrow>
            <h2 className="mt-5 font-display text-3xl leading-[1.1] tracking-[-0.03em] text-text sm:text-4xl">
              A Game Master that never runs out of Night City.
            </h2>
          </Reveal>
          <Reveal delay={80}>
            <div className="mt-8 max-w-2xl space-y-4 text-base leading-relaxed text-text-muted">
              <p>Your GM runs characters, consequences and the world around you.</p>
              <p>
                It knows the rules. It remembers what you've done. It adapts when you abandon the
                obvious plan.
              </p>
              <p>It isn't here to write the story for you.</p>
            </div>
          </Reveal>
          <Reveal delay={140}>
            <p className="mt-12 font-display text-2xl uppercase leading-[1.08] tracking-[-0.01em] text-chrome sm:text-4xl">
              It's here to find out what happens.
            </p>
          </Reveal>
        </div>
      </section>

      {/* =========================== 9. TIMELINE =========================== */}
      <section
        className="relative border-t border-hairline/50 py-24 sm:py-32"
        style={{ background: "#06050f" }}
      >
        <div className="mx-auto max-w-3xl px-5 sm:px-8">
          <Reveal>
            <div className="text-center">
              <Eyebrow>One night in Night City</Eyebrow>
              <h2 className="mt-5 font-display text-3xl leading-[1.1] tracking-[-0.03em] text-text sm:text-4xl">
                One night can go very wrong.
              </h2>
            </div>
          </Reveal>

          <ol className="mt-14 space-y-0">
            {[
              { t: "6:10 PM", b: "Your ripperdoc offers you discounted cyberware." },
              { t: "7:35 PM", b: "You spend €$400 you were saving for rent.", tone: "amber" },
              { t: "9:12 PM", b: "Dino offers you an extraction job." },
              { t: "10:48 PM", b: "You discover the target is an old friend." },
              { t: "11:17 PM", b: "You abandon the extraction.", tone: "ember" },
              { t: "11:19 PM", b: "Dino's Trust ↓", tone: "ember" },
              { t: "12:06 AM", b: "Maelstrom finds you first." },
              {
                t: "12:23 AM",
                b: "Broken Ribs · Armor SP 4/11 · 7 rounds remaining",
                tone: "cool",
              },
              {
                t: "2:14 AM",
                b: "Your landlord messages: \u201cWe need to talk.\u201d",
                tone: "amber",
              },
            ].map((row, i) => (
              <Reveal key={row.t} delay={i * 70}>
                <li className="grid grid-cols-[5.5rem_auto_minmax(0,1fr)] items-start gap-4 py-3">
                  <span className="num pt-0.5 text-right text-xs uppercase tracking-widest text-text-dim">
                    {row.t}
                  </span>
                  <span aria-hidden className="relative flex h-full justify-center">
                    <span className="absolute inset-y-0 w-px bg-hairline" />
                    <span
                      className={`relative mt-1.5 h-1.5 w-1.5 rounded-full ${
                        row.tone === "ember"
                          ? "bg-ember"
                          : row.tone === "amber"
                            ? "bg-amber"
                            : row.tone === "cool"
                              ? "bg-cool"
                              : "bg-text-dim"
                      }`}
                    />
                  </span>
                  <span
                    className={`text-sm leading-relaxed ${
                      row.tone === "amber"
                        ? "text-amber"
                        : row.tone === "cool"
                          ? "text-cool"
                          : "text-text-muted"
                    }`}
                  >
                    {row.b}
                  </span>
                </li>
              </Reveal>
            ))}
          </ol>

          <Reveal delay={120}>
            <p className="mt-12 text-center font-display text-xl tracking-[-0.02em] text-text sm:text-2xl">
              Tomorrow is already waiting.
            </p>
          </Reveal>
        </div>
      </section>

      {/* =========================== 10. FINAL CTA =========================== */}
      <section className="relative min-h-[80svh] overflow-hidden border-t border-hairline/50">
        <img
          src={dawnArt.url}
          alt=""
          aria-hidden
          className="lp-drift absolute inset-0 h-full w-full object-cover"
          loading="lazy"
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(to bottom, rgba(8,6,20,0.55) 0%, rgba(8,6,20,0.75) 45%, rgba(6,5,15,0.95) 100%)",
          }}
        />
        <Atmosphere av={false} />
        <div className="relative z-10 mx-auto flex min-h-[80svh] max-w-4xl flex-col items-center justify-center px-5 py-24 text-center sm:px-8">
          <Reveal>
            <h2 className="font-display text-4xl leading-[1.06] tracking-[-0.03em] text-chrome sm:text-6xl">
              So. What do you do?
            </h2>
          </Reveal>
          <Reveal delay={80}>
            <p className="mt-6 text-base text-text-muted sm:text-lg">
              Night City is waiting. Try to survive it.
            </p>
          </Reveal>
          <Reveal delay={140}>
            <div className="mt-10 flex flex-col items-center gap-4">
              <Button asChild size="lg" className="uppercase tracking-[0.18em]">
                <Link to={startTo}>{startLabel}</Link>
              </Button>
              <Link
                to={signedIn ? "/roster" : "/login"}
                className="font-mono text-[11px] uppercase tracking-[0.2em] text-text-muted transition-colors hover:text-text"
              >
                Already playing? Continue your campaign
              </Link>
            </div>
          </Reveal>
          <p className="mt-14 font-mono text-[10px] uppercase tracking-[0.24em] text-text-dim">
            Solo Cyberpunk RED · AI Game Master · Persistent campaign
          </p>
        </div>
      </section>
    </div>
  );
}
