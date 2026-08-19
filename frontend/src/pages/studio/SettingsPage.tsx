import { Settings } from "../../components/studio/Settings";

export function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="display--medium t-xl" style={{ marginBottom: "var(--space-1)" }}>Settings</h1>
        <p className="t-sm c-muted">Per-service issuer wallet configuration status.</p>
      </div>
      <Settings />
    </div>
  );
}
