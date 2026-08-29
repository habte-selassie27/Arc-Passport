import { useEffect, useState } from "react";

const INITIAL_BLOCK = 4_812_304;

export function ChainStatusBar() {
  const [block, setBlock] = useState(INITIAL_BLOCK);

  useEffect(() => {
    const id = setInterval(() => {
      setBlock((b) => b + Math.floor(Math.random() * 3) + 1);
    }, 3000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="chain-bar" role="status" aria-label="Chain status">
      <div className="chain-bar__stats">
        <div className="chain-bar__stat">
          <span className="live-dot" aria-hidden="true" />
          <span style={{ color: "var(--color-verified)" }}>Live</span>
        </div>
        <div className="chain-bar__stat">
          <span className="chain-bar__label">Block</span>
          <span className="chain-bar__value">#{block.toLocaleString()}</span>
        </div>
        <div className="chain-bar__stat">
          <span className="chain-bar__label">Claims</span>
          <span className="chain-bar__value">24,891</span>
        </div>
        <div className="chain-bar__stat">
          <span className="chain-bar__label">Issuers</span>
          <span className="chain-bar__value">147</span>
        </div>
      </div>
      <div className="chain-bar__right">
        <span className="chain-bar__chain-id">CHAIN 5042002</span>
        <span className="chain-bar__network">ARC TESTNET</span>
      </div>
    </div>
  );
}
