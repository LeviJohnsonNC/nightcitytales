import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

function Moment({ time, label, children }: { time: string; label: string; children: ReactNode }) {
  return (
    <li className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3 border-t border-hairline/70 py-5 first:border-t-0 sm:gap-6">
      <time
        dateTime={time}
        className="pt-1 font-mono text-xs font-medium tabular-nums text-text-muted"
      >
        {label}
      </time>
      <div className="text-base leading-relaxed text-text">{children}</div>
    </li>
  );
}

export function OneNight() {
  return (
    <section
      id="jobs"
      aria-labelledby="one-night-title"
      className="scroll-mt-16 border-y border-hairline/60 bg-ground"
    >
      <div className="mx-auto grid max-w-6xl md:grid-cols-2 md:items-stretch">
        <div className="relative isolate flex min-h-60 items-end overflow-hidden bg-surface px-6 py-8 sm:px-8 md:min-h-96 md:py-10">
          <img
            src="/images/places/converted-motel-studio-apartments-640.webp"
            srcSet="/images/places/converted-motel-studio-apartments-640.webp 640w, /images/places/converted-motel-studio-apartments.webp 1536w"
            sizes="(min-width: 1152px) 576px, (min-width: 768px) 50vw, 100vw"
            loading="lazy"
            width={1536}
            height={1024}
            alt=""
            className="absolute inset-0 -z-20 size-full object-cover"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-linear-to-t from-ground via-ground/35 to-transparent"
          />
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-widest text-text-muted">
              One night in Night City
            </p>
            <h2
              id="one-night-title"
              className="mt-3 max-w-[12ch] font-display text-4xl leading-[1.04] tracking-tight text-text lg:text-6xl"
            >
              Rent is due tomorrow.
            </h2>
          </div>
        </div>
        <ol className="self-center px-6 py-3 sm:px-8 md:py-6 lg:pl-12">
          <Moment time="19:35" label="7:35 PM">
            Your ripperdoc has the chrome you’ve been looking for. There goes €400 of your rent
            money.
          </Moment>
          <Moment time="21:12" label="9:12 PM">
            <p>
              Your fixer calls. “Need someone tonight. Quiet extraction.{" "}
              <strong className="font-semibold text-amber">€2,000.</strong>”
            </p>
            <details className="group mt-2">
              <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-2 font-semibold text-cool underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden">
                Ask Dino who’s paying{" "}
                <ChevronDown aria-hidden="true" className="size-4 group-open:rotate-180" />
              </summary>
              <p className="mb-1 mt-1 border-l-2 border-cool pl-3 text-text-muted">
                “Client wants their name kept out of this. You want a name, or do you want the job?”
              </p>
            </details>
          </Moment>
          <Moment time="23:17" label="11:17 PM">
            The target is an old friend. You walk them out the back and tell Dino the job is off.
          </Moment>
          <Moment time="02:14" label="2:14 AM">
            Dino hasn’t called back. Your landlord has.{" "}
            <span className="text-amber">“We need to talk.”</span>
          </Moment>
        </ol>
      </div>
    </section>
  );
}
