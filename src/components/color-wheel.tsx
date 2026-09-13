import { useEffect, useRef, type PointerEvent } from "react";
import { hexToHsv, hsvToHex, hsvToRgb } from "@/lib/color";

function paintDisc(ctx: CanvasRenderingContext2D, size: number, value: number) {
  const image = ctx.createImageData(size, size);
  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;
  const radius = size / 2 - 1.5;
  const data = image.data;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const i = (y * size + x) * 4;
      if (dist > radius) {
        data[i + 3] = 0;
        continue;
      }
      const hue = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
      const sat = Math.min(1, dist / radius);
      const { r, g, b } = hsvToRgb(hue, sat, value);
      const edge = dist > radius - 1 ? radius - dist : 1;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = Math.round(255 * Math.min(1, edge));
    }
  }
  ctx.putImageData(image, 0, 0);
}

export function ColorWheel({
  label,
  value,
  onChange,
  size = 168,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
  size?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hsv = hexToHsv(value);
  const radius = size / 2 - 1.5;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    paintDisc(ctx, size, hsv.v);
  }, [hsv.v, size]);

  function pick(clientX: number, clientY: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const box = canvas.getBoundingClientRect();
    const x = ((clientX - box.left) / box.width) * size;
    const y = ((clientY - box.top) / box.height) * size;
    const dx = x - size / 2;
    const dy = y - size / 2;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const hue = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
    const sat = Math.min(1, dist / radius);
    onChange(hsvToHex(hue, sat, hsv.v));
  }

  function onPointerDown(e: PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    pick(e.clientX, e.clientY);
  }

  function onPointerMove(e: PointerEvent<HTMLCanvasElement>) {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    pick(e.clientX, e.clientY);
  }

  const markerR = hsv.s * radius;
  const markerX = size / 2 + Math.cos((hsv.h * Math.PI) / 180) * markerR;
  const markerY = size / 2 + Math.sin((hsv.h * Math.PI) / 180) * markerR;

  return (
    <div className="flex min-w-0 flex-col items-center gap-2">
      <span className="text-xs uppercase tracking-[0.16em] text-fg-muted">{label}</span>
      <div className="relative" style={{ width: size, height: size }}>
        <canvas
          ref={canvasRef}
          width={size}
          height={size}
          aria-label={label}
          className="block size-full touch-none cursor-crosshair rounded-full"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
        />
        <span
          className="pointer-events-none absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-[0_0_0_2px_#fff,0_0_0_3px_rgba(0,0,0,.55)]"
          style={{ left: markerX, top: markerY, background: value }}
        />
      </div>
      <label className="flex w-full items-center gap-2">
        <span className="sr-only">{label} brightness</span>
        <input
          type="range"
          min={8}
          max={100}
          value={Math.round(hsv.v * 100)}
          aria-label={`${label} brightness`}
          onChange={(e) => onChange(hsvToHex(hsv.h, hsv.s, Number(e.target.value) / 100))}
          className="h-11 w-full min-w-0 appearance-none rounded-full"
          style={{
            background: `linear-gradient(90deg, #000, ${hsvToHex(hsv.h, hsv.s, 1)})`,
          }}
        />
      </label>
    </div>
  );
}
