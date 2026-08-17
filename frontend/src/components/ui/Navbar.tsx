import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { LogoMark } from "./LogoMark";
import { WalletChip } from "./WalletChip";

const NAV_LINKS = [
  { to: "/", label: "Home", exact: true },
  { to: "/guide", label: "Guide" },
  { to: "/register", label: "Register" },
  { to: "/schema", label: "Schema" },
  { to: "/passport", label: "Passport" },
  { to: "/verify", label: "Verify" },
  { to: "/issue", label: "Issue" },
  { to: "/studio", label: "Studio" },
];

export function Navbar() {
  const { pathname } = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close the drawer on navigation and lock body scroll while open
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  // Close drawer on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <nav className="nav" aria-label="Main">
      <div className="nav__inner">
        <Link to="/" className="nav__brand" aria-label="ArcPass home">
          <LogoMark size={22} />
          ArcPass
        </Link>

        <div className="nav__links">
          {NAV_LINKS.map(({ to, label, exact }) => (
            <Link
              key={to}
              to={to}
              className={`nav__link ${(exact ? pathname === to : pathname.startsWith(to)) ? "nav__link--active" : ""}`}
              aria-current={(exact ? pathname === to : pathname.startsWith(to)) ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </div>

        <div className="nav__right">
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
            {NAV_LINKS.map(({ to, label, exact }) => {
              const active = exact ? pathname === to : pathname.startsWith(to);
              return (
                <Link key={to} to={to} className={`drawer__link ${active ? "drawer__link--active" : ""}`} aria-current={active ? "page" : undefined}>
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}
