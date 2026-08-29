import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { LogoMark } from "./LogoMark";
import { WalletChip } from "./WalletChip";

const NAV_LINKS = [
  { to: "/", label: "Home" },
  { to: "/passport", label: "Passport" },
  { to: "/register", label: "Register" },
  { to: "/credentials", label: "Credentials" },
  { to: "/verify", label: "Verify" },
];

const STUDIO_LINK = { to: "/studio", label: "Studio" };

export function Navbar({ className }: { className?: string } = {}) {
  const { pathname } = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const inStudio = pathname.startsWith("/studio");

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <nav className={`nav ${inStudio ? "nav--hidden" : ""} ${className ?? ""}`} aria-label="Main">
      <div className="nav__inner">
        <Link to="/" className="nav__brand" aria-label="ArcPass home">
          <LogoMark size={22} />
          ArcPass
        </Link>

        <div className="nav__links">
          {NAV_LINKS.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={`nav__link ${pathname.startsWith(to) ? "nav__link--active" : ""}`}
              aria-current={pathname.startsWith(to) ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </div>

        <div className="nav__right">
          <Link
            to={STUDIO_LINK.to}
            className={`nav__link ${pathname.startsWith(STUDIO_LINK.to) ? "nav__link--active" : ""}`}
            aria-current={pathname.startsWith(STUDIO_LINK.to) ? "page" : undefined}
            style={{ opacity: 0.7, fontSize: "var(--text-sm)" }}
          >
            {STUDIO_LINK.label}
          </Link>
          <WalletChip />
          <button
            type="button"
            className="nav__burger"
            aria-label={drawerOpen ? "Close menu" : "Open menu"}
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen((v) => !v)}
          >
            {drawerOpen ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M3 12h18M3 6h18M3 18h18" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {drawerOpen && (
        <div className="drawer" onClick={() => setDrawerOpen(false)}>
          <div className="drawer__panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Menu">
            {NAV_LINKS.map(({ to, label }) => {
              const active = pathname.startsWith(to);
              return (
                <Link key={to} to={to} className={`drawer__link ${active ? "drawer__link--active" : ""}`} aria-current={active ? "page" : undefined}>
                  {label}
                </Link>
              );
            })}
            <div style={{ borderTop: "1px solid var(--color-border)", marginTop: "var(--space-3)", paddingTop: "var(--space-3)" }}>
              <Link
                to={STUDIO_LINK.to}
                className={`drawer__link ${pathname.startsWith(STUDIO_LINK.to) ? "drawer__link--active" : ""}`}
                aria-current={pathname.startsWith(STUDIO_LINK.to) ? "page" : undefined}
              >
                {STUDIO_LINK.label}
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
