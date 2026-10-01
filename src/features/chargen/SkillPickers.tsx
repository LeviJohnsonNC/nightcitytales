/**
 * The pick-lists the Skills step uses where it used to use a text box or a
 * native <select>: a searchable, grouped list in the app's own colours.
 */
import { useMemo, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { HOME_AREA, localExpertAreaOptions, type SkillEntry } from "@/engine";
import { cn } from "@/lib/utils";

export type PickerOption = {
  value: string;
  label: string;
  /** Shown to the right: why it can't be picked, or a hint. */
  note?: string;
  disabled?: boolean;
};
export type PickerGroup = { label?: string; options: PickerOption[] };

const OTHER = "\u0000other";

function Picker({
  groups,
  value,
  onChange,
  placeholder,
  label,
  hint,
}: {
  groups: PickerGroup[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  hint?: string | undefined;
}) {
  const [open, setOpen] = useState(false);
  const current = groups.flatMap((g) => g.options).find((o) => o.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-expanded={open}
          className="flex h-9 w-56 items-center justify-between gap-2 border border-hairline bg-surface-raised px-3 text-left text-sm text-text transition-colors hover:border-accent/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
        >
          <span className={cn("truncate", !current && "text-text-dim")}>
            {current?.label ?? placeholder}
          </span>
          <ChevronDown aria-hidden className="size-4 shrink-0 text-text-dim" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-72 rounded-none border-hairline bg-surface-raised p-0"
      >
        <Command className="rounded-none bg-transparent">
          <CommandInput placeholder="Search…" />
          <CommandList>
            <CommandEmpty>Nothing matches.</CommandEmpty>
            {groups.map((group, i) => (
              <CommandGroup
                key={group.label ?? i}
                {...(group.label ? { heading: group.label } : {})}
                className="[&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.2em] [&_[cmdk-group-heading]]:text-text-dim"
              >
                {group.options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={`${group.label ?? ""} ${option.label}`}
                    disabled={option.disabled ?? false}
                    onSelect={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    className="rounded-none"
                  >
                    <Check
                      aria-hidden
                      className={cn(
                        "text-ember",
                        option.value === value ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="flex-1">{option.label}</span>
                    {option.note && (
                      <span className="font-mono text-[10px] uppercase tracking-widest text-text-dim">
                        {option.note}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
        {hint && (
          <p className="border-t border-hairline px-3 py-2 text-xs text-text-muted">{hint}</p>
        )}
      </PopoverContent>
    </Popover>
  );
}

/**
 * The neighbourhood a Local Expert line is for. A picker, not a text box: the
 * Skill is only worth its Level in one district, so the specialization has to
 * be one the engine can resolve. `Your Home` is first and the default — it is
 * what the printed Role packages grant, and the address is chosen at a later
 * step the printed creation order will not let us move.
 */
export function AreaPicker({
  value,
  onChange,
  suggested,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  /** District keys the character's childhood points at. A highlight, never a filter. */
  suggested: string[];
  label: string;
}) {
  const groups = useMemo(() => {
    const hint = new Set(suggested);
    const byArea = new Map<string, PickerOption[]>();
    for (const district of localExpertAreaOptions()) {
      const bucket = byArea.get(district.areaName) ?? [];
      bucket.push({
        value: district.districtKey,
        label: district.districtName,
        ...(hint.has(district.districtKey) ? { note: "★" } : {}),
      });
      byArea.set(district.areaName, bucket);
    }
    return [
      { options: [{ value: HOME_AREA, label: "Your Home", note: "decided at Lifestyle" }] },
      ...[...byArea.entries()].map(([areaName, options]) => ({ label: areaName, options })),
    ];
  }, [suggested]);
  return (
    <Picker
      groups={groups}
      value={value}
      onChange={onChange}
      placeholder="Pick a neighbourhood"
      label={label}
      hint={suggested.length > 0 ? "★ is a neighbourhood your childhood points at." : undefined}
    />
  );
}

/**
 * The thing a Language, Science, Martial Arts or Play Instrument line is
 * trained in: the common names as a list, and "Other…" for anything else.
 * Names already on the sheet are greyed so the same one can't be added twice.
 */
export function SpecializationPicker({
  skillId,
  options,
  value,
  onChange,
  taken,
  label,
  placeholder,
}: {
  skillId: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
  taken: readonly SkillEntry[];
  label: string;
  placeholder: string;
}) {
  const listed = options.includes(value);
  const [custom, setCustom] = useState(value !== "" && !listed);
  const used = new Set(
    taken.filter((e) => e.skillId === skillId && e.specialization).map((e) => e.specialization),
  );
  const groups: PickerGroup[] = [
    {
      options: options.map((name) => ({
        value: name,
        label: name,
        ...(used.has(name) ? { note: "Chosen", disabled: true } : {}),
      })),
    },
    { options: [{ value: OTHER, label: "Other…" }] },
  ];

  if (custom) {
    return (
      <span className="flex items-center gap-2">
        <Input
          className="w-40"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={label}
        />
        <button
          type="button"
          onClick={() => {
            setCustom(false);
            onChange("");
          }}
          className="font-mono text-[10px] uppercase tracking-[0.15em] text-text-dim hover:text-text"
        >
          List
        </button>
      </span>
    );
  }
  return (
    <Picker
      groups={groups}
      value={value}
      onChange={(next) => {
        if (next === OTHER) {
          setCustom(true);
          onChange("");
        } else onChange(next);
      }}
      placeholder={placeholder}
      label={label}
    />
  );
}
