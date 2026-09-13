import { Check, Link2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ShareComposition({
  url,
  title,
  disabled,
}: {
  url: string;
  title: string;
  disabled?: boolean;
}) {
  const [status, setStatus] = useState<"idle" | "copied" | "shared">("idle");

  async function onShare() {
    if (disabled || !url) return;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title, url, text: title });
        setStatus("shared");
      } else {
        await navigator.clipboard.writeText(url);
        setStatus("copied");
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(url);
        setStatus("copied");
      } catch {
        return;
      }
    }
    window.setTimeout(() => setStatus("idle"), 1800);
  }

  const label = status === "copied" ? "Link copied" : status === "shared" ? "Shared" : "Copy review link";

  return (
    <Button type="button" variant="secondary" size="sm" disabled={disabled} onClick={() => void onShare()}>
      {status === "idle" ? <Link2 className="size-4" /> : <Check className="size-4" />}
      {label}
    </Button>
  );
}
