# ETEST Compass Design Tokens

## Visual thesis

ETEST Compass should feel like a trusted admissions desk: quiet paper tones, deep academic blues, disciplined spacing, and only a few vivid signals for action, urgency, or confidence.

## Content plan

For the public site, keep the sequence simple: product promise, proof of transparent recommendations, workflow detail, and counselor conversion.

For the app itself, default to utility-first surfaces: profile workspace, recommendation workspace, compare view, and counselor handoff.

## Interaction thesis

Use motion to reinforce progress and clarity rather than decoration:

- staged reveal for onboarding and recommendation results
- smooth compare-state transitions when a school is pinned or removed
- soft highlight pulses for deadline, blocker, and counselor urgency states

## shadcn decisions

- Use `style: "new-york"` and `tailwind.cssVariables: true`.
- Use `tailwind.baseColor: "neutral"` so generated components stay restrained and the custom tokens do the real branding work.
- Keep the app mostly card-light. Use plain sections and panel dividers first; only use cards when the card itself is the interaction.

Example `components.json` baseline:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tailwind": {
    "config": "",
    "css": "apps/student-onboarding/app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

## Token roles

### Core surfaces

- `background`: warm paper app background
- `card` and `popover`: slightly cleaner surfaces for overlays and focused work
- `surface-soft` and `surface-elevated`: subtle panel layering without heavy shadows
- `surface-strong`: stronger tint for selected rails, pinned compare rows, or highlighted result groups

### Brand and action

- `primary`: academic blue for the main CTA, active nav, selected tabs, and data emphasis
- `accent`: cool sea-glass tint for hover states, assistive panels, and conversational UI moments
- `ring`: brighter blue so focus stays accessible and obvious

### Operational states

- `success`: confirmed completion or positive status
- `warning`: budget pressure, missing requirements, or moderate deadline risk
- `destructive`: severe blockers or destructive actions
- `info`: source freshness, factual callouts, and assistant context

### Recommendation semantics

- `reach`: aspirational but possible
- `target`: balanced fit
- `safety`: high-likelihood option
- `current`: present-day outlook chips and summaries
- `projected`: milestone-based future outlook
- `scholarship`: affordability or funding support
- `deadline`: urgency labels and countdown surfaces

## Typography

Recommended pair:

- UI font: `Manrope`
- Editorial accent for landing pages or large section titles: `Source Serif 4`

Use the serif sparingly. Product UI should stay mostly in the sans family so tables, forms, and recommendation logic remain crisp.

## Spacing and shape

- Base spacing rhythm: `4, 8, 12, 16, 24, 32, 48, 64`
- Default panel padding: `24` on desktop, `16` on mobile
- Radius intent:
  - small controls: `10-12px`
  - standard panels: `16px`
  - large callouts or modal shells: `24px`

The token file sets `--radius: 1rem` so the system lands around a calm 16px default.

## Where to use these tokens

- Profile builder: `surface-soft`, `muted`, and `primary` for progressive disclosure
- Recommendation lists: `reach`, `target`, `safety`, `current`, and `projected`
- Compare mode: `surface-strong` for selected rows and `info` for source-backed details
- Handoff and booking: `primary` for conversion, `warning` for urgency, `success` for submission confirmation
- Admin and counselor views: mostly neutral surfaces with state colors used sparingly

## Implementation note

Copy the contents of [shadcn-tokens.css](/Users/Khoai/OneDrive/Desktop/Lotus%20hackathon/PhoFilledHackersProject/docs/design/shadcn-tokens.css) into `apps/student-onboarding/app/globals.css` or import it from there once the monorepo scaffold exists.

The token file follows the current shadcn CSS-variable convention and exposes custom semantic colors through `@theme inline`, so utilities like `bg-target`, `text-warning-foreground`, and `border-surface-strong` will be available once the app is wired to Tailwind v4.
