import { useRef, type ReactNode } from "react";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  draft: string;
  onDraft: (value: string) => void;
  onAct: () => void;
  onSuggest: () => void;
  busy: boolean;
  suggestions: ReactNode;
};

export function LifeComposer({ draft, onDraft, onAct, onSuggest, busy, suggestions }: Props) {
  const composing = useRef(false);
  return (
    <form
      className="life-composer"
      onSubmit={(event) => {
        event.preventDefault();
        if (!busy && draft.trim()) onAct();
      }}
    >
      <div className="life-composer-heading">
        <label htmlFor="life-intent">What do you do?</label>
        <button type="button" className="life-link" onClick={onSuggest} disabled={busy}>
          Suggest actions
        </button>
      </div>
      {suggestions}
      <div className="life-entry">
        <Textarea
          id="life-intent"
          rows={2}
          value={draft}
          readOnly={busy}
          onChange={(e) => onDraft(e.target.value)}
          onCompositionStart={() => {
            composing.current = true;
          }}
          onCompositionEnd={() => {
            composing.current = false;
          }}
          onKeyDown={(e) => {
            if (
              e.key !== "Enter" ||
              e.shiftKey ||
              composing.current ||
              e.nativeEvent.isComposing ||
              e.nativeEvent.keyCode === 229
            )
              return;
            e.preventDefault();
            if (!e.repeat) e.currentTarget.form?.requestSubmit();
          }}
        />
        <button className="life-act" disabled={busy || !draft.trim()}>
          Act
        </button>
      </div>
    </form>
  );
}
