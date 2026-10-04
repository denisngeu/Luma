# Design System: Luma Social Messenger

## 1. Visual Theme & Atmosphere
Luma uses a cockpit-dense mobile layout with restrained motion and clear spatial separation. Community navigation resembles a focused collaboration console: a narrow space rail, a compact channel panel, and a dedicated conversation scene. Every displayed member, community, channel, message, and activity state comes from production data.

## 2. Color Palette & Roles
- **Deep Obsidian** (`#0B0F17`) — application canvas.
- **Midnight Slate** (`#111827`) — structural panels and navigation.
- **Raised Slate** (`#1A2234`) — channel rows, inputs, and cards.
- **Soft White** (`#F8FAFC`) — primary text.
- **Muted Steel** (`#94A3B8`) — descriptions and metadata.
- **Whisper Border** (`rgba(255,255,255,.08)`) — structural separation.
- **Luma Indigo** (`#5F5CE6`) — the single interactive accent for selected tabs, primary actions, and focus rings.
- **Live Mint** (`#35D6A4`) — semantic live/connected status only.

## 3. Typography Rules
- **Display and body:** Plus Jakarta Sans, with compact tracked headings and readable 1.4–1.6 line height.
- **Metadata:** Geist Mono for counters and technical states.
- Primary mobile titles use 17–28px; body text never drops below 10px in the dense channel list.
- Serif typefaces and generic placeholder identities are prohibited.

## 4. Component Stylings
- **Buttons:** minimum 44px touch target where space permits, tactile scale feedback, indigo fill only for the primary action.
- **Channel rows:** 13px radius, subtle border, selected row with an indigo leading indicator.
- **Status badges:** compact pills; live voice states use semantic mint.
- **Cards:** tonal elevation with borders, without decorative outer glow.
- **Inputs:** label above, inline error below, indigo focus ring.
- **Loading:** layout-matched skeletons instead of circular spinners.

## 5. Layout Principles
- Mobile communities use a 50px space rail plus a fluid channel panel.
- Desktop keeps the 400px contextual panel and flexible conversation scene.
- No horizontal page scrolling and no overlapping content.
- Bottom navigation remains reachable above the device safe area.
- Real empty states explain how to create or join content.

## 6. Motion & Interaction
- Transitions animate only opacity and transform, using a weighted ease-out feel.
- Active controls press to 94–98% scale.
- Reduced-motion preference disables nonessential movement.
- Every tab, channel, call control, and creation action exposes a visible selected, loading, success, or error state.

## 7. Anti-Patterns
- No simulated users, messages, channels, presence, or counters.
- No pure black canvas, neon gradients, decorative emojis, or arbitrary glow.
- No overlapping sidebars or hidden controls.
- No dead buttons or links with placeholder destinations.
- No horizontal overflow on Android.
