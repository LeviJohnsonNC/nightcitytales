import { useState } from "react";
import { AudioLines, Banknote, Fingerprint, Radio } from "lucide-react";
import { formatDuration, getSkill, knownTerms, openAsks, type HookAsk } from "@/engine";
import { Button } from "@/components/ui/button";
import type { LifeHook } from "./hookOffer";
import "./lucy-offer.css";

const approaches = {
  pay: {
    title: "Negotiate the fee",
    hint: "Push for more. A refusal can cool the relationship.",
    Icon: Banknote,
  },
  patron: {
    title: "Check the client’s story",
    hint: "Press for a name and an employer. The question could cost goodwill.",
    Icon: Fingerprint,
  },
  risk: {
    title: "Ask your contacts",
    hint: "Find out what the street knows without involving the client.",
    Icon: AudioLines,
  },
};

type Props = {
  hook: LifeHook;
  location: string;
  busy: boolean;
  onAccept: () => void;
  onPass: (reason: string) => void;
  onAsk: (ask: HookAsk) => void;
};

export function LucyOffer({ hook, location, busy, onAccept, onPass, onAsk }: Props) {
  const [passing, setPassing] = useState(false);
  const [reason, setReason] = useState("");
  const { terms, offer } = hook;
  const learned = knownTerms(terms, offer);
  const asks = openAsks(terms);

  return (
    <section className="lucy-offer" aria-labelledby="lucy-title">
      <p className="lucy-location">{location}</p>
      <div className="lucy-report">
        <div className="lucy-story">
          <p className="lucy-kicker">
            <Radio aria-hidden="true" size={18} /> Net 54 Crimewatchers
          </p>
          <h1 id="lucy-title">Lucy Rhinemeyer is missing</h1>
          <p>{offer.pitch}</p>
        </div>
        <div className="lucy-photo">
          <img
            src="/images/missions/evergreen-desk-1440.webp"
            width={1440}
            height={480}
            fetchPriority="high"
            alt="Lucy’s student photo on the Net 54 broadcast"
          />
        </div>
      </div>
      <div className="lucy-terms">
        <div>
          <p className="lucy-kicker">Job offer</p>
          <h2>{offer.brokerName}</h2>
        </div>
        <p className="lucy-fee" aria-live="polite">
          <strong>{terms.payout.toLocaleString("en-CA")} eb</strong>
          <span>{terms.payout > terms.basePayout ? "Negotiated fee" : "Offered for recovery"}</span>
        </p>
      </div>
      <div className="lucy-decisions">
        <Button disabled={busy} onClick={onAccept}>
          Take the job
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          aria-expanded={passing}
          onClick={() => setPassing(!passing)}
        >
          Pass on this offer
        </Button>
      </div>
      {passing && (
        <form
          className="lucy-pass"
          onSubmit={(e) => {
            e.preventDefault();
            if (!busy) onPass(reason.trim() || "Not this one.");
          }}
        >
          <label>
            Reason for passing (optional)
            <input value={reason} disabled={busy} onChange={(e) => setReason(e.target.value)} />
          </label>
          <Button variant="outline" disabled={busy} type="submit">
            Decline and return to Life
          </Button>
        </form>
      )}
      {asks.length > 0 && (
        <section aria-label="Before you decide" className="lucy-negotiation">
          <h2>Before you decide</h2>
          <div className="lucy-asks">
            {asks.map(({ ask, skillId, minutes }) => {
              const { title, hint, Icon } = approaches[ask];
              return (
                <button type="button" key={ask} disabled={busy} onClick={() => onAsk(ask)}>
                  <Icon size={20} aria-hidden="true" />
                  <strong>{title}</strong>
                  <span>{hint}</span>
                  <small>
                    {getSkill(skillId).name} · {formatDuration(minutes)}
                  </small>
                </button>
              );
            })}
          </div>
        </section>
      )}
      {learned.length > 0 && (
        <ul className="lucy-learned" aria-label="What you learned">
          {learned.map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
