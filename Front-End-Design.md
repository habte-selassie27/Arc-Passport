# ArcPass — FRONTEND_DESIGN.md

> **Design mandate:** ArcPass is infrastructure. It stores trust on a blockchain. The visual language should feel like a precision instrument — not a crypto hype site, not a SaaS dashboard clone. Think: the UI a cryptographer would design if they also cared about UX. Cold, exact, deliberate. Every element earns its place.

---

## 1. Design Philosophy

### Current state (what to fix)
The existing UI is a stock dark-mode React app: near-black background, default blue/orange Tailwind accents, flat nav, plain cards. Nothing is wrong, but nothing is memorable. The layout is a homepage of rectangles with white text. It communicates "I scaffolded this with a template" rather than "I built an identity protocol."

### Direction: Cryptographic Precision
ArcPass deals in commitments, proofs, and revocations — the vocabulary of cryptography. The design should reflect that world. Inspiration: hardware security keys, terminal UIs, zero-knowledge proof dashboards, passport book typography. The aesthetic risk: a **monospaced typographic system** for data and addresses, paired with a **sharp geometric grid** and a signature **verification glow** accent that only appears when something is confirmed valid on-chain.

---

## 2. Design Tokens

### 2.1 Color Palette

```
--color-void:        #080B12   /* page background — near-black with a blue undertone */
--color-surface-0:   #0D1117   /* card base */
--color-surface-1:   #131924   /* card elevated / hover */
--color-surface-2:   #1C2333   /* input background */
--color-border:      #1E2D40   /* default border */
--color-border-glow: #2A4060   /* border on hover */

--color-arc-primary: #3B82F6   /* Arc blue — existing brand, keep as primary action */
--color-arc-dim:     #1D4ED8   /* darker Arc blue for pressed states */

/* THE SIGNATURE ACCENT — verification confirmed */
--color-verified:    #00E5A0   /* cold mint-green — appears ONLY on valid/confirmed states */
--color-verified-bg: rgba(0, 229, 160, 0.06)

/* Status palette */
--color-warn:        #F59E0B   /* amber — pending / waiting */
--color-danger:      #EF4444   /* red — revoked / error */
--color-muted:       #94A3B8   /* secondary text */
--color-subtle:      #475569   /* tertiary text / placeholders */
--color-on-surface:  #E2E8F0   /* primary text */
--color-on-bright:   #F8FAFC   /* heading text */
```

**Why this palette:**  
The existing orange accent (`#F97316`) screams "faucet button" and competes with errors. Replacing it with Arc blue for actions and cold mint-green (`#00E5A0`) exclusively for verified states creates a Pavlovian signal: **when you see green, something has been confirmed on-chain**. Nowhere else does this color appear.

### 2.2 Typography

```
/* Display / Headings — geometric, authority */
--font-display: 'Space Grotesk', sans-serif;
  weights: 500, 700
  usage: page titles, section headers, card titles

/* Body — readable, modern */
--font-body: 'Inter', sans-serif;
  weights: 400, 500
  usage: paragraphs, labels, descriptions

/* Data / Mono — THE SIGNATURE ELEMENT */
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;
  weights: 400, 600
  usage: wallet addresses, schema IDs, claim IDs, hashes, code, 
         on-chain values, status badges, transaction data
```

**Type Scale:**
```
--text-xs:   0.6875rem  / 11px  — meta, eyebrow labels
--text-sm:   0.8125rem  / 13px  — secondary body, captions
--text-base: 0.9375rem  / 15px  — primary body
--text-lg:   1.125rem   / 18px  — card titles
--text-xl:   1.375rem   / 22px  — section headings
--text-2xl:  1.75rem    / 28px  — page titles (desktop)
--text-3xl:  2.25rem    / 36px  — hero headline
--text-hero: 3.5rem     / 56px  — landing hero (mobile: 2.25rem)
```

**Line heights:** headings `1.15`, body `1.6`, mono `1.4`  
**Letter spacing:** headings `-0.02em`, mono `0`, body `0`  
**Sentence case everywhere** — no ALL CAPS except status chips.

### 2.3 Spacing System (4px base)

```
--space-1:  4px
--space-2:  8px
--space-3:  12px
--space-4:  16px
--space-5:  20px
--space-6:  24px
--space-8:  32px
--space-10: 40px
--space-12: 48px
--space-16: 64px
--space-20: 80px
--space-24: 96px
```

### 2.4 Shape & Elevation

```
--radius-sm:  4px    /* chips, status badges */
--radius-md:  8px    /* inputs, small cards */
--radius-lg:  12px   /* cards */
--radius-xl:  16px   /* modals, panels */

--shadow-card: 0 1px 3px rgba(0,0,0,0.4), 0 0 0 1px var(--color-border);
--shadow-focus: 0 0 0 3px rgba(59, 130, 246, 0.35);
--shadow-verified: 0 0 0 1px rgba(0, 229, 160, 0.4), 
                   0 0 16px rgba(0, 229, 160, 0.12);
```

### 2.5 Motion

```
--ease-out-quart: cubic-bezier(0.25, 1, 0.5, 1);
--ease-in-out:    cubic-bezier(0.4, 0, 0.2, 1);

--duration-fast:   120ms
--duration-base:   220ms
--duration-slow:   380ms

/* Verified state glow pulse */
@keyframes verified-pulse {
  0%, 100% { box-shadow: var(--shadow-verified); }
  50%       { box-shadow: 0 0 0 1px rgba(0,229,160,0.6), 
                           0 0 28px rgba(0,229,160,0.22); }
}
/* Used ONLY on valid credential cards. Duration: 3s ease-in-out infinite */
```

**Reduced motion:** wrap all animations in `@media (prefers-reduced-motion: no-preference)`. Static states must read clearly without motion.

---

## 3. Global Components

### 3.1 Navbar

**Current problem:** flat horizontal list, no visual hierarchy, "Disconnect" is just a gray box.

**Redesign:**

```
Layout:
┌─────────────────────────────────────────────────────────────────┐
│  ◈ ArcPass          Home  Guide  Register  Schema  ...    [Wallet] │
└─────────────────────────────────────────────────────────────────┘

Height: 56px
Background: rgba(8, 11, 18, 0.85) with backdrop-blur(12px)
Border-bottom: 1px solid var(--color-border)
Position: sticky top-0, z-index 100
```

**Logo mark (`◈`):** A Unicode diamond with dot (`◈`) or a custom SVG — a square rotated 45° with an inner point — referencing the "attestation node" metaphor. Color: `var(--color-arc-primary)`. Paired with `ArcPass` in Space Grotesk 600 at `--text-lg`.

**Nav links:** Inter 400 `--text-sm` in `--color-muted`. Active state: `--color-on-bright` + a 2px bottom border in `--color-arc-primary`. No background pills.

**Wallet chip (right side):**
```
┌────────────────────────────────┐
│  ● 0x04e0...DB1b   Disconnect │
└────────────────────────────────┘

- Outer container: border 1px solid --color-border, radius --radius-md, px-3 py-1.5
- Address: JetBrains Mono --text-xs --color-muted
- Dot indicator: 6px circle, --color-verified when connected
- "Disconnect": Inter --text-xs --color-subtle, hover --color-danger
- No full button for disconnect — just text link
```

**Unconnected state:** Replace wallet chip with a single `Connect Wallet` button — Arc blue, `--radius-md`, `px-4 py-2`, Inter 500 `--text-sm`.

**Mobile:** Hamburger → slide-in drawer from right, same blur background.

---

### 3.2 Card

The base card is used everywhere. One spec, consistent:

```css
.card {
  background: var(--color-surface-0);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  transition: border-color var(--duration-base) var(--ease-out-quart),
              box-shadow var(--duration-base) var(--ease-out-quart);
}

.card:hover {
  border-color: var(--color-border-glow);
  box-shadow: 0 4px 24px rgba(0,0,0,0.3);
}

/* Clickable card — adds cursor and scale */
.card--interactive {
  cursor: pointer;
}
.card--interactive:hover {
  transform: translateY(-1px);
}
.card--interactive:active {
  transform: translateY(0);
}

/* Verified card — the signature green glow */
.card--verified {
  border-color: rgba(0, 229, 160, 0.3);
  animation: verified-pulse 3s ease-in-out infinite;
}
```

**Card anatomy:**
```
┌─────────────────────────────────────────┐
│  [eyebrow label]                        │
│  Card Title          [status chip]      │
│  Supporting description text            │
│                                         │
│  [data rows or content]                 │
│                                         │
│  [action button]           [secondary]  │
└─────────────────────────────────────────┘
```

---

### 3.3 Buttons

```
PRIMARY (Arc Blue):
  background: var(--color-arc-primary)
  color: white
  font: Inter 500 --text-sm
  padding: 10px 20px
  radius: --radius-md
  hover: background --color-arc-dim
  active: scale(0.98)
  disabled: opacity 0.4, cursor not-allowed

SECONDARY (Ghost):
  background: transparent
  border: 1px solid var(--color-border)
  color: var(--color-on-surface)
  hover: border-color --color-border-glow, background var(--color-surface-1)

DANGER:
  background: rgba(239, 68, 68, 0.12)
  border: 1px solid rgba(239, 68, 68, 0.35)
  color: #EF4444
  hover: background rgba(239, 68, 68, 0.2)

SUCCESS/CONFIRM:
  background: rgba(0, 229, 160, 0.12)
  border: 1px solid rgba(0, 229, 160, 0.35)
  color: var(--color-verified)
  hover: background rgba(0, 229, 160, 0.2)
  -- Use ONLY for "Confirm/Submit" after simulation passes --

LOADING STATE (all buttons):
  Show a 16px spinner (CSS border-radius animation) replacing the label
  Keep button dimensions stable (no layout shift)
```

**Button widths:** never `width: 100%` except in single-column mobile forms. Desktop forms: `fit-content`, aligned to form edge.

---

### 3.4 Form Inputs

```css
.input {
  background: var(--color-surface-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-on-surface);
  font-family: var(--font-body);
  font-size: var(--text-base);
  padding: 10px 14px;
  width: 100%;
  transition: border-color var(--duration-fast);
}
.input::placeholder { color: var(--color-subtle); }
.input:focus {
  outline: none;
  border-color: var(--color-arc-primary);
  box-shadow: var(--shadow-focus);
}
.input--mono {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  letter-spacing: 0.02em;
}
/* For address inputs, schema IDs, hash fields */

.input--valid {
  border-color: rgba(0, 229, 160, 0.5);
}
.input--error {
  border-color: var(--color-danger);
}
```

**Label:** Inter 500 `--text-sm` `--color-muted`, `margin-bottom: 6px`.  
**Helper text:** Inter 400 `--text-xs` `--color-subtle`, `margin-top: 4px`.  
**Error text:** same as helper, color `--color-danger`.

---

### 3.5 Status Chips

Inline badges used for claim state, schema version, service category:

```
VALID:     bg rgba(0,229,160,0.1)   | border rgba(0,229,160,0.3)   | text #00E5A0
REVOKED:   bg rgba(239,68,68,0.1)   | border rgba(239,68,68,0.3)   | text #EF4444
PENDING:   bg rgba(245,158,11,0.1)  | border rgba(245,158,11,0.3)  | text #F59E0B
EXPIRED:   bg rgba(148,163,184,0.1) | border rgba(148,163,184,0.3) | text #94A3B8

Font: JetBrains Mono 600 --text-xs
Padding: 2px 8px
Radius: --radius-sm
Text-transform: uppercase
Letter-spacing: 0.08em
```

---

### 3.6 Address Display

Wallet addresses and hashes appear in many places. Treat them as **structured data**, not plain text:

```jsx
<AddressDisplay address="0x04e0...DB1b" />
```

Renders as:
```
┌──────────────────────────────────────────┐
│  0x04e0...DB1b                     [copy]│
└──────────────────────────────────────────┘

Font: JetBrains Mono --text-sm
Color: --color-muted for the address
Copy icon: 14px, --color-subtle, hover --color-arc-primary
Show full address on hover (tooltip)
```

For full addresses (not truncated), color the `0x` prefix in `--color-subtle` and the hex body in `--color-on-surface` — creates visual rhythm in data-dense tables.

---

### 3.7 Simulation Preview Box

The existing "✓ Identity Registration — simulation passed" green box exists but looks like an afterthought. Redesign as a first-class pre-flight checklist:

```
┌─────────────────────────────────────────────────────┐
│  Pre-flight check                                   │
│                                                     │
│  ✓  Simulation passed                               │
│  ✓  Gas estimate: ~85,000                           │
│  ✓  register(ipfs://baf...aaaaaa)                   │
│                                                     │
│  Review the transaction above, then sign below.     │
└─────────────────────────────────────────────────────┘

Background: rgba(0, 229, 160, 0.04)
Border: 1px solid rgba(0, 229, 160, 0.2)
Radius: --radius-md
Font: JetBrains Mono --text-xs for the call data, Inter --text-sm for labels
Checkmarks: --color-verified
```

Failed simulation:
```
Background: rgba(239, 68, 68, 0.04)
Border: 1px solid rgba(239, 68, 68, 0.2)
✗  Simulation failed: ArcPass__NotIssuer
   Your wallet does not have issuer permissions.
```

---

### 3.8 Section Eyebrow

Before major sections or page headers:
```
CREDENTIAL REGISTRY            ← JetBrains Mono 600 --text-xs --color-subtle uppercase 0.12em spacing
Identity & Attestation         ← Space Grotesk 700 --text-2xl --color-on-bright
```

The eyebrow labels encode real domain context (the schema category, the chain name, the role) — not generic words like "SECTION 01."

---

### 3.9 Empty States

No more "Loading notifications..." spinner left floating on a blank card.

Pattern:
```
┌──────────────────────────────────────────────────────┐
│                                                      │
│              ◈                                       │
│    No credentials yet                                │
│    Request a credential from an authorized issuer    │
│    or wait for one to be issued to your address.     │
│                                                      │
│    [Request a credential ↗]                          │
│                                                      │
└──────────────────────────────────────────────────────┘

Icon: the ArcPass logo mark ◈ at 32px, --color-subtle
Title: Space Grotesk 500 --text-lg --color-muted
Body: Inter 400 --text-sm --color-subtle, max-width 320px centered
Action: ghost button or text link
```

---

### 3.10 Error States

Current: red box with "Could not load passport / Failed to fetch passport." Fine, but cold.

Redesign adds context and action:

```
┌──────────────────────────────────────────────────────┐
│  ✗  Backend unavailable                              │
│                                                      │
│  The passport API at http://localhost:3001 isn't     │
│  responding. Start the backend:                      │
│                                                      │
│  $ npm run dev      ← in the backend/ directory      │
│                                                      │
│  On-chain reads (verify, view schemas) still work.   │
│                       [Retry]                        │
└──────────────────────────────────────────────────────┘

Border: 1px solid rgba(239,68,68,0.25)
Background: rgba(239,68,68,0.04)
Mono block: --color-surface-2 bg, --color-verified text (terminal feel)
"Retry": ghost button right-aligned
```

---

## 4. Page-by-Page Specs

---

### 4.1 Home (`/`)

**Current problems:**
- Hero is just centered text — no visual gravity
- "Faucet" button is jarring orange, treated as equal importance to navigation
- Cards are identical rectangles with no visual hierarchy
- No sense of what ArcPass actually does at a glance

**Redesigned layout:**

```
┌───────────────────────────────────────────────────────────────┐
│  NAVBAR                                                       │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│                    HERO                                       │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                                                         │ │
│  │   IDENTITY INFRASTRUCTURE                               │ │
│  │   ArcPass                                               │ │
│  │   Onchain identity, attestation &                       │ │
│  │   passport protocol on Arc L1.                          │ │
│  │                                                         │ │
│  │   [Connect Wallet]   [Read the Guide →]                 │ │
│  │                                                         │ │
│  │   ─────────────────────────────────────────────         │ │
│  │   Connected: ● 0x04e0...DB1b   [Testnet USDC ↗]        │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌───────── HOW IT WORKS (3 steps, horizontal) ────────────┐ │
│  │  [Connect]  →  [Build passport]  →  [Get attested]     │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌─────────── ACTION GRID ─────────────────────────────────┐ │
│  │  [Register Identity]    [Register Schema]               │ │
│  │  [View Passport]        [Verify Credential]             │ │
│  │  [Issuer Studio ↗]                                      │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

**Hero section:**
```
Eyebrow:  "IDENTITY INFRASTRUCTURE"  — mono, --text-xs, --color-subtle, uppercase
H1:       "ArcPass"                  — Space Grotesk 700, --text-hero, --color-on-bright
           NO gradient fill — just white. Clean.
Subtitle: Inter 400, --text-lg, --color-muted, max-width 500px
Buttons:  Primary [Connect Wallet] + Ghost [Read the Guide →]
Connected state: the Connect Wallet button becomes the wallet chip (address + disconnect)
           Faucet link becomes a small text link: "Get testnet USDC ↗" next to the address
           NO separate orange button — it clutters the hero
```

**How it works strip:**  
3 items in a horizontal row, separated by `→` arrows. Each item:
```
[Icon]
Step title           — Inter 500 --text-base --color-on-surface
One-line desc        — Inter 400 --text-sm --color-muted
```
Icons: simple geometric SVG — key, passport book, checkmark shield. Monochrome `--color-subtle`.

**Action grid:**  
2-column on desktop, 1-column on mobile:

```
Each card:
┌─────────────────────────────────┐
│  [icon]  Register Identity      │
│          Create your onchain     │
│          identity               │
│                         [→]     │
└─────────────────────────────────┘

- Hover: border brightens, arrow shifts right 4px
- Icons: 20px, monochrome --color-arc-primary
- Title: Space Grotesk 600 --text-base
- Description: Inter 400 --text-sm --color-muted
- Arrow [→]: --color-subtle, transitions to --color-arc-primary on hover
```

**Issuer Studio card** is visually differentiated — slightly larger, spans full width:
```
┌────────────────────────────────────────────────────────┐
│  [Studio icon]   Issuer Studio                  [→]   │
│  ISSUER ROLE REQUIRED  ← status chip in amber          │
│  Issue attestations, manage schemas, bulk operations   │
└────────────────────────────────────────────────────────┘
```

---

### 4.2 Guide (`/guide`)

**Current problems:** All black on dark navy, text is crammed together with no visual breathing room. Steps are not visually connected.

**Redesign:**

```
Layout: Single-column, max-width 720px, centered, generous padding (--space-20 top/bottom).

Step structure:
┌────────────────────────────────────────────────────────┐
│  STEP 01                                               │
│  ─────                                                 │
│  What is ArcPass?                                      │
│                                                        │
│  Body text with real line-height...                    │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │  ℹ  Your data stays private.                    │  │
│  │  ArcPass stores only a Merkle commitment         │  │
│  │  on-chain — never raw personal data.             │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

Step numbers: JetBrains Mono 600 `--text-xs` `--color-subtle`, uppercase `STEP 01`.  
Step title: Space Grotesk 600 `--text-xl`.  
Vertical connector: a 1px dashed line in `--color-border` connecting step blocks.

**Callout boxes** (info / warning / tip):
```
[ℹ / ⚠ / ✓] Type       — mono --text-xs uppercase, colored per type
  Body text              — Inter 400 --text-sm

Info:    border-left 3px solid --color-arc-primary; bg rgba(59,130,246,0.05)
Warning: border-left 3px solid --color-warn;        bg rgba(245,158,11,0.05)  
Tip:     border-left 3px solid --color-verified;    bg rgba(0,229,160,0.05)
```

**Code/terminal blocks** (wallet network config, commands):
```
background: #020408
border: 1px solid --color-border
border-radius: --radius-md
padding: --space-4 --space-5
font: JetBrains Mono --text-sm
line-height: 1.7
color: #E2E8F0

Key: --color-muted
Value: --color-on-bright
Comment (-- lines): --color-subtle
```

---

### 4.3 Register Identity (`/register`)

**Current problems:** Display name field has no label styling distinction. The IPFS URI field looks like a bug (it's pre-filled with `ipfs://bafkrei...aaa`). The simulation box is squished.

**Redesign:**

```
Page: max-width 560px centered

IDENTITY REGISTRATION
Register Identity
Create your verifiable onchain identity.

┌─────────────────────────────────────────────────────┐
│  Display Name                                       │
│  ┌───────────────────────────────────────────────┐  │
│  │  Your name                                    │  │
│  └───────────────────────────────────────────────┘  │
│  This name is stored publicly on the blockchain.    │
│                                                     │
│  Metadata URI (IPFS)                               │
│  ┌───────────────────────────────────────────────┐  │
│  │  ipfs://bafkrei...                  [Upload ↑]│  │
│  └───────────────────────────────────────────────┘  │
│  Optional. Upload your avatar or profile JSON.      │
│                                                     │
│  ┌── Pre-flight check ─────────────────────────────┐│
│  │  ✓ Simulation passed                           ││
│  │  ✓ register(ipfs://baf...aaaaaa)               ││
│  │  Review before signing.                        ││
│  └────────────────────────────────────────────────┘│
│                                                     │
│  [Register Identity]                                │
└─────────────────────────────────────────────────────┘
```

**IPFS URI input:** use `.input--mono` class. Add a small `[Upload ↑]` secondary action inline at right — opens Pinata file picker or drag-drop. The pre-filled placeholder `ipfs://bafkrei...` should be a real placeholder string, not the raw URI visible before the user has done anything.

**Register button:** PRIMARY blue, full-width within the form column only. Disabled until simulation passes.

---

### 4.4 Register Schema (`/schema`)

**Current problems:** "Register Schema" button sits disabled-green — inconsistent with the blue primary throughout. Field rows are fine but the type dropdown has no styling.

**Redesign:**

```
Page: max-width 640px centered

SCHEMA REGISTRY
Register Schema
Define a new claim schema. Schema ID is computed deterministically
from name + version + fields.

┌─────────────────────────────────────────────────────┐
│  Schema Name                                        │
│  ┌───────────────────────────────────────────────┐  │
│  │  kyc_basic                                    │  │
│  └───────────────────────────────────────────────┘  │
│  Use snake_case. e.g. kyc_basic, employment_record  │
│                                                     │
│  Version                                           │
│  ┌───────────────────────────────────────────────┐  │
│  │  3.0.0                                        │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  Fields                              [+ Add field]  │
│  ┌────────────────────────┐ ┌──────────────┐ [✕]   │
│  │  level                 │ │  uint8     ▼ │       │
│  └────────────────────────┘ └──────────────┘       │
│  ┌────────────────────────┐ ┌──────────────┐ [✕]   │
│  │  country               │ │  string    ▼ │       │
│  └────────────────────────┘ └──────────────┘       │
│                                                     │
│  ▶ Preview JSON                                     │
│  ┌─── schema_id: 0x... ─────────────────────────┐  │
│  │  { "name": "kyc_basic", "version": "3.0.0",  │  │
│  │    "fields": [...] }                          │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  [Register Schema onchain]                          │
└─────────────────────────────────────────────────────┘
```

**Type dropdown:** styled `select` with `--color-surface-2` background, `--color-border` border, mono font. Options: `string`, `uint8`, `uint256`, `bool`, `bytes32`, `address`.

**Preview JSON:** collapsible. When expanded shows a dark terminal-style block (see Guide terminal spec). Importantly, compute and display the **schema ID** at the top of the preview — `schema_id: 0x3f2a...` — this is what developers actually want.

**"+ Add field" button:** ghost button, right-aligned, `--text-sm`.

**Delete icon [✕]:** `--color-subtle`, hover `--color-danger`. 14px.

**Register button:** now PRIMARY blue (not green). Full-width within form column.

---

### 4.5 Passport (`/passport/:address`)

**Current problems:** "Could not load passport" error takes the entire viewport. The notification and credential request sections are buried. There's no visual representation of the passport itself.

**Redesign:**

```
Page: max-width 800px, centered

┌──── PASSPORT HEADER ──────────────────────────────────────────┐
│                                                               │
│  ┌─── Avatar ─┐   0x04e0...DB1b                [QR code]    │
│  │     [◈]    │   Display Name (or —)                        │
│  └────────────┘   Registered since block #...                │
│                   [Copy address] [View on explorer ↗]        │
│                                                               │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│                                                               │
│  SERVICE BADGES (inline, scrollable horizontally)            │
│  [● KYC] [● Identity] [○ Employment] [○ Education] ...       │
│  Filled dot = has valid credential. Empty = none.            │
└───────────────────────────────────────────────────────────────┘

┌──── CREDENTIALS ──────────────────────────────────────────────┐
│  KYC / Compliance                                             │
│  ┌────────────────────────────────────────────┐              │
│  │  arcpass_kyc_basic             VALID ●     │              │
│  │  Issuer: 0x1234...5678                     │              │
│  │  Issued: 2025-03-12 · Expires: 2026-03-12  │              │
│  │  Claim ID: 0xabcd...ef01       [Verify ↗]  │              │
│  └────────────────────────────────────────────┘              │
└───────────────────────────────────────────────────────────────┘
```

**Passport header:**  
- Avatar: 64px circle, `--color-surface-1` background with `◈` glyph if no IPFS avatar.
- Name: Space Grotesk 600 `--text-xl`.
- Address: JetBrains Mono `--text-sm` `--color-muted`.
- Service badges row: horizontal scroll on mobile, flex-wrap on desktop. Badge = chip with dot indicator.

**Credential cards:** use `.card--verified` class for valid claims (the green glow). Use `.card` with `.card--revoked` (red border, no glow) for revoked. Group by category with an eyebrow label per category.

**Backend offline state (current error):**
- Do NOT let it dominate the page.
- Show a slim banner at top: `⚠ Passport data unavailable — backend offline. On-chain reads still work. [Retry]`
- Continue rendering the page skeleton with empty states below.
- The credential request form should still appear.

**Notifications section:**  
Replace "Loading notifications…" with a proper empty state:  
```
No notifications yet.
You'll be notified when credentials are issued to your address.
```

**Request a credential form:** Give it its own card, properly labeled. Credential type dropdown should load from on-chain schema registry — show a mono spinner while loading, not "Loading credential types...".

---

### 4.6 Verify (`/verify`)

**Current problems:** Minimal, but the "Pick a schema / Enter hex ID" toggle looks like two buttons fighting. Schema dropdown is unstyled.

**Redesign:**

```
Page: max-width 560px centered

VERIFICATION
Verify Credential
Check whether a wallet holds a valid attestation on-chain.
Direct on-chain read. No backend required.

┌─────────────────────────────────────────────────────┐
│  Subject Address                                    │
│  ┌──────────────────────────────────────────────┐   │
│  │  0x...                                       │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  Schema                                             │
│  ┌ Pick a schema ─────────────────────────────── ┐  │
│  │  ── Select schema ──                        ▼ │  │
│  └───────────────────────────────────────────────┘  │
│  — or —                                             │
│  Enter schema ID manually                           │
│  ┌──────────────────────────────────────────────┐   │
│  │  0x...                                       │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  [Verify Credential]                                │
└─────────────────────────────────────────────────────┘
```

**"Pick a schema" vs "Enter hex ID":** Remove the toggle buttons. Show the schema dropdown first. Below it, a text link `Enter schema ID manually` expands the hex input. One default path, escape hatch is one click.

**Result panel** (appears after verification):
```
┌─────────────────────────────────────────────────────┐
│                              VALID ●                │
│  arcpass_kyc_basic                                  │
│  Subject: 0x1234...5678                             │
│  Issuer:  0xabcd...ef01                             │
│  Issued:  2025-03-12                                │
│  Expires: 2026-03-12                                │
│  Claim ID: 0x9f3a...                    [Copy]      │
└─────────────────────────────────────────────────────┘
```
Use `.card--verified` with the green glow. For invalid:
```
┌─────────────────────────────────────────────────────┐
│                            INVALID ✗                │
│  No valid attestation found for this address        │
│  and schema combination.                            │
│  The credential may not exist, may be revoked,      │
│  or may have expired.                               │
└─────────────────────────────────────────────────────┘
```

---

### 4.7 Issue (`/issue`)

**Current problem:** The page shows "Sign the message in your wallet to verify issuer permissions..." as a full-page loading state with skeleton bars. This is a dead end for anyone who isn't an issuer.

**Redesign:**

**State 1 — Awaiting signature:**
```
┌────────────────────────────────────────────────────────┐
│                                                        │
│  Verifying issuer permissions...                       │
│                                                        │
│  Check your wallet for a signature request.            │
│  This confirms you hold ISSUER_ROLE on-chain.          │
│                                                        │
│  [Waiting for wallet...]                 ← spinner     │
│                                                        │
└────────────────────────────────────────────────────────┘
```

**State 2 — Not an issuer:**
```
┌────────────────────────────────────────────────────────┐
│  ✗  Issuer role not found                              │
│                                                        │
│  Connected wallet: 0x04e0...DB1b                       │
│  This address does not hold ISSUER_ROLE on the         │
│  AttestationRegistry contract.                         │
│                                                        │
│  If you should have issuer access, contact the         │
│  contract admin to grant your wallet the role.         │
│                                                        │
│  [← Back to home]                                      │
└────────────────────────────────────────────────────────┘
```

**State 3 — Authorized issuer:** Redirect to Studio `/studio` (Studio is the issuer's real home).

---

### 4.8 ArcPass Studio (`/studio/*`)

Studio is the power-user interface. It should feel denser and more tool-like.

**Studio layout:**
```
┌──── STUDIO HEADER ──────────────────────────────────────────┐
│  ArcPass Studio            [API Docs ↗]  [openapi.json ↗]  │
│  Issuer dashboard for managing schemas, issuing             │
│  attestations, and monitoring analytics across              │
│  all 9 service verticals.                                   │
└─────────────────────────────────────────────────────────────┘

┌──── STUDIO NAV (horizontal tabs) ───────────────────────────┐
│  Overview  Schemas  Templates  Issue  Bulk Issue  Revoke    │
│  Analytics  Settings                                        │
│  ──────────────────────                                     │
│  Active tab: 2px bottom border --color-arc-primary          │
│  Font: Inter 500 --text-sm                                  │
└─────────────────────────────────────────────────────────────┘
```

**4.8.1 Overview / Analytics**

Current: "Failed to load analytics" + four `0` cards. The failure state destroys the page.

Redesign the analytics grid:
```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Claims Issued│ │Claims Revoked│ │   Schemas    │ │ Role Grants  │
│              │ │              │ │  Registered  │ │              │
│     0        │ │     0        │ │     0        │ │     0        │
│  Total       │ │  Total       │ │  Total       │ │  Total       │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘

Font: JetBrains Mono 700 --text-3xl for the number
Label: Inter 400 --text-xs --color-subtle uppercase
Color: Primary numbers --color-on-bright
       Revoked numbers --color-danger
       Role grants --color-warn
```

When analytics fail to load: show the data as `—` (em dash) not `0` (zero is misleading — it implies the data loaded and showed nothing). Show a subtle `⚠ Backend offline` chip above the grid.

**Real-time activity row:**
```
┌─────────────────────────────────────────────────────────────┐
│  Real-time Activity                             ● Live      │
│                                                             │
│  Claims/min    Revocations/min    Claims/hour   Schemas/hr  │
│  0             0                  0             0           │
└─────────────────────────────────────────────────────────────┘

● Live indicator: 6px circle, --color-verified, pulsing at 2s.
When offline: ● Offline, --color-subtle, no pulse.
```

**4.8.2 Schema Builder (`/studio/schemas`)**

Current: Clean structure, but generic styling.

Improvements:
- Schema name input: add `arcpass_` prefix shown as greyed inline prefix inside the input (`arcpass_` in `--color-subtle`, cursor placed after it). This enforces naming convention without the user having to remember it.
- Field type select: replace browser-default `<select>` with a custom dropdown matching the design system.
- "Register Schema onchain" button: PRIMARY blue (currently green — inconsistent).
- Computed schema ID: show it live beneath the form as the user types, in a mono chip:  
  `Schema ID: 0x7f3a...b2c1` — updates on each keystroke.

**4.8.3 Schema Templates (`/studio/templates`)**

Good concept, needs refinement:

Category filter tabs: currently styled as inline buttons with active state blue. Looks fine. Minor improvements:
- Make the horizontal scroll indicator visible (the `‹ ›` arrows at edges).
- Active tab: `--color-arc-primary` background + white text (currently only text color changes).

Template cards:
```
┌─────────────────────────────────────────────────────┐
│  arcpass_kyc_basic                   [Use template] │
│  Tier 1 KYC: name + country confirmed               │
│  4 fields · v3.0.0                                  │
└─────────────────────────────────────────────────────┘

Title: JetBrains Mono 600 --text-sm
Description: Inter 400 --text-sm --color-muted
Meta: Inter 400 --text-xs --color-subtle
[Use template]: ghost button, appears on hover (opacity 0 → 1)
```

**4.8.4 Issue Credential (`/studio/issue`)**

Current: Service type grid + subject address. Functional.

Redesigns:
- Service buttons: 3-column grid on desktop. Selected state: `--color-arc-primary` border + `rgba(59,130,246,0.08)` background. Not just a colored border — needs background fill for clarity.
- After selecting service: slide down a form with the relevant fields for that service's schema (dynamic, keyed to schema constants).
- Subject address: `.input--mono`.
- API endpoint shown at bottom (`POST /v1/kyc/issue`): style as a terminal chip:  
  `POST /v1/kyc/issue` — mono, `--color-surface-2` background, `--color-verified` for the method verb.

**4.8.5 Bulk Issue (`/studio/bulk-issue`)**

Current: CSV textarea + mode toggle. Good structure.

Improvements:
- "Per-item (row-level errors)" vs "Batch (single tx)" toggle: replace with radio-style segmented control, not two full buttons.
- CSV header hint: show `Header: subject,displayName,avatarCid,expiresAt` as a mono caption, styled distinctly from a label.
- Textarea: monospaced, `--color-surface-2`, `--color-border`. Code editor feel.
- "0 rows ready · max 100": show this as a progress-style indicator: `[████░░░░░░] 0 / 100 rows`
- "Upload .csv file": secondary ghost button, top-right of the CSV section.

**4.8.6 Revoke Manager (`/studio/revoke`)**

Current: Single input + Look up button. Fine.

Improvement: after lookup, show the claim details in a card before presenting the Revoke action:
```
┌────────────────────────────────────────────────────┐
│  Claim 0x9f3a...b1c2                   VALID ●    │
│  Subject:  0x1234...5678                           │
│  Schema:   arcpass_kyc_basic                       │
│  Issued:   2025-03-12 · Expires: 2026-03-12        │
│                                                    │
│  [Cancel]              [Revoke this credential ✗]  │
└────────────────────────────────────────────────────┘
```
Revoke button: DANGER style. Show a confirmation step before submitting.

**4.8.7 Settings (`/studio/settings`)**

Current: 9 rows of `not configured` labels in amber/orange.

Redesign:
```
┌────────────────────────────────────────────────────┐
│  Identity & Passport                               │
│  CIRCLE_IDENTITY_ISSUER_WALLET_ID                  │
│                              not configured ○      │
└────────────────────────────────────────────────────┘

- Service name: Inter 500 --text-sm --color-on-surface
- Env var name: JetBrains Mono --text-xs --color-subtle
- Status chip: "not configured" → --color-subtle text + empty circle ○
              "configured" → --color-verified text + filled circle ●
- Each row: hover reveals a [Configure ↗] link (opens docs or env var instructions)
```

---

## 5. Route: Public Passport (`/passport/:address`)

This is a shareable URL. It must look polished even without wallet connection, for any viewer.

```
Full page layout (desktop):

┌────────────────────────────────────────────────────────────────┐
│  NAVBAR (no wallet required to view)                           │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌── LEFT: Identity card ────────────────────────────────┐    │
│  │                                                       │    │
│  │  [Avatar 80px]  0x04e0...DB1b              [QR code] │    │
│  │  Display Name (or unregistered)                       │    │
│  │  Arc Testnet · Block #12345                           │    │
│  │                                                       │    │
│  │  [Copy address]  [View on explorer ↗]                 │    │
│  │                                                       │    │
│  │  SERVICE COVERAGE:                                    │    │
│  │  ● KYC  ● Identity  ○ DAO  ○ Employment  ...         │    │
│  └───────────────────────────────────────────────────────┘    │
│                                                                │
│  ┌── RIGHT: Credentials ─────────────────────────────────┐    │
│  │                                                       │    │
│  │  KYC / Compliance                                     │    │
│  │  ┌──────────────────────────────────────────────┐    │    │
│  │  │  arcpass_kyc_basic              VALID ●       │    │    │
│  │  │  Issued by 0xabcd...  · 2025-03-12            │    │    │
│  │  │  Expires 2026-03-12              [Verify ↗]   │    │    │
│  │  └──────────────────────────────────────────────┘    │    │
│  │                                                       │    │
│  │  Identity & Passport                                  │    │
│  │  [Empty state — no identity credentials]              │    │
│  │                                                       │    │
│  └───────────────────────────────────────────────────────┘    │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

Mobile: stack vertically (identity card → credentials).

---

## 6. Responsive Breakpoints

```
Mobile:  < 640px   — single column, full-width forms, hamburger nav
Tablet:  640–1024px — 2-col grid where applicable, condensed studio tabs
Desktop: > 1024px  — full layouts as specified above

Max-width containers:
  Pages:  max-width 1200px, centered, px-6 (mobile: px-4)
  Forms:  max-width 560–640px, centered within page
  Studio: max-width 960px, centered
```

---

## 7. Font Loading

```html
<!-- In index.html <head> -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?
  family=Space+Grotesk:wght@500;700
  &family=Inter:wght@400;500
  &family=JetBrains+Mono:wght@400;600
  &display=swap" rel="stylesheet">
```

Fallback stack:
```css
--font-display: 'Space Grotesk', 'DM Sans', system-ui, sans-serif;
--font-body:    'Inter', system-ui, sans-serif;
--font-mono:    'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
```

---

## 8. CSS Architecture Notes

### Variables in `:root`
All tokens defined under `:root` in `src/styles/tokens.css`. No hardcoded hex values anywhere else in the codebase.

### Class naming
Use BEM for components: `.card`, `.card--verified`, `.card--interactive`.  
Use utility classes (Tailwind or custom) for spacing and layout only.  
No inline `style={{}}` for colors or typography — all from CSS vars.

### Specificity discipline
```
❌ .card .title { font-size: ... }   /* too broad — risks collision */
✅ .card__title { font-size: ... }   /* BEM element — scoped */

❌ .section { padding: 40px }        /* collides with .section.cta */
✅ .section + .section { margin-top: var(--space-12) } /* space-between-siblings pattern */
```

### Component file structure
```
src/
  styles/
    tokens.css         ← all CSS custom properties
    global.css         ← reset, body, ::selection
    typography.css     ← type scale, font face assignments
    components/
      card.css
      button.css
      input.css
      chip.css
      address.css
      simulation-box.css
  components/
    ui/
      Card.tsx
      Button.tsx
      Input.tsx
      StatusChip.tsx
      AddressDisplay.tsx
      SimulationBox.tsx
      EmptyState.tsx
      ErrorBanner.tsx
```

---

## 9. Accessibility

- All interactive elements keyboard-focusable with visible focus ring (`box-shadow: var(--shadow-focus)`).
- Color is never the only signal for state — always pair with text label or icon.
- `verified-pulse` animation gated behind `@media (prefers-reduced-motion: no-preference)`.
- Contract addresses use `aria-label="wallet address"` + `title` for full address on truncated display.
- Studio tabs use `role="tablist"` + `role="tab"` + `aria-selected`.
- Error messages use `role="alert"`.
- Form validation errors linked via `aria-describedby`.

---

## 10. Implementation Priority Queue

Build in this order to unblock the most visible improvements first:

```
Priority 1 — Foundation (do first, unblocks everything)
  □ CSS tokens file (tokens.css)
  □ Global reset + typography
  □ Navbar redesign (wallet chip, logo mark, active link state)
  □ Button component (all variants)
  □ Input component (all variants including .input--mono)
  □ StatusChip component

Priority 2 — Core pages
  □ Home page redesign (hero, how-it-works, action grid)
  □ Register Identity (simulation preview box)
  □ Verify Credential (result panel, inline manual ID)
  □ Register Schema (schema ID preview, dropdown)

Priority 3 — Passport page
  □ Passport header (avatar, badge strip, QR)
  □ Credential cards (.card--verified with glow)
  □ Error banner (slim, non-blocking)
  □ Empty states for notifications + credentials

Priority 4 — Studio
  □ Studio tab navigation
  □ Analytics grid (em dash for offline, live indicator)
  □ Issue form (service grid selected states, schema fields)
  □ Bulk issue (segmented control, progress indicator)
  □ Revoke (claim preview before revoke)
  □ Settings (status indicators)
  □ Templates (hover-reveal Use button)

Priority 5 — Polish
  □ Guide page (step structure, callout boxes, terminal blocks)
  □ Issue/not-issuer state (clear denial message)
  □ Public passport (/passport/:address) full layout
  □ Responsive audit (mobile + tablet)
  □ Reduced motion audit
  □ Accessibility audit (keyboard, aria)
```

---

## 11. Signature Element Summary

The single most memorable design decision in this system is the **verification glow** (`--color-verified: #00E5A0`) used exclusively for confirmed on-chain states:

- `.card--verified` → `verified-pulse` animation, mint border glow
- StatusChip `VALID` → mint text + mint border
- Simulation box `✓ passed` → mint checkmarks
- Wallet connected dot → mint indicator in nav
- Real-time activity `● Live` → pulsing mint dot
- Schema template `configured ●` → mint dot in settings

**Nowhere else is `#00E5A0` used.** Not for hover states, not for success toasts unrelated to chain state, not for branding. This restraint is what makes the color meaningful: when a user sees green in ArcPass, they know something is cryptographically verified.
