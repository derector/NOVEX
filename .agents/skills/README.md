# NOVEX Agent Skills

These project-local Agent Skills guide UI work, accessibility, interface quality, and NOVEX brand identity. Read the relevant `SKILL.md` before making a change in its area; use `better-interface` and `interface-review` for broad UI audits.

## Installed skills

From [jakubkrehel/skills](https://github.com/jakubkrehel/skills):
- `better-interface` — integrated interface review across accessibility, layout, writing, typography, color, and polish.
- `better-ui` — component surfaces, icons, shadows, states, and motion.
- `better-accessibility` — keyboard/focus, semantics, forms, screen readers, reduced motion, zoom, and WCAG checks.
- `better-layout` — responsive structure, grouping, alignment, reading order, and localization resilience.
- `better-typography` — type scale, spacing, wrapping, truncation, and text rendering.
- `better-colors` — color tokens, palettes, and contrast.
- `better-writing` — interface labels, errors, empty states, and confirmations.
- `interface-review` — review changes for interface regressions.

From [kaankiziltug/logo-design-skill](https://github.com/kaankiziltug/logo-design-skill):
- `logo-design` — brand mark and logo design process, SVG construction, optical corrections, and logo quality checks.

## Project usage rules

1. Keep NOVEX's existing product requirements and architecture authoritative; skills are guidance, not permission to replace required functionality or redesign unrelated areas.
2. For UI changes, consult `better-interface`, then the relevant focused skills; verify mobile/web layouts, keyboard accessibility, contrast, and meaningful interaction states.
3. For branding or logo changes, consult `logo-design`; do not copy reference logos.
4. Before reporting completion, run the available build/tests and inspect the actual diff. Clearly report any checks that could not be run.
5. Keep these files project-local under `.agents/skills/` so they can be versioned with NOVEX.
