# Figma Prompt: ETEST Compass Brand-Matched UI

Design a modern web app UI for **ETEST Compass** that matches the current visual identity and marketing language of **[etest.edu.vn](https://etest.edu.vn/)** while still being practical for a product app built with **shadcn/ui**.

This should feel like an extension of the ETEST website, not a separate startup brand.

## Brand match goal

Use the live ETEST website as the visual reference for:

- brand mood
- color hierarchy
- headline style
- section rhythm
- imagery direction
- trust and proof signals

The current website presents ETEST as:

- a premium Vietnamese education brand
- scholarship-focused and achievement-led
- confident, promotional, and family-trust oriented
- built around academic success, teacher credibility, and real student outcomes

## What to mirror from the live website

Mirror these characteristics from `https://etest.edu.vn/`:

- bold uppercase section headings
- burgundy / maroon dominant brand color
- gold accent used as a premium support color
- white and light-gray content surfaces
- dark or maroon proof sections for achievements
- heavy use of real student photos, teacher portraits, and school logos
- structured marketing blocks such as programs, achievements, testimonials, teachers, news, and contact CTA
- Vietnamese-first tone and educational trust cues

Do not design this like a neutral US edtech SaaS app. It should clearly inherit ETEST's existing public brand.

## Brand personality

The UI should feel:

- ambitious
- premium
- trustworthy
- achievement-driven
- polished
- parent-friendly
- education-first

## Visual direction

Translate the ETEST website into a cleaner product interface:

- keep the brand richness of the public site
- reduce WordPress-style clutter
- preserve the strong promotional identity
- make the product surfaces calmer and more structured
- let the app feel more premium and organized than the current marketing site

The result should feel like:

- ETEST website brand
- plus a more refined product layer
- plus better data and workflow clarity

## Color direction

Use the existing token architecture, but map it visually to the ETEST website.

### Brand palette reference

Use these website-inspired colors as the main direction:

- Burgundy primary: `#961D22`
- Deep burgundy hover / alternate: `#8F1F2B`
- Dark maroon section tone: `#911E23`
- Gold accent: `#F3DC80`
- Rich pink-red support accent: `#B71742`
- Charcoal neutral: `#424244`
- Light gray surface: `#F2F2F4`
- White: `#FFFFFF`

### Token mapping for Figma

Map the semantic token system to the ETEST brand like this:

- `primary`: burgundy / maroon brand action color
- `primary-foreground`: white
- `accent`: gold highlight color
- `accent-foreground`: dark burgundy or charcoal
- `secondary`: light warm gray or pale neutral support surface
- `background`: white or very light gray
- `foreground`: charcoal or near-black
- `muted`: soft gray information areas
- `border`: subtle gray dividers
- `ring`: burgundy focus ring with accessible contrast
- `destructive`: deeper red than primary
- `success`: rich green, but use sparingly
- `warning`: gold-to-amber family, aligned with urgency and deadlines
- `info`: muted blue-gray or cool neutral informational highlight

### Recommendation semantics

Keep these semantic tokens, but style them so they harmonize with ETEST branding:

- `reach`
- `target`
- `safety`
- `current`
- `projected`
- `scholarship`
- `deadline`

These should not overpower the brand palette. They need to feel integrated into a maroon-led system, not like disconnected SaaS labels.

## Typography

The live site relies on bold uppercase headings and a promotional education-center tone. Reflect that in the product UI.

Typography guidance:

- Use a strong sans-serif family for the full system
- Headings should feel bold, clean, and confident
- Section titles may use uppercase, especially for marketing or overview sections
- Product body copy should be calmer and more readable than the website
- Use large, assertive numerals for achievement stats
- Vietnamese typography must remain clear and well-spaced

If choosing type in Figma:

- Primary UI font: **Manrope** or a similar clean geometric sans
- Optional display accent: a bold condensed or editorial sans only if it still feels consistent with ETEST

Do not make the app overly serif-heavy. The live site reads as bold sans, not editorial luxury serif.

## Layout direction

Use the structure of a modern product app, but inherit the visual rhythm of the website.

### Public-facing pages

For landing and marketing-adjacent screens, use sections inspired by the ETEST homepage:

- hero
- training programs or service categories
- achievement / scholarship proof
- student success stories
- teacher credibility
- articles or knowledge section
- contact or consultation CTA

### Product pages

For authenticated app surfaces, organize around:

- profile builder
- recommendation workspace
- compare mode
- chat clarification
- counselor handoff
- booking request

These product pages should still feel branded, but more structured and easier to scan than the public site.

## Component direction

Design these components so they look native to ETEST's brand:

- primary button in burgundy
- secondary button in white or light gray with burgundy text/border
- gold-accent badges for premium or scholarship moments
- stat blocks with strong numbers and short labels
- recommendation cards with better structure than the marketing-site cards
- testimonial blocks using real faces and direct quotes
- course / service tiles inspired by the homepage program grid
- teacher profile modules
- achievement banner or metrics strip
- source citation row
- deadline panel
- counselor CTA module
- sidebar and top navigation
- modal and drawer
- form fields for onboarding and booking

## Imagery direction

Use imagery like the live site:

- real students
- teacher portraits
- real campus or university-related images
- scholarship and achievement proof visuals
- school logos or badges where relevant

Avoid:

- abstract 3D renders
- generic SaaS illustrations
- empty gradients without narrative value
- tech-startup iconography that does not fit education branding

## Screen prompts

Design these screens in a way that feels like ETEST's website evolved into a product:

1. Landing page

- Match the energy of the current homepage
- Brand-first hero
- Burgundy-led visual hierarchy
- Achievement and trust blocks
- Strong consultation CTA

2. Onboarding / profile builder

- More refined than the public website
- Clear progress steps
- Warm, supportive, counselor-like tone
- Branded accents from the ETEST palette

3. Recommendation results

- Combine product clarity with ETEST-style achievement framing
- Reach / Target / Safety should feel polished and premium
- Budget, blockers, and outlook states must be easy to scan
- School rows can include logos and credibility cues

4. Compare mode

- Clean table-like comparison
- Strong use of emphasis and contrast
- ETEST brand colors used for action and highlights only

5. Chat assistant

- Feels like a trusted ETEST advisor, not a generic chatbot
- Helpful, factual, reassuring
- Strong integration with profile and recommendations

6. Counselor handoff / booking

- High trust
- Strong conversion intent
- Use the tone of the website's consultation CTA sections
- Confirmation should feel premium and reassuring

7. Admin / counselor console

- More neutral operational layer
- Still branded with burgundy accents
- Dense but readable
- Useful for review, status, and follow-up

## Motion guidance

Use restrained motion only:

- soft fade and slide reveals
- highlight transitions on recommendations
- smooth compare interactions
- subtle emphasis for CTA and urgency states

Do not use flashy startup motion. Motion should feel polished and professional.

## shadcn alignment

This design should still be implementable with **shadcn/ui**.

Rules:

- preserve semantic token naming
- keep components practical and reusable
- use clean panels and dividers
- avoid excessive ornament in core product flows
- let branding show through color, type emphasis, imagery, and section composition

## Final output instruction

Produce:

- a brand system page based on the live ETEST site
- desktop screens
- mobile responsive versions
- a landing page that clearly resembles `etest.edu.vn`
- authenticated product screens that feel like a modernized ETEST app

The final result should look like **ETEST's official website evolved into a polished admissions product**, not a generic dashboard with a red color swap.
