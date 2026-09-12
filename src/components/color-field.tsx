export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex min-w-0 items-center gap-2">
      <span className="shrink-0 text-xs uppercase tracking-[0.16em] text-fg-muted">{label}</span>
      <span
        className="relative size-11 shrink-0 overflow-hidden rounded-sm shadow-[var(--shadow-border)]"
        style={{ background: value }}
      >
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label={label}
        />
      </span>
      <span className="hidden font-mono text-xs tabular-nums text-fg-muted sm:inline">{value}</span>
    </label>
  );
}
