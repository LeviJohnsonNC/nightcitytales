import { useState, type ReactNode } from "react";
import {
  Banknote,
  Check,
  ChevronRight,
  Mail,
  MessagesSquare,
  Radio,
  UserRoundSearch,
} from "lucide-react";
import { canAsk, formatDuration, getSkill, HOOK_ASKS, hookAskSpec, type HookAsk } from "@/engine";
import { Button } from "@/components/ui/button";
import type { LifeHook } from "./hookOffer";
import "./lucy-offer.css";

const approaches = {
  pay: {
    title: "Ask for a higher fee",
    hint: "A refusal could sour the relationship.",
    success: "The client raised the fee.",
    refusal: "The client held firm.",
    Icon: Banknote,
  },
  patron: {
    title: "Ask who’s paying",
    hint: "Press for a name. It could cost you goodwill.",
    success: "The client named the employer.",
    refusal: "The client kept the name private.",
    Icon: UserRoundSearch,
  },
  risk: {
    title: "Ask around quietly",
    hint: "Work your contacts without involving the client.",
    refusal: "Your contacts had no leads.",
    Icon: MessagesSquare,
  },
};

type Props = {
  hook: LifeHook;
  location: string;
  busy: boolean;
  composer: ReactNode;
  onAccept: () => void;
  onPass: (reason: string) => void;
  onAsk: (ask: HookAsk) => void;
};

export function LucyOffer({ hook, location, busy, composer, onAccept, onPass, onAsk }: Props) {
  const [passing, setPassing] = useState(false);
  const [reason, setReason] = useState("");
  const { terms, offer } = hook;
  const raised = terms.payout > terms.basePayout;
  const fee = (amount: number) => amount.toLocaleString("en-CA") + " eb";

  return (
    <section className="lucy-offer" aria-labelledby="lucy-title">
      <p className="lucy-location">{location}</p>
      <div className="lucy-report">
        <div className="lucy-story">
          <p className="lucy-kicker">
            <Radio aria-hidden="true" size={18} /> Net 54 Crimewatchers
          </p>
          <h1 id="lucy-title">Lucy Rhinemeyer is missing</h1>
          <p>Lucy, 19, is the seventh woman to disappear near the university in four weeks.</p>
        </div>
        <div className="lucy-photo">
          <img
            src="/images/missions/evergreen-desk-1440.webp"
            srcSet="/images/missions/evergreen-desk-720.webp 720w, /images/missions/evergreen-desk-1440.webp 1440w"
            sizes="(max-width: 600px) 720px, 1080px"
            width={1440}
            height={480}
            fetchPriority="high"
            alt="Lucy’s student photo on the Net 54 broadcast"
          />
        </div>
      </div>
      <div className="lucy-reply">
        <section className="lucy-message" aria-labelledby="lucy-sender">
          <p className="lucy-kicker">
            <Mail size={16} aria-hidden="true" /> {offer.brokerLine}
          </p>
          <h2 id="lucy-sender">{offer.brokerName}</h2>
          <blockquote>“{offer.pitch}”</blockquote>
          {terms.learned.includes("patron") && (
            <p className="lucy-client">
              On behalf of {offer.patronName} · {offer.patronOrg}
            </p>
          )}
          <p className="lucy-fee" aria-live="polite" aria-atomic="true">
            <span>{raised ? "Negotiated fee" : "Offered fee"}</span>
            <strong>{fee(terms.payout)}</strong>
            {raised && <small>Originally {fee(terms.basePayout)}</small>}
          </p>
        </section>
        <section aria-labelledby="lucy-options">
          <h2 id="lucy-options">Before you decide</h2>
          <ul className="lucy-asks">
            {HOOK_ASKS.map((ask) => {
              const { title, hint, Icon, refusal } = approaches[ask];
              const { skillId, minutes } = hookAskSpec(ask);
              const available = canAsk(terms, ask);
              let result = refusal;
              if (terms.learned.includes(ask)) {
                result = ask === "risk" ? offer.opposition : approaches[ask].success;
              }
              return (
                <li key={ask}>
                  {available ? (
                    <button type="button" disabled={busy} onClick={() => onAsk(ask)}>
                      <Icon size={18} aria-hidden="true" />
                      <strong>{title}</strong>
                      <ChevronRight size={16} aria-hidden="true" />
                      <span>{hint}</span>
                      <small>
                        {getSkill(skillId).name} · {formatDuration(minutes)}
                      </small>
                    </button>
                  ) : (
                    <div className="lucy-answer">
                      <Check size={18} aria-hidden="true" />
                      <strong>{title}</strong>
                      <span>{result}</span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
        {composer && (
          <details className="lucy-disclosure">
            <summary>Say or do something else</summary>
            {composer}
          </details>
        )}
        <div className="lucy-decisions">
          <Button disabled={busy} onClick={onAccept}>
            Take the job
          </Button>
          <Button
            variant="ghost"
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
      </div>
    </section>
  );
}
