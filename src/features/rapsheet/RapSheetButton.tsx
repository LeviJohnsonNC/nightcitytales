/**
 * Make the card, look at it, keep it.
 *
 * A button that opens the card in a dialog: a picture, a choice of shape, and
 * two ways out of the app with it — save it, or hand it to the phone's own share
 * sheet where there is one. It is made HERE, on this device, from this player's
 * own data, and posted only if they choose: nothing is uploaded, and there is no
 * public page behind it.
 *
 * The card is drawn once per shape the player looks at (the pictures are loaded
 * once and kept), and the object URLs it makes are let go when the dialog
 * closes or the shape changes, so a long visit does not hold a pile of PNGs.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { downloadPortrait, portraitUrl } from "@/lib/backend";
import { loadRapAssets, renderRapSheetBlob } from "./rapSheetAssets";
import type { RapAssets } from "./rapSheetCanvas";
import { RAP_FORMATS, rapSheet, type RapFormat, type RapSheetSource } from "./rapSheetModel";

type Made = { format: RapFormat; blob: Blob; url: string };

/**
 * The portrait's bytes. The authenticated storage client first, since it goes
 * through the same API path as every other call the app makes; the signed URL
 * as a second try, which needs the storage host to allow this origin. Null when
 * neither works, and the card is made without a picture rather than not at all.
 */
async function portraitBytes(path: string): Promise<Blob | null> {
  try {
    return await downloadPortrait(path);
  } catch {
    try {
      const response = await fetch(await portraitUrl(path), { mode: "cors" });
      return response.ok ? await response.blob() : null;
    } catch {
      return null;
    }
  }
}

function canShareFiles(blob: Blob, filename: string): boolean {
  try {
    if (typeof navigator === "undefined" || typeof navigator.canShare !== "function") return false;
    return navigator.canShare({ files: [new File([blob], filename, { type: "image/png" })] });
  } catch {
    return false;
  }
}

export function RapSheetButton({
  source,
  label = "Rap sheet",
  variant = "outline",
  size,
  icon = true,
  className,
}: {
  source: RapSheetSource;
  label?: ReactNode;
  variant?: "outline" | "ghost" | "default";
  size?: "sm" | "default";
  icon?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<RapFormat>("post");
  const [made, setMade] = useState<Made | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const assets = useRef<RapAssets | null>(null);
  // Which request the screen is waiting on, so a slow one cannot land after a faster one.
  const ticket = useRef(0);

  const sheet = rapSheet(source);
  const portraitPath = source.portraitPath;

  const release = useCallback(() => {
    setMade((m) => {
      if (m) URL.revokeObjectURL(m.url);
      return null;
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    const mine = (ticket.current += 1);
    setBusy(true);
    setError(null);
    (async () => {
      try {
        if (!assets.current) {
          assets.current = await loadRapAssets({
            portrait: portraitPath ? await portraitBytes(portraitPath) : null,
            faceUrls: sheet.associates.flatMap((a) => (a.image ? [a.image] : [])),
          });
        }
        const blob = await renderRapSheetBlob(sheet, assets.current, format);
        if (mine !== ticket.current) return;
        setMade((old) => {
          if (old) URL.revokeObjectURL(old.url);
          return { format, blob, url: URL.createObjectURL(blob) };
        });
      } catch (e) {
        if (mine === ticket.current)
          setError((e as Error).message || "The card could not be made.");
      } finally {
        if (mine === ticket.current) setBusy(false);
      }
    })();
    // The sheet is rebuilt from the source each render; keying on what it is made
    // from keeps this from redrawing the card for an unrelated re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, format, source.id, portraitPath]);

  useEffect(() => release, [release]);

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      ticket.current += 1;
      release();
      assets.current = null;
    }
  };

  const save = () => {
    if (!made) return;
    const a = document.createElement("a");
    a.href = made.url;
    a.download = sheet.filename;
    a.click();
  };

  const share = async () => {
    if (!made) return;
    try {
      await navigator.share({
        files: [new File([made.blob], sheet.filename, { type: "image/png" })],
        title: `${sheet.handle} · Night City Tales`,
      });
    } catch {
      // Closing the share sheet is a cancel, not a failure.
    }
  };

  const spec = RAP_FORMATS[format];
  const sharable = made ? canShareFiles(made.blob, sheet.filename) : false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size ?? "default"} className={className}>
          {icon && <Share2 className="mr-2 size-4" aria-hidden />}
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[94vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Rap sheet · {sheet.handle}</DialogTitle>
          <DialogDescription>
            Your file, as a card. Made here, on this device, from your own character; nothing is
            uploaded unless you post it.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2" role="group" aria-label="Shape">
          {(Object.keys(RAP_FORMATS) as RapFormat[]).map((f) => (
            <Button
              key={f}
              type="button"
              size="sm"
              variant={f === format ? "default" : "outline"}
              aria-pressed={f === format}
              onClick={() => setFormat(f)}
            >
              {RAP_FORMATS[f].label}
            </Button>
          ))}
        </div>

        <div
          className="relative mx-auto flex w-full items-center justify-center border border-hairline bg-black/40"
          style={{ aspectRatio: `${spec.width} / ${spec.height}`, maxHeight: "62vh" }}
        >
          {made && made.format === format ? (
            <img
              src={made.url}
              alt={`${sheet.handle}'s rap sheet`}
              className="size-full object-contain"
              data-testid="rapsheet-preview"
            />
          ) : (
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-text-dim">
              {error ?? (busy ? "Pulling the file…" : "")}
            </p>
          )}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex flex-wrap gap-2">
          <Button onClick={save} disabled={!made || busy}>
            Save image
          </Button>
          {sharable && (
            <Button variant="outline" onClick={share} disabled={busy}>
              Share…
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
