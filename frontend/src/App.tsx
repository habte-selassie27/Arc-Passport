import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { GuidePage } from "./pages/Guide";
import { HomePage } from "./pages/Home";
import { RegisterPage } from "./pages/Register";
import { SchemaPage } from "./pages/Schema";
import { PassportPage } from "./pages/Passport";
import { IssuerPage } from "./pages/Issuer";
import { VerifyPage } from "./pages/Verify";
import { StudioPage } from "./pages/studio/Studio";
import { ServiceVerifyPage } from "./pages/services/ServiceVerify";
import { Navbar } from "./components/ui/Navbar";
import { ToastContainer } from "./components/shared/Toast";
import { PassportProvider as ArcPassportProvider } from "./contexts/PassportContext";
import { PassportErrorBoundary } from "./components/shared/PassportErrorBoundary";

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
        <div className="min-h-screen flex flex-col">
          <Navbar />
          <main className="page flex-1 animate-page" style={{ paddingTop: "var(--space-8)", paddingBottom: "var(--space-16)" }}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/guide" element={<GuidePage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/schema" element={<SchemaPage />} />
              <Route path="/passport" element={<PassportPage />} />
              <Route path="/passport/:address" element={<PassportPage />} />
              <Route path="/issue" element={<IssuerPage />} />
              <Route path="/verify" element={<VerifyPage />} />
              <Route path="/studio/*" element={<StudioPage />} />
              <Route path="/services/:service" element={<ServiceVerifyPage />} />
              <Route path="/services/:service/:address" element={<ServiceVerifyPage />} />
            </Routes>
          </main>
          <Footer />
        </div>
        <ToastContainer />
      </PassportProvider>
    </BrowserRouter>
  );
}

function PassportProvider({ children }: { children: React.ReactNode }) {
  return (
    <PassportErrorBoundary>
      <ArcPassportProvider>{children}</ArcPassportProvider>
    </PassportErrorBoundary>
  );
}
