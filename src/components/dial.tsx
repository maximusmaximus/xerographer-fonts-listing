import { type PointerEvent } from "react";

export function Dial({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (value: number) => void;
}) {
  function setFromPoint(clientX: number, clientY: number, rect: DOMRect) {
    const dx = clientX - (rect.left + rect.width / 2);
    const dy = clientY - (rect.top + rect.height / 2);
    let deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    if (deg < 0) deg += 360;
    const t = Math.min(1, Math.max(0, deg / 360));
    const raw = min + t * (max - min);
    const snapped = Math.round(raw / step) * step;
    onChange(Number(snapped.toFixed(4)));
  }

  function onPointerDown(e: PointerEvent<HTMLButtonElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    setFromPoint(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect());
  }

  function onPointerMove(e: PointerEvent<HTMLButtonElement>) {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    setFromPoint(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect());
  }

  const t = (value - min) / (max - min);
  const deg = t * 360;

  return (
    <div className="flex min-w-0 flex-col items-center gap-1">
      <button
        type="button"
        aria-label={label}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        className="relative size-[4.5rem] touch-none rounded-full bg-bg-subtle shadow-[var(--shadow-border)]"
      >
        <span
          className="absolute inset-1.5 rounded-full"
          style={{
            background: `conic-gradient(var(--color-accent) ${deg}deg, transparent ${deg}deg)`,
          }}
        />
        <span className="absolute inset-3 rounded-full bg-bg-elevated" />
        <span
          className="absolute left-1/2 top-1.5 size-1.5 -translate-x-1/2 rounded-full bg-accent"
          style={{ transform: `rotate(${deg}deg) translateY(0)`, transformOrigin: "50% 2.05rem" }}
        />
      </button>
      <span className="text-xs uppercase tracking-[0.16em] text-fg-muted">{label}</span>
      <span className="font-mono text-xs tabular-nums text-fg">{display}</span>
    </div>
  );
}
