import { cn } from "@/lib/utils";
import "./interview.css";

/** Past this many characters an answer reads as a sentence, not a label. */
const SENTENCE = 48;

/**
 * A Lifepath answer, in full.
 *
 * It used to share a line with the die and the buttons and shrink to fit,
 * which clipped every answer longer than a few words — and the long ones
 * ("In the heart of the Combat Zone, living in a wrecked building…") are the
 * ones worth reading. It gets the card's whole width now and wraps. A short
 * answer is a label and reads large; a long one is a line of somebody's past
 * and reads as one, set off by the same ember rule a quoted line uses.
 */
export function LifepathValue({ value }: { value: string | null }) {
  if (!value) {
    return <p className="mt-1.5 text-sm text-text-dim">Not set</p>;
  }
  const sentence = value.length > SENTENCE;
  return (
    <p
      key={value}
      className={cn(
        "cg-say mt-1.5 text-pretty break-words text-text",
        sentence
          ? "border-l-2 border-ember/50 pl-2.5 text-sm leading-relaxed text-text/90"
          : "text-base font-semibold leading-snug",
      )}
    >
      {value}
    </p>
  );
}
