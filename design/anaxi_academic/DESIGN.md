# Design System Strategy: The Modern Academic Ledger

## Implementation notes (shipped in app, May 2026)

The running product intentionally differs from some aspirational rules below. **Canonical for engineering:**

| Topic | Shipped choice |
|-------|----------------|
| Display / page titles | **Space Grotesk** on `main h1` (`--font-space-grotesk`) |
| Body / UI | **Inter** |
| Border radius | **4px** globally (`tailwind` `borderRadius`) |
| Card borders | Ghost borders via `border-border` / `outline-variant` mixes; full “no-line” is aspirational |
| Stat cards | Prefer `StatCard` `tone="softGrey"` without accent bars |
| Theme | **Light only** for v1; sporadic `dark:` utilities are legacy—do not extend |

When adding UI, follow tokens in `app/globals.css` and shared components (`PageHeader`, `Button`, `Breadcrumb`) rather than raw Tailwind grays.

---

## 1. Overview & Creative North Star
The Creative North Star for this design system is **"The Modern Academic Ledger."** 

This system moves beyond the generic "SaaS dashboard" aesthetic. It draws inspiration from the tactile authority of British academic journals and the clinical efficiency of high-end developer tools. We are designing for "Institutional Confidence"—a layout that feels permanent, transparent, and calm.

To break the "template" feel, we reject the rigid, boxed-in grid. Instead, we embrace **intentional asymmetry** and **editorial pacing**. Headlines utilize a distinctive display face (Space Grotesk in the app; Newsreader was an early spec option) to provide a "human" academic touch, while the data-heavy UI remains surgically precise. We don't use lines to separate ideas; we use space and tonal shifts to guide the eye.

---

## 2. Colors & Surface Logic
The palette is rooted in a high-contrast foundation of Deep Slate (`primary`) and clean neutrals, with a sharp Coral (`tertiary`) accent for surgical precision.

### The "No-Line" Rule
**Explicit Instruction:** You are prohibited from using 1px solid borders to define sections or cards. 
Boundaries must be defined solely through background color shifts. For example, a `surface-container-lowest` card should sit on a `surface-container-low` background. This creates a softer, more sophisticated "layered" feel that mimics fine stationery.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. 
- **Base:** `surface` (#f7f9fb)
- **Sections:** `surface-container-low` (#f2f4f6)
- **Active Workspaces/Cards:** `surface-container-lowest` (#ffffff)
- **Nesting:** When nesting a component inside a container, use the next tier up (e.g., `surface-container-high`) to create depth without visual noise.

### The "Glass & Gradient" Rule
To add "soul" to the institutional feel:
- **Floating Elements:** Use `surface-container-lowest` with an 80% opacity and a `20px` backdrop-blur for modals or floating navigation.
- **CTAs:** Apply a subtle linear gradient to Primary buttons, transitioning from `primary` (#000000) to `primary-container` (#131b2e) to prevent the color from feeling "flat" or "dead."

---

## 3. Typography
We use a dual-font system to balance tradition with modern utility.

- **Display & Headlines (Newsreader):** Use for all `display-*` and `headline-*` tokens. This refined serif conveys authority and the "Grammar School" heritage. It should feel like a masthead.
- **Utility & Data (Inter):** Use for `title-*`, `body-*`, and `label-*`. Inter provides the "Linear-like" efficiency required for a power-user intelligence platform.
- **Hierarchy Tip:** Use `display-lg` for high-level insights and `label-sm` (all caps, tracked out by 5-10%) for secondary metadata to create an "Editorial" contrast.

---

## 4. Elevation & Depth
Depth is achieved through **Tonal Layering**, not structural scaffolding.

- **The Layering Principle:** Place `surface-container-lowest` (pure white) elements atop `surface-container` backgrounds to create a natural, "lifted" feel.
- **Ambient Shadows:** Shadows are reserved for floating elements only (modals, dropdowns). They must be extra-diffused. Use the `on-surface` color at 4% opacity with a 32px blur and 8px offset. It should look like a soft glow, not a drop shadow.
- **The Ghost Border:** If a boundary is strictly required for accessibility (e.g., input fields), use the `outline-variant` token at **20% opacity**. Never use 100% opaque borders.
- **Glassmorphism:** Use semi-transparent surface colors for top navigation bars or sidebars to allow the background content to "ghost" through, softening the layout's edges.

---

## 5. Components

### Buttons
- **Primary:** `primary` background with `on-primary` text. Use `md` (0.75rem) rounding. No border.
- **Secondary:** `secondary-container` background. Provides a calm, low-contrast alternative.
- **Tertiary (Coral):** Use only for critical "Single Point of Truth" actions or high-priority alerts.

### Input Fields
- **Style:** Use `surface-container-highest` as the background with a `Ghost Border`. 
- **Focus State:** Transition the border to `primary` at 40% opacity. 
- **Typography:** Labels should use `label-md` in `on-surface-variant`.

### Cards & Lists
- **The "No Divider" Rule:** Forbid the use of horizontal lines between list items. Instead, use vertical white space from the **Spacing Scale** (e.g., `spacing-4` or `spacing-6`) or a subtle hover state shift to `surface-container-high`.
- **Rounding:** Large containers use `xl` (1.5rem/24px) to feel substantial; internal components use `md` (0.75rem/12px).
- **Stat Cards — Default Style:** Use the `softGrey` tone (`bg-[#F1F3F5]`, no border, no shadow) with `accentPlacement="none"` (no coloured bar). This is the canonical stat card: a flat, soft-grey tile with a small all-caps label and a large bold value. Accent bars (`top` / `left`) and coloured tones (`softBlueGrey`, `softWarm`) are reserved for deliberate intent (e.g. a left-edge accent to indicate urgency, or a warm tint for a leave-status metric). Never use `tone="default"` (white + border) for new stat cards — it violates the No-Line Rule.

### Intelligence Chips
- **Selection:** Use `tertiary-container` (#3d060b) with `on-tertiary-container` (#c06c6c) for selected states to provide that "Coral" highlight in a sophisticated, readable way.

---

## 6. Do's and Don'ts

### Do
- **Do** use `Newsreader` for large numerical data (e.g., a school's overall performance percentage) to make it feel like a prestigious report.
- **Do** use the `spacing-16` and `spacing-24` tokens for page margins to create a sense of "Institutional Calm."
- **Do** use `surface-bright` for the main background to keep the interface feeling airy and transparent.

### Don't
- **Don't** use "Startup-cute" icons. Use thin-stroke, geometric iconography (1.5px stroke weight).
- **Don't** ever use pure black (#000000) for body text; use `on-surface` (#191c1e) to reduce eye strain.
- **Don't** crowd the interface. If a screen feels busy, increase the background-color nesting levels rather than adding more borders or boxes.