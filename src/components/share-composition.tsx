import { Check, Copy, Download, Link2, Share2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ShareStatus = "idle" | "copied" | "shared" | "saved" | "image";

async function fetchCard(ogUrl: string): Promise<Blob | null> {
  try {
    const res = await fetch(ogUrl, { cache: "force-cache" });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) return null;
    return blob;
  } catch {
    return null;
  }
}

function warmCard(ogUrl: string) {
  if (!ogUrl || typeof window === "undefined") return;
  const img = new Image();
  img.src = ogUrl;
}

export function ShareComposition({
  url,
  ogUrl,
  title,
  disabled,
}: {
  url: string;
  ogUrl?: string;
  title: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<ShareStatus>("idle");
  const [ready, setReady] = useState(false);
  const panelId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const card = ogUrl || "";

  useEffect(() => {
    if (!card) return;
    const handle = window.setTimeout(() => warmCard(card), 280);
    return () => window.clearTimeout(handle);
  }, [card]);

  useEffect(() => {
    if (!open || !card) return;
    setReady(false);
    warmCard(card);
  }, [open, card]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  function flash(next: ShareStatus) {
    setStatus(next);
    window.setTimeout(() => setStatus("idle"), 1800);
  }

  async function shareNative() {
    if (disabled || !url) return;
    const blob = card ? await fetchCard(card) : null;
    const file = blob ? new File([blob], "xerographer-preview.png", { type: blob.type || "image/png" }) : null;
    try {
      if (file && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        await navigator.share({ title, text: title, url, files: [file] });
        flash("shared");
        return;
      }
      if (typeof navigator.share === "function") {
        await navigator.share({ title, text: title, url });
        flash("shared");
        return;
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
    }
    await copyLink();
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      flash("copied");
    } catch {
      /* ignore */
    }
  }

  async function copyImage() {
    if (!card) return;
    const blob = await fetchCard(card);
    if (!blob) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      flash("image");
    } catch {
      downloadCard(blob);
    }
  }

  async function saveCard() {
    if (!card) return;
    const blob = await fetchCard(card);
    if (!blob) return;
    downloadCard(blob);
    flash("saved");
  }

  function downloadCard(blob: Blob) {
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = "xerographer-preview.png";
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(href), 1500);
  }

  const primary =
    status === "copied"
      ? "Link copied"
      : status === "shared"
        ? "Shared"
        : status === "saved"
          ? "Card saved"
          : status === "image"
            ? "Image copied"
            : "Share";

  return (
    <div className="relative" ref={panelRef}>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={disabled}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={primary}
        onClick={() => {
          if (disabled) return;
          setOpen((v) => !v);
        }}
      >
        {status === "idle" ? <Share2 className="size-4" /> : <Check className="size-4" />}
        <span className="hidden sm:inline">{primary}</span>
      </Button>
      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label="Share this composition"
          className="fixed inset-x-3 bottom-3 z-40 rounded-xl bg-bg-elevated p-3 shadow-[var(--shadow-border)] sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:mt-2 sm:w-[22rem]"
        >
          <p className="text-xs uppercase tracking-[0.16em] text-fg-muted">Share card</p>
          <p className="mt-1 text-sm text-fg-muted">
            Anyone with the link can open this composition and keep editing. The preview is generated from your type.
          </p>
          {card ? (
            <div className="relative mt-3 overflow-hidden rounded-md bg-bg-subtle">
              {!ready ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="glyph-spin select-none font-display text-3xl leading-none">x</span>
                </div>
              ) : null}
              <img
                src={card}
                alt="Generated share preview"
                width={1200}
                height={630}
                className={cn("aspect-[1200/630] w-full object-cover", ready ? "opacity-100" : "opacity-0")}
                onLoad={() => setReady(true)}
              />
            </div>
          ) : null}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button type="button" size="sm" onClick={() => void shareNative()}>
              <Share2 className="size-4" />
              Send
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => void copyLink()}>
              <Link2 className="size-4" />
              Copy link
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => void copyImage()} disabled={!card}>
              <Copy className="size-4" />
              Copy image
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => void saveCard()} disabled={!card}>
              <Download className="size-4" />
              Save card
            </Button>
          </div>
          <a
            className="mt-2 inline-flex h-11 items-center px-1 text-sm text-fg-muted hover:text-fg"
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`}
            target="_blank"
            rel="noreferrer"
          >
            Post to X
          </a>
        </div>
      ) : null}
    </div>
  );
}
