# ADR-008 — Front-end foundation

**Status:** Accepted · **Refs:** UX-001…009, UX-014, NFR-PERF-005, WCAG 2.2 AA

- **Styling:** Tailwind CSS v4 with OKLCH design tokens (light + dark) in `globals.css`; shadcn-style components on Radix primitives.
- **Typography:** _Figtree_ (body/UI: friendly geometric, very legible at small sizes), _Bricolage Grotesque_ (headings:
  characterful variable display face with optical sizing), _JetBrains Mono_ (reference, licence and OTP codes).
  Self-hosted and subset by `next/font`; Latin Extended for French and Kinyarwanda. Fluid type via `clamp()`.
- **Responsiveness:** mobile-first; 44 px touch targets; sidebar from `lg`, drawer below; dialogs become bottom sheets on phones;
  verified by Playwright on a Pixel 7 profile (no horizontal scroll).
- **Loading:** route-level `loading.tsx` skeletons, Suspense streaming (sessions list), `next/dynamic` for setup dialogs.
- **i18n:** next-intl without locale routing (cookie + Accept-Language); EN complete; RW/FR drafts flagged "unapproved".
- **Accessibility:** axe in E2E for key pages in light and dark themes; reduced-motion support; skip link; labelled fields with ARIA wiring.

_Amended by [ADR-009](ADR-009-visual-language.md) (palette, single type family, motion) and [ADR-010](ADR-010-public-locale-routing.md) (locale-prefixed public URLs)._
