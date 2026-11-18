import { useRef, type ReactNode } from "react";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  draft: string;
  onDraft: (value: string) => void;
  onAct: () => void;
  onSuggest: () => void;
  onHangUp?: ((keyboard: boolean) => void) | undefined;
  busy: boolean;
  suggestions: ReactNode;
};

export function LifeComposer({
  draft,
  onDraft,
  onAct,
  onSuggest,
  onHangUp,
  busy,
  suggestions,
}: Props) {
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
        <label htmlFor="life-intent">{onHangUp ? "What do you say?" : "What do you do?"}</label>
        {!onHangUp && (
          <button type="button" className="life-link" onClick={onSuggest} disabled={busy}>
            Suggest actions
          </button>
        )}
      </div>
      {!onHangUp && suggestions}
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
        <div className="life-entry-actions">
          <button type="submit" className="life-act" disabled={busy || !draft.trim()}>
            {onHangUp ? "Reply" : "Act"}
          </button>
          {onHangUp && (
            <button
              type="button"
              className="life-link life-hang-up"
              onClick={(event) => onHangUp(event.detail === 0)}
              disabled={busy}
            >
              Hang up
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
