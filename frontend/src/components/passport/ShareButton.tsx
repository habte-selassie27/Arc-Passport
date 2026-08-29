import { useState, useCallback } from "react";
import { Button } from "../ui/Button";
import { Spinner } from "../ui/Spinner";
import { exportCoverCard } from "../../utils/exportCoverCard";
import type { PassportDocument } from "../../types/passport";

interface ShareButtonProps {
  passport: PassportDocument;
  variant?: "primary" | "ghost";
  size?: "sm" | "md";
}

export function ShareButton({ passport, variant = "ghost", size = "sm" }: ShareButtonProps) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = useCallback(async () => {
    setExporting(true);
    setError(null);
    try {
      const blob = await exportCoverCard(passport);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `arcpass-${passport.address.slice(0, 10)}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError("Export failed — try again");
      console.error("Cover card export failed:", err);
    } finally {
      setExporting(false);
    }
  }, [passport]);

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-start", gap: "var(--space-1)" }}>
      <Button
        variant={variant}
        size={size}
        onClick={handleExport}
        disabled={exporting}
        loading={exporting}
      >
        {exporting ? (
          <><Spinner size={12} /> Exporting…</>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
            Share passport
          </>
        )}
      </Button>
      {error && (
        <span className="t-xs" style={{ color: "var(--color-danger)" }}>{error}</span>
      )}
    </div>
  );
}
