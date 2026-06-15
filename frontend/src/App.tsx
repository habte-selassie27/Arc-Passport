import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import { GuidePage } from "./pages/Guide";
import { HomePage } from "./pages/Home";
import { RegisterPage } from "./pages/Register";
import { SchemaPage } from "./pages/Schema";
import { PassportPage } from "./pages/Passport";
import { IssuerPage } from "./pages/Issuer";
import { VerifyPage } from "./pages/Verify";
import { BridgePage } from "./pages/Bridge";
import { StudioPage } from "./pages/studio/Studio";
import { KycVerifyPage } from "./pages/services/KycVerify";
import { CredentialViewPage } from "./pages/services/CredentialView";
import { ReputationViewPage } from "./pages/services/ReputationView";
import { WalletButton } from "./components/shared/WalletButton";
import { ThemeToggle } from "./components/shared/ThemeToggle";
import { ToastContainer } from "./components/shared/Toast";
import { ThemeProvider } from "./contexts/ThemeContext";
import { PassportProvider as ArcPassportProvider } from "./contexts/PassportContext";
import { PassportErrorBoundary } from "./components/shared/PassportErrorBoundary";

const NAV_LINKS = [
  { to: "/", label: "Home" },
  { to: "/guide", label: "Guide" },
  { to: "/register", label: "Register" },
  { to: "/schema", label: "Schema" },
  { to: "/passport", label: "Passport" },
  { to: "/verify", label: "Verify" },
  { to: "/issue", label: "Issue" },
  { to: "/bridge", label: "Bridge" },
  { to: "/studio", label: "Studio" },
];

function NavBar() {
  const { pathname } = useLocation();

  return (
    <nav className="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-800 sticky top-0 z-40 transition-colors">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to="/" className="text-lg font-bold text-gray-900 dark:text-white">
            ArcPass
          </Link>
          {NAV_LINKS.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={`text-sm transition-colors ${
                pathname === to
                  ? "text-blue-600 dark:text-blue-400 font-semibold"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <WalletButton />
        </div>
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <PassportProvider>
          <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
            <NavBar />
            <main className="max-w-5xl mx-auto animate-fade-in">
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/guide" element={<GuidePage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/schema" element={<SchemaPage />} />
                <Route path="/passport" element={<PassportPage />} />
                <Route path="/passport/:address" element={<PassportPage />} />
                <Route path="/issue" element={<IssuerPage />} />
                <Route path="/verify" element={<VerifyPage />} />
                <Route path="/bridge" element={<BridgePage />} />
                <Route path="/studio/*" element={<StudioPage />} />
                <Route path="/services/kyc" element={<KycVerifyPage />} />
                <Route path="/services/kyc/:address" element={<KycVerifyPage />} />
                <Route path="/services/credentials/:address" element={<CredentialViewPage />} />
                <Route path="/services/reputation/:address" element={<ReputationViewPage />} />
              </Routes>
            </main>
          </div>
          <ToastContainer />
        </PassportProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

function PassportProvider({ children }: { children: React.ReactNode }) {
  return (
    <PassportErrorBoundary>
      <ArcPassportProvider>{children}</ArcPassportProvider>
    </PassportErrorBoundary>
  );
}
