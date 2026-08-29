import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from "react-router-dom";
import { GuidePage } from "./pages/Guide";
import { HomePage } from "./pages/Home";
import { RegisterPage } from "./pages/Register";
import { PassportPage } from "./pages/Passport";
import { CredentialsPage } from "./pages/Credentials";
import { VerifyPage } from "./pages/Verify";
import { DeveloperVerifyPage } from "./pages/DeveloperVerify";
import { EASPage } from "./pages/EAS";
import { WorldIdPage } from "./pages/WorldId";
import { Web2ProofPage } from "./pages/Web2Proof";
import { OpenID3IdentityPage } from "./pages/OpenID3Identity";
import { ZKPassportPage } from "./pages/ZKPassport";
import { StudioLayout } from "./pages/studio/StudioLayout";
import { ServiceVerifyPage } from "./pages/services/ServiceVerify";
import { Navbar } from "./components/ui/Navbar";
import { ToastContainer } from "./components/shared/Toast";
import { PassportProvider as ArcPassportProvider } from "./contexts/PassportContext";
import { PassportErrorBoundary } from "./components/shared/PassportErrorBoundary";
import { ChainStatusBar } from "./components/landing/ChainStatusBar";
import "./styles/landing.css";

function Footer() {
  return (
    <footer className="page" style={{ paddingTop: "var(--space-16)", paddingBottom: "var(--space-8)" }}>
      <div
        style={{
          borderTop: "1px solid var(--color-border)",
          paddingTop: "var(--space-6)",
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--space-4)",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "var(--text-xs)",
          color: "var(--color-subtle)",
        }}
      >
        <span className="mono">ArcPass — identity · attestation · verification</span>
        <span className="mono">
          Arc Testnet · chain <span className="t-key">5042002</span>
        </span>
      </div>
    </footer>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <PassportProvider>
        <AppInner />
        <ToastContainer />
      </PassportProvider>
    </BrowserRouter>
  );
}

function AppInner() {
  const { pathname } = useLocation();
  const isHome = pathname === "/";

  return (
    <div className="min-h-screen flex flex-col">
      {isHome && <ChainStatusBar />}
      <Navbar className={isHome ? "nav--landing" : undefined} />
      <main
        className={`flex-1 animate-page ${isHome ? "" : "page"}`}
        style={isHome ? undefined : { paddingTop: "var(--space-8)", paddingBottom: "var(--space-16)" }}
      >
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/guide" element={<GuidePage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/passport" element={<PassportPage />} />
          <Route path="/passport/:address" element={<PassportPage />} />
          <Route path="/credentials" element={<CredentialsPage />} />
          <Route path="/verify" element={<VerifyPage />} />
          {/* Score collapsed into Passport Overview — ScoreDisplay lives inside PassportCard */}
          <Route path="/score" element={<Navigate to="/passport" replace />} />
          <Route path="/score/:address" element={<ScoreRedirect />} />
          {/* History collapsed into Passport Activity — RegisterHistory lives as a tab */}
          <Route path="/register-history" element={<Navigate to="/passport" replace />} />
          <Route path="/register-history/:address" element={<RegisterHistoryRedirect />} />
          <Route path="/zk" element={<ZKPassportPage />} />
          <Route path="/eas" element={<EASPage />} />
          <Route path="/eas/schemas/:uid" element={<EASPage />} />
          <Route path="/eas/attestations/:uid" element={<EASPage />} />
          <Route path="/eas/verify/:address" element={<EASPage />} />
          <Route path="/world-id" element={<WorldIdPage />} />
          <Route path="/web2-proof" element={<Web2ProofPage />} />
          <Route path="/openid3" element={<OpenID3IdentityPage />} />
          <Route path="/developer/verify" element={<DeveloperVerifyPage />} />
          <Route path="/services/:service" element={<ServiceVerifyPage />} />
          <Route path="/services/:service/:address" element={<ServiceVerifyPage />} />
          {/* Legacy redirects */}
          <Route path="/issue" element={<Navigate to="/studio/issue" replace />} />
          <Route path="/schema" element={<Navigate to="/studio/schemas" replace />} />
          <Route path="/studio/*" element={<StudioLayout />} />
        </Routes>
      </main>
      {!isHome && <Footer />}
    </div>
  );
}

function ScoreRedirect() {
  const { address } = useParams<{ address: string }>();
  return <Navigate to={address ? `/passport/${address}` : "/passport"} replace />;
}

function RegisterHistoryRedirect() {
  const { address } = useParams<{ address: string }>();
  return <Navigate to={address ? `/passport/${address}` : "/passport"} replace />;
}

function PassportProvider({ children }: { children: React.ReactNode }) {
  return (
    <PassportErrorBoundary>
      <ArcPassportProvider>{children}</ArcPassportProvider>
    </PassportErrorBoundary>
  );
}
