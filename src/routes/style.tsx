import { createFileRoute } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/style")({
  head: () => ({
    meta: [
      { title: "Visual System · Night City Tales" },
      {
        name: "description",
        content:
          "The Night City Tales design system: deep indigo neon-noir palette (magenta, cyan, purple), Archivo and IBM Plex type, and every interface primitive in one place.",
      },
      { property: "og:title", content: "Visual System · Night City Tales" },
      {
        property: "og:description",
        content:
          "The Night City Tales design system: deep indigo neon-noir palette (magenta, cyan, purple), Archivo and IBM Plex type, and every interface primitive in one place.",
      },
    ],
  }),
  component: StylePage,
});

const TOKENS: { group: string; items: { name: string; hex: string; note: string }[] }[] = [
  {
    group: "Grounds",
    items: [
      { name: "ground", hex: "#141013", note: "page background" },
      { name: "surface", hex: "#1E1A1B", note: "cards, panels" },
      { name: "surface-raised", hex: "#262020", note: "hover, elevated" },
      { name: "hairline", hex: "#3D3635", note: "borders, dividers" },
    ],
  },
  {
    group: "Text",
    items: [
      { name: "text", hex: "#F2E9E1", note: "primary — 15.7:1" },
      { name: "text-muted", hex: "#B9A99C", note: "secondary — 8.3:1" },
      { name: "text-dim", hex: "#7C6C63", note: "3.8:1 — large or non-text only" },
    ],
  },
  {
    group: "Ember",
    items: [
      { name: "ember", hex: "#F08521", note: "actions, focus — 7.3:1" },
      { name: "ember-deep", hex: "#BD6E2D", note: "hover / pressed" },
      { name: "ember-dim", hex: "#95592F", note: "disabled, subtle fills" },
    ],
  },
  {
    group: "Semantic",
    items: [
      { name: "danger", hex: "#F3581D", note: "destructive only" },
      { name: "cool", hex: "#5C7A8A", note: "inert / informational — large text only" },
      { name: "success", hex: "#7F8B5A", note: "validation passed" },
    ],
  },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-5">
      <h2 className="border-b border-hairline pb-2 font-mono text-[11px] uppercase tracking-[0.3em] text-ember">
        {title}
      </h2>
      {children}
    </section>
  );
}

const RAIL = [
  { i: "00", title: "Method select", status: "valid" },
  { i: "01", title: "Role select", status: "in progress" },
  { i: "02", title: "Lifepath", status: "has errors" },
  { i: "03", title: "STATs", status: "locked" },
];

const DOT: Record<string, string> = {
  valid: "bg-success",
  "in progress": "bg-text-muted",
  "has errors": "bg-danger",
  locked: "bg-text-dim",
};

function StylePage() {
  return (
    <main className="mx-auto max-w-5xl space-y-14 px-6 py-14">
      <header className="space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-ember">
          Design system
        </p>
        <h1 className="text-4xl text-text">Night City Tales visual language</h1>
        <p className="max-w-xl text-text-muted">
          Painted, matte, squared. One ember accent, warm near-black grounds, and every
          number in tabular mono.
        </p>
      </header>

      <Section title="Colour tokens">
        <div className="space-y-6">
          {TOKENS.map((g) => (
            <div key={g.group}>
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.25em] text-text-muted">
                {g.group}
              </p>
              <div className="grid gap-px border border-hairline bg-hairline sm:grid-cols-2 lg:grid-cols-4">
                {g.items.map((t) => (
                  <div key={t.name} className="bg-surface p-3">
                    <div
                      className="h-12 w-full border border-hairline"
                      style={{ backgroundColor: t.hex }}
                    />
                    <p className="mt-2 font-mono text-xs text-text">--color-{t.name}</p>
                    <p className="num text-xs text-text-muted">{t.hex}</p>
                    <p className="mt-1 text-xs text-text-muted">{t.note}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Typography">
        <div className="grid gap-px border border-hairline bg-hairline lg:grid-cols-3">
          <div className="space-y-3 bg-surface p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-text-muted">
              Archivo — display
            </p>
            <p className="font-display text-3xl font-semibold tracking-[-0.02em]">600 Semibold</p>
            <p className="font-display text-3xl font-bold tracking-[-0.02em]">700 Bold</p>
            <p className="font-display text-3xl font-extrabold tracking-[-0.02em]">800 Black</p>
          </div>
          <div className="space-y-3 bg-surface p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-text-muted">
              IBM Plex Sans — body
            </p>
            <p className="text-base font-normal">400 Regular — Night City never sleeps.</p>
            <p className="text-base font-medium">500 Medium — Night City never sleeps.</p>
          </div>
          <div className="space-y-3 bg-surface p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-text-muted">
              IBM Plex Mono — data
            </p>
            <p className="num text-base">400 — 1234567890</p>
            <p className="num text-base font-semibold">600 — 1234567890</p>
            <table className="w-full text-sm">
              <tbody>
                {[
                  ["REF", 6, 4, 10],
                  ["BODY", 12, 2, 14],
                  ["COOL", 8, 11, 19],
                ].map((r) => (
                  <tr key={String(r[0])} className="border-t border-hairline">
                    <td className="py-1 text-text-muted">{r[0]}</td>
                    <td className="num py-1 text-right text-text">{r[1]}</td>
                    <td className="num py-1 text-right text-text">{r[2]}</td>
                    <td className="num py-1 text-right text-ember">{r[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3 border border-hairline bg-surface p-5">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="link">Link</Button>
          <Button disabled>Disabled</Button>
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
        </div>
      </Section>

      <Section title="Form controls">
        <div className="grid gap-5 border border-hairline bg-surface p-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="handle">Handle</Label>
            <Input id="handle" placeholder="Rache Bartmoss" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select>
              <SelectTrigger id="role">
                <SelectValue placeholder="Choose a Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="solo">Solo</SelectItem>
                <SelectItem value="netrunner">Netrunner</SelectItem>
                <SelectItem value="fixer">Fixer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="pts">Points remaining</Label>
            <div className="flex items-baseline gap-3">
              <span className="num text-2xl font-semibold text-ember">62</span>
              <span className="text-sm text-text-muted">of 62 — tabular, never shifts width</span>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Cards & elevation">
        <div className="grid gap-4 sm:grid-cols-2">
          <article className="border border-hairline bg-surface p-5">
            <h3 className="text-lg text-text">Surface</h3>
            <p className="mt-2 text-sm text-text-muted">
              Base panel. 1px hairline, 2px corner radius, no shadow.
            </p>
          </article>
          <article className="border border-hairline bg-surface-raised p-5 transition-colors hover:border-ember">
            <h3 className="text-lg text-text">Surface raised</h3>
            <p className="mt-2 text-sm text-text-muted">
              Elevation is a warm tint shift, never a glow or blur.
            </p>
          </article>
        </div>
      </Section>

      <Section title="Badges & validation">
        <div className="space-y-4 border border-hairline bg-surface p-5">
          <div className="flex flex-wrap gap-2">
            <Badge>Ember</Badge>
            <Badge variant="secondary">Inert</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="destructive">Destructive</Badge>
          </div>
          <p className="border-l-2 border-success pl-3 text-sm text-text">
            All 62 points allocated. Step valid.
          </p>
          <p className="border-l-2 border-danger pl-3 text-sm text-text">
            REF is 9 — no STAT may exceed 8 in Complete Package.
          </p>
          <p className="border-l-2 border-cool pl-3 text-sm text-text-muted">
            Locked until a Role is selected.
          </p>
        </div>
      </Section>

      <Section title="Step rail">
        <ol className="max-w-xs space-y-1 border border-hairline bg-surface p-3">
          {RAIL.map((s) => (
            <li key={s.i}>
              <div className="flex items-start gap-3 border-l-2 border-hairline px-3 py-2 transition-colors hover:bg-surface-raised">
                <span className="num mt-0.5 text-[11px] text-text-muted">{s.i}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-text">{s.title}</span>
                    <span className={`size-1.5 shrink-0 rounded-full ${DOT[s.status]}`} />
                  </span>
                  <span className="block font-mono text-[11px] uppercase tracking-wider text-text-muted">
                    {s.status}
                  </span>
                </span>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Key-art slot">
        <div className="relative h-56 overflow-hidden border border-hairline bg-surface-raised">
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(90deg, rgba(20,16,19,0.85) 0%, rgba(20,16,19,0.6) 45%, rgba(20,16,19,0.2) 100%), repeating-linear-gradient(135deg, transparent 0 12px, rgba(240,133,33,0.08) 12px 13px)",
            }}
          />
          <div className="relative flex h-full max-w-sm flex-col justify-end p-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ember">
              Focal point 0.30 / 0.40
            </p>
            <p className="mt-1 text-2xl text-text">Text lives on the scrimmed side</p>
          </div>
        </div>
      </Section>
    </main>
  );
}