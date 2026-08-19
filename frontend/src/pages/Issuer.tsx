import { Navigate } from "react-router-dom";

/** Redirect legacy /issue route to the Issuer Dashboard */
export function IssuerPage() {
  return <Navigate to="/studio/credentials/issue" replace />;
}
