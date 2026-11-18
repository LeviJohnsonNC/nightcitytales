import { Expand } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatLifeClock, placeKeyOf, type GameClock } from "@/engine";
import { sceneArt } from "./sceneArt";
import "./life.css";

const focalPoints: Record<string, string> = { o3: "50% 49%", p4: "67% 38%" };

export function SceneHero({ locationKey, clock }: { locationKey: string; clock: GameClock }) {
  const scene = sceneArt(locationKey);
  const [failed, setFailed] = useState<string | null>(null);
  const art = scene.artwork?.src === failed ? undefined : scene.artwork;
  return (
    <section aria-labelledby="life-place" className="life-hero" data-picture={!!art}>
      {art && (
        <img
          src={art.src}
          srcSet={art.srcSet}
          sizes="(min-width: 1024px) 69vw, 100vw"
          fetchPriority="high"
          alt={scene.alt}
          onError={() => setFailed(art.src)}
          style={{ objectPosition: focalPoints[placeKeyOf(locationKey) ?? ""] }}
        />
      )}
      <div className="life-location">
        <h1 id="life-place">{scene.title}</h1>
        <p>{[scene.subtitle, formatLifeClock(clock)].filter(Boolean).join(" · ")}</p>
      </div>
      {art && (
        <Dialog>
          <DialogTrigger asChild>
            <button
              type="button"
              className="life-expand"
              aria-label={"Expand image of " + scene.title}
            >
              <Expand size={18} />
            </button>
          </DialogTrigger>
          <DialogContent aria-describedby={undefined} className="life-viewer">
            <img src={art.src} alt={scene.alt} />
            <DialogTitle>{scene.title}</DialogTitle>
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}
