import { QRCodeSVG } from "qrcode.react";
import { LogoMark } from "../ui/LogoMark";
import type { PassportDocument, ServiceKey } from "../../types/passport";

interface CoverCardProps {
  passport: PassportDocument;
  /** Render at reduced scale for canvas export (no hover effects). */
  exportMode?: boolean;
}

/** Count valid claims across all services. */
function countValid(passport: PassportDocument): number {
  return (Object.values(passport.services) as { claims: { valid: boolean }[] }[])
    .flatMap((s) => s.claims ?? [])
    .filter((c) => c.valid).length;
}

/** Count total claims. */
function countTotal(passport: PassportDocument): number {
  return (Object.values(passport.services) as { claims: unknown[] }[]).reduce(
    (sum, s) => sum + (s.claims?.length ?? 0), 0
  );
}

/** Count unique issuers. */
function countIssuers(passport: PassportDocument): number {
  const issuers = new Set(
    (Object.values(passport.services) as { claims: { issuer: string }[] }[])
      .flatMap((s) => s.claims ?? [])
      .map((c) => c.issuer.toLowerCase())
  );
  return issuers.size;
}

/** Count services with valid claims. */
function countServices(passport: PassportDocument): number {
  return (Object.entries(passport.services) as [ServiceKey, { claims: { valid: boolean }[] }][]).filter(
    ([, s]) => (s.claims ?? []).some((c) => c.valid)
  ).length;
}

/** Count services with any claims. */
function countServicesWithClaims(passport: PassportDocument): number {
  return (Object.entries(passport.services) as [ServiceKey, { claims: unknown[] }][]).filter(
    ([, s]) => (s.claims?.length ?? 0) > 0
  ).length;
}

const SERVICE_ICONS: Record<string, string> = {
  identity: "🪪",
  kyc: "🛡️",
  credentials: "📜",
  dao: "🏛️",
  reputation: "⭐",
  employment: "💼",
  education: "🎓",
  social: "🔗",
  custom: "✨",
  zkPassport: "🔒",
};

const SERVICE_COLORS: Record<string, string> = {
  identity:    "#3B82F6",
  kyc:         "#00E5A0",
  credentials: "#8B5CF6",
  dao:         "#F59E0B",
  reputation:  "#EC4899",
  employment:  "#06B6D4",
  education:   "#10B981",
  social:      "#F97316",
  custom:      "#6366F1",
  zkPassport:  "#A855F7",
};

export function CoverCard({ passport, exportMode = false }: CoverCardProps) {
  const valid = countValid(passport);
  const total = countTotal(passport);
  const issuers = countIssuers(passport);
  const services = countServices(passport);
  const totalServices = countServicesWithClaims(passport);
  const isVerified = valid > 0;
  const name = passport.metadata?.name;
  const qrValue = `${typeof window !== "undefined" ? window.location.origin : "https://arcpass.app"}/passport/${passport.address}`;

  const activeServices = (Object.entries(passport.services) as [ServiceKey, { claims: { valid: boolean }[] }][]).filter(
    ([, s]) => (s.claims ?? []).some((c) => c.valid)
  );

  const allClaimsFlat = (Object.values(passport.services) as { claims: { valid: boolean; issuer: string }[] }[]).flatMap((s) => s.claims ?? []);
  const allSelfIssued = allClaimsFlat.length > 0 && allClaimsFlat.every((c) => c.issuer.toLowerCase() === passport.address.toLowerCase());

  return (
    <div
      className={`cover-card ${exportMode ? "cover-card--export" : ""}`}
      role="img"
      aria-label={`ArcPass passport for ${passport.address}`}
    >
      {/* Top gradient bar */}
      <div className="cover-card__gradient" />

      {/* Header: Logo + Arc branding */}
      <div className="cover-card__header">
        <div className="cover-card__brand">
          <LogoMark size={18} />
          <span className="cover-card__brand-text">ArcPass</span>
        </div>
        <div className="cover-card__chain">
          <span className="cover-card__chain-dot" />
          Arc Testnet
        </div>
      </div>

      {/* Main content */}
      <div className="cover-card__body">
        {/* Left: Identity */}
        <div className="cover-card__identity">
          <div className="cover-card__avatar">
            <LogoMark size={28} />
          </div>
          <div className="cover-card__name">
            {name || (passport.scanIncomplete ? "Identity registered" : "Unregistered")}
          </div>
          <div className="cover-card__address">
            {passport.address.slice(0, 6)}...{passport.address.slice(-4)}
          </div>
        </div>

        {/* Right: QR + Verification */}
        <div className="cover-card__qr-section">
          <div className="cover-card__qr">
            <QRCodeSVG
              value={qrValue}
              size={exportMode ? 80 : 72}
              bgColor="transparent"
              fgColor="#E2E8F0"
              level="M"
              includeMargin={false}
            />
          </div>
          {isVerified && (
            <div className="cover-card__verified-badge">
              <span className="cover-card__verified-dot" />
              Verified
            </div>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="cover-card__stats">
        <div className="cover-card__stat">
          <span className="cover-card__stat-value" style={{ color: isVerified ? "var(--color-verified)" : "var(--color-warn)" }}>
            {valid}/{total}
          </span>
          <span className="cover-card__stat-label">Credentials</span>
        </div>
        <div className="cover-card__stat-divider" />
        <div className="cover-card__stat">
          <span className="cover-card__stat-value">{issuers}</span>
          <span className="cover-card__stat-label">Issuers</span>
        </div>
        <div className="cover-card__stat-divider" />
        <div className="cover-card__stat">
          <span className="cover-card__stat-value">{services}</span>
          <span className="cover-card__stat-label">Services</span>
        </div>
      </div>

      {/* Service chips */}
      {activeServices.length > 0 && (
        <div className="cover-card__services">
          {activeServices.slice(0, 5).map(([key]) => (
            <span
              key={key}
              className="cover-card__service-chip"
              style={{ borderColor: SERVICE_COLORS[key] || "var(--color-border)" }}
            >
              <span>{SERVICE_ICONS[key] || "•"}</span>
              <span>{key.charAt(0).toUpperCase() + key.slice(1)}</span>
            </span>
          ))}
          {activeServices.length > 5 && (
            <span className="cover-card__service-chip cover-card__service-chip--more">
              +{activeServices.length - 5}
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="cover-card__footer">
        <span className="cover-card__footer-text">
          View on ArcScan →
        </span>
        <span className="cover-card__footer-id">
          #{passport.identityId > 0 ? passport.identityId : passport.scanIncomplete ? "…" : "—"}
        </span>
      </div>
    </div>
  );
}
