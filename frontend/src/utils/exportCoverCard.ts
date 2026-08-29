import type { PassportDocument } from "../types/passport";

/**
 * Render the cover card to a canvas and export as a PNG Blob.
 * Uses a foreignObject SVG approach for crisp text + vector rendering.
 */
export async function exportCoverCard(
  passport: PassportDocument
): Promise<Blob> {
  const WIDTH = 1200;
  const HEIGHT = 630;

  // Build the HTML for the card
  const html = buildCardHTML(passport);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
    <foreignObject width="100%" height="100%">
      <div xmlns="http://www.w3.org/1999/xhtml" style="width:${WIDTH}px;height:${HEIGHT}px;">
        ${html}
      </div>
    </foreignObject>
  </svg>`;

  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  try {
    const img = new Image();
    img.crossOrigin = "anonymous";

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not available");

    // Draw the rendered SVG
    ctx.drawImage(img, 0, 0, WIDTH, HEIGHT);

    // Convert to PNG blob
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Canvas toBlob failed"))),
        "image/png"
      );
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function countValid(p: PassportDocument): number {
  return (Object.values(p.services) as { claims: { valid: boolean }[] }[])
    .flatMap((s) => s.claims ?? [])
    .filter((c) => c.valid).length;
}

function countTotal(p: PassportDocument): number {
  return (Object.values(p.services) as { claims: unknown[] }[]).reduce(
    (sum, s) => sum + (s.claims?.length ?? 0), 0
  );
}

function countIssuers(p: PassportDocument): number {
  const s = new Set(
    (Object.values(p.services) as { claims: { issuer: string }[] }[])
      .flatMap((sv) => sv.claims ?? [])
      .map((c) => c.issuer.toLowerCase())
  );
  return s.size;
}

function countServices(p: PassportDocument): number {
  return (Object.values(p.services) as { claims: { valid: boolean }[] }[]).filter(
    (sv) => (sv.claims ?? []).some((c) => c.valid)
  ).length;
}

function buildCardHTML(p: PassportDocument): string {
  const valid = countValid(p);
  const total = countTotal(p);
  const issuers = countIssuers(p);
  const services = countServices(p);
  const isVerified = valid > 0;
  const name = p.metadata?.name || "Unregistered";
  const addrShort = `${p.address.slice(0, 6)}...${p.address.slice(-4)}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(`https://arcpass.app/passport/${p.address}`)}&bgcolor=transparent&color=E2E8F0`;

  const verifiedColor = "#00E5A0";
  const warnColor = "#F59E0B";
  const scoreColor = isVerified ? verifiedColor : warnColor;

  return `
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #080B12; font-family: 'Inter', -apple-system, system-ui, sans-serif; }
  .card {
    width: 1200px; height: 630px;
    background: #0D1117;
    border: 1px solid #1E2D40;
    border-radius: 16px;
    overflow: hidden;
    display: flex; flex-direction: column;
    position: relative;
  }
  .gradient {
    height: 4px; width: 100%;
    background: linear-gradient(90deg, #3B82F6, #00E5A0, #3B82F6);
  }
  .header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 20px 32px 0;
  }
  .brand { display: flex; align-items: center; gap: 8px; }
  .brand-text { font-weight: 700; font-size: 16px; color: #F8FAFC; letter-spacing: -0.02em; }
  .chain { font-size: 12px; color: #475569; display: flex; align-items: center; gap: 6px; }
  .chain-dot { width: 6px; height: 6px; border-radius: 50%; background: ${verifiedColor}; }
  .body {
    display: flex; justify-content: space-between; align-items: center;
    padding: 28px 32px 0; flex: 1;
  }
  .identity { display: flex; flex-direction: column; gap: 6px; }
  .avatar {
    width: 52px; height: 52px; border-radius: 50%;
    background: #131924; border: 1px solid #1E2D40;
    display: flex; align-items: center; justify-content: center;
  }
  .avatar svg { width: 24px; height: 24px; color: #3B82F6; }
  .name { font-size: 28px; font-weight: 700; color: #F8FAFC; letter-spacing: -0.03em; }
  .address { font-family: 'JetBrains Mono', monospace; font-size: 14px; color: #475569; }
  .qr-section { display: flex; flex-direction: column; align-items: center; gap: 8px; }
  .qr { border-radius: 8px; overflow: hidden; background: #131924; padding: 8px; }
  .verified-badge {
    display: flex; align-items: center; gap: 6px;
    font-size: 12px; font-weight: 600; color: ${verifiedColor};
    padding: 4px 10px; border-radius: 20px;
    background: rgba(0,229,160,0.1); border: 1px solid rgba(0,229,160,0.3);
  }
  .verified-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: ${verifiedColor}; animation: pulse 2s ease-in-out infinite;
  }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.35} }
  .stats {
    display: flex; justify-content: center; gap: 0;
    padding: 20px 32px; border-top: 1px solid rgba(30,45,64,0.5);
  }
  .stat { display: flex; flex-direction: column; align-items: center; gap: 2px; flex: 1; }
  .stat-value { font-family: 'JetBrains Mono', monospace; font-size: 20px; font-weight: 700; color: #F8FAFC; }
  .stat-label { font-size: 11px; color: #475569; text-transform: uppercase; letter-spacing: 0.08em; }
  .stat-divider { width: 1px; background: rgba(30,45,64,0.5); margin: 4px 0; }
  .services {
    display: flex; gap: 6px; padding: 0 32px 16px; flex-wrap: wrap;
  }
  .service-chip {
    display: inline-flex; align-items: center; gap: 4px;
    font-size: 11px; color: #94A3B8;
    padding: 3px 8px; border-radius: 6px;
    border: 1px solid #1E2D40; background: rgba(19,25,36,0.6);
  }
  .footer {
    display: flex; justify-content: space-between; align-items: center;
    padding: 12px 32px;
    border-top: 1px solid rgba(30,45,64,0.5);
  }
  .footer-text { font-size: 12px; color: #3B82F6; font-weight: 500; }
  .footer-id { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #475569; }
</style>
<div class="card">
  <div class="gradient"></div>
  <div class="header">
    <div class="brand">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <rect x="12" y="2.6" width="13.3" height="13.3" rx="2.5" transform="rotate(45 12 2.6)" stroke="#3B82F6" stroke-width="1.8" fill="rgba(59,130,246,0.12)"/>
        <circle cx="12" cy="12" r="3" fill="#3B82F6"/>
      </svg>
      <span class="brand-text">ArcPass</span>
    </div>
    <div class="chain">
      <span class="chain-dot"></span>
      Arc Testnet
    </div>
  </div>
  <div class="body">
    <div class="identity">
      <div class="avatar">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <rect x="12" y="2.6" width="13.3" height="13.3" rx="2.5" transform="rotate(45 12 2.6)" stroke="currentColor" stroke-width="1.8" fill="rgba(59,130,246,0.12)"/>
          <circle cx="12" cy="12" r="3" fill="currentColor"/>
        </svg>
      </div>
      <div class="name">${escapeHtml(name)}</div>
      <div class="address">${escapeHtml(addrShort)}</div>
    </div>
    <div class="qr-section">
      <div class="qr">
        <img src="${qrUrl}" width="120" height="120" alt="QR" style="display:block;" />
      </div>
      ${isVerified ? `<div class="verified-badge"><span class="verified-dot"></span>Verified</div>` : ""}
    </div>
  </div>
  <div class="stats">
    <div class="stat">
      <span class="stat-value" style="color:${scoreColor}">${valid}/${total}</span>
      <span class="stat-label">Credentials</span>
    </div>
    <div class="stat-divider"></div>
    <div class="stat">
      <span class="stat-value">${issuers}</span>
      <span class="stat-label">Issuers</span>
    </div>
    <div class="stat-divider"></div>
    <div class="stat">
      <span class="stat-value">${services}</span>
      <span class="stat-label">Services</span>
    </div>
  </div>
  <div class="footer">
    <span class="footer-text">View on ArcScan →</span>
    <span class="footer-id">#${p.identityId > 0 ? p.identityId : "—"}</span>
  </div>
</div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
