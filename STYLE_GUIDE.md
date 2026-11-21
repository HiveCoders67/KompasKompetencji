# Mój Design System: Style Guide

> **For AI assistants:** treat this as the source of truth for the look and feel of the project.
> Reproduce the style using the tokens and rules below. Do not invent new colours, fonts, radii or shadows.
> Exact values live in the token files exported next to this guide (see "Files" at the end).
>
> **Scope:** this guide defines the *visual language only*: colour, type, shape, components and motion.
> It is independent of the product's topic. Page structure, sections and content come from the project
> brief, not from this file. The page layouts in section 5 are examples of the style in use, not requirements.

## 1. Character

**Base style:** Minimalism. Generous whitespace, monochrome palette and precise type.

**Default theme:** light. Both light and dark palettes are defined; dark mode is switched with `[data-theme="dark"]` on `<html>`.

### Signature rules: do

- Moderate corner radius (8px base, cards ~12px).
- Thin 1px hairline borders to separate surfaces.
- Soft, diffuse and subtle shadows. Never use harsh or dark shadows.
- Tight letter-spacing on large headings.
- Headings use weight 400. The heading typeface itself carries the character, so never fake bold.
- Pair "Archivo Black" for headings with "IBM Plex Sans" for text. Never swap them.
- Airy layout with generous whitespace between and inside sections.

### Avoid

- No decorative gradients. Use flat colour fills.
- Do not introduce colours, fonts, radii or shadows that are not in the tokens below.
- Do not use status colours (success, warning, error, info) for decoration.

## 2. Colours

Use colours through CSS variables (`var(--sf-<role>)`), never hard-coded hex values.

| Role | Variable | Light | Dark | Use for |
| --- | --- | --- | --- | --- |
| primary | `--sf-primary` | `#111111` | `#999999` | Main brand colour: primary buttons, active states, key links |
| secondary | `--sf-secondary` | `#5f5f63` | `#8a8a8f` | Supporting brand colour: secondary actions, tags, illustrations |
| accent | `--sf-accent` | `#2f6bff` | `#3d72f5` | Highlights used sparingly: badges, emphasis, decorative details |
| background | `--sf-background` | `#ffffff` | `#140f0f` | Page background |
| surface | `--sf-surface` | `#fafafa` | `#1f1919` | Cards, inputs, modals, navigation bars |
| textPrimary | `--sf-text-primary` | `#0a0a0a` | `#f4f0f0` | Headings and body text |
| textSecondary | `--sf-text-secondary` | `#6b6b70` | `#b4a7a7` | Muted text: descriptions, captions, placeholders |
| border | `--sf-border` | `#ebebeb` | `#3b3030` | Dividers and component outlines |
| success | `--sf-success` | `#15803d` | `#2ddc6e` | Positive feedback only |
| warning | `--sf-warning` | `#c2410c` | `#f2652c` | Warnings only |
| error | `--sf-error` | `#dc2626` | `#e34f4f` | Errors and destructive actions only |
| info | `--sf-info` | `#2563eb` | `#4d80ef` | Neutral informational messages only |

**Contrast (light theme):**

- Text on background: 19.80:1 (AAA)
- Muted text on background: 5.30:1 (AA)
- Text on surface: 18.97:1 (AAA)
- Text on primary: 18.88:1 (AAA)
- Text placed on `primary` should be `#ffffff`.

## 3. Typography

- **Headings:** "Archivo Black"
- **Body:** "IBM Plex Sans"
- **Accent / mono** (labels, code, numbers): "IBM Plex Mono"

All fonts are available on Google Fonts.

| Level | Size | Weight | Line height | Letter spacing | Transform |
| --- | --- | --- | --- | --- | --- |
| h1 | 55px | 400 | 1.08 | -0.035em | none |
| h2 | 43px | 400 | 1.13 | -0.035em | none |
| h3 | 34px | 400 | 1.18 | -0.035em | none |
| h4 | 26px | 400 | 1.23 | -0.017em | none |
| h5 | 22px | 400 | 1.28 | -0.017em | none |
| h6 | 19px | 400 | 1.33 | -0.017em | none |
| body | 16px | 400 | 1.6 | 0em | none |
| small | 14px | 400 | 1.5 | 0.005em | none |

## 4. Shape, depth & spacing

- **Radius:** sm 4px · base 8px · lg 12px
- **Border width:** 1px
- **Shadow style:** soft (intensity 25%)
  - sm: `0 1px 2px rgba(6, 6, 6, 0.013), 0 2px 6px rgba(6, 6, 6, 0.015)`
  - md: `0 2px 4px rgba(6, 6, 6, 0.010), 0 8px 24px rgba(6, 6, 6, 0.025)`
  - lg: `0 4px 8px rgba(6, 6, 6, 0.013), 0 24px 56px rgba(6, 6, 6, 0.040)`
- **Spacing unit:** 10px. Scale: 5px, 10px, 14px, 19px, 29px, 38px, 58px
- **Effects:** texture none, decoration none, glass blur 0px, surface opacity 100%, gradients off

## 5. Layout

### Composition principles (apply to any page)

- Content sits in a container of max 1120px with 32px side padding. Full-bleed is reserved for backgrounds and data-heavy views.
- Separate major sections with 120px of vertical space. Inside a section use the spacing scale (base 10px).
- Default grid: 3 columns. Preferred arrangement: single centered column inside the container.
- Section headers and hero text are left-aligned.
- Low information density: fewer items per screen and plenty of whitespace around each group.
- Group related content in cards (Outlined: 1px border, no shadow, 12px radius). Cards are the main building block of panels and dashboards.
- One primary (filled `primary`) action per view or card. Other actions use secondary or ghost buttons.
- Heading hierarchy: page title h1 (h2 in dense tools), section titles h2 or h3, card titles h4 or h5.
- In data views, map statuses consistently to `success`, `warning`, `error` and `info` (badges, alerts, chart series) and keep that mapping on every screen.

### Default app shell

Use this shell unless the project clearly needs a different one (e.g. a full-screen map or a sidebar-driven admin panel).

- **Navigation:** bar fixed to the bottom of the viewport, sticky on scroll
- **Content layout:** single centered column inside the container
- **Sidebar:** none
- **Footer:** minimal: one line with copyright and a few links
- **Container:** max-width 1120px, horizontal padding 32px
- **Grid:** 3 columns
- **Vertical rhythm:** 120px between sections
- **Text alignment:** left-aligned section headers and hero

### Example compositions (reference only)

These are the demo pages the style was designed on, listed top to bottom. **Do not copy their sections into the project.** Use them to see how the style handles a given kind of screen: for data-heavy tools and panels look at the Dashboard, for forms look at Contact and Profile, for marketing pages look at the Landing page. Skip sections that do not fit the project's topic.

#### Landing page

1. **Hero**: big headline, short lead paragraph, primary and secondary CTA, visual
2. **Client logos**: row of customer or partner logos
3. **Features**: grid of feature cards with icon, title and description
4. **Stats**: a few large numbers with labels
5. **Testimonials**: quote cards with author name, role and avatar
6. **Call to action**: highlighted band with a headline and a primary button
7. **FAQ**: expandable list of questions and answers

#### Dashboard

1. **Header & actions**: page title, date range or filters, action buttons
2. **Alert**: inline alert or banner with a status message
3. **KPI cards**: row of metric cards: value, label, trend vs previous period
4. **Charts**: chart cards (line or area for trends, bars for comparisons)
5. **Transactions & activity**: data table with status badges, next to an activity feed

#### Pricing

1. **Header & toggle**: headline, lead text, monthly or yearly billing toggle
2. **Pricing plans**: plan cards side by side; the recommended plan is visually emphasised
3. **Plan comparison**: feature comparison table with checkmarks
4. **FAQ**: billing questions and answers

#### About us

1. **Hero**: mission statement headline with supporting text
2. **Values**: grid of value cards
3. **Team**: grid of people: avatar, name, role
4. **Company history**: vertical timeline of milestones
5. **Announcement**: highlighted notice or alert block

#### Contact

1. **Header**: title and short intro
2. **Form & office**: contact form (inputs, select, textarea, checkbox, submit) next to office details
3. **FAQ**: common questions

#### Profile

1. **Breadcrumbs**: navigation path to the current page
2. **Profile header**: avatar, name, role, badges and actions
3. **Details & settings**: tabs with details, form fields, switches and settings

## 6. Components

Each component has a chosen variant and its own tokens (`--sf-<component>-*` in the CSS export).

| Component | Variant | Background | Text | Border | Radius | Padding | Font | Shadow | Hover |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Buttons | Solid | `primary` | auto (readable contrast) | 1px `primary` | 8px | 11px 20px | body 15px/600 | none | darken 40% |
| Cards | Outlined | `surface` | `text-primary` | 1px `border` | 12px | 24px 24px | - | none | - |
| Inputs | Filled | `border` @45% | `text-primary` | 0px transparent | 8px | 10px 14px | body 15px/400 | none | - |
| Textareas | Neumorphic | `background` | `text-primary` | 0px transparent | 8px | 12px 14px | body 15px/400 | none | - |
| Dropdowns | Elevated | `surface` | `text-primary` | 1px `border` | 10px | 8px 12px | body 14px/500 | lg | darken 6% |
| Selects | Outlined | `surface` | `text-primary` | 1px `border` | 8px | 10px 2px | body 15px/400 | none | - |
| Checkboxes | Rounded | `surface` | `text-primary` | 1px `border` | 4px | - | body 15px/400 | none | - |
| Radio buttons | Brutal | `surface` | `text-primary` | 3px `text-primary` | 8px | - | body 15px/400 | none | - |
| Switches | Square | `border` | `text-primary` | 0px `text-primary` | 4px | - | body 15px/400 | none | - |
| Badges | Solid | `primary` | auto (readable contrast) | 0px transparent | 6px | 3px 10px | body 12px/600 | none | - |
| Alerts | Soft | `info` @10% | `text-primary` | 1px `info` | 8px | 14px 16px | body 14px/400 | none | - |
| Modals | Outlined | `surface` | `text-primary` | 1px `border` | 14px | 28px 28px | - | sm | - |
| Tables | Lined | transparent | `text-primary` | 1px `border` | 10px | 12px 16px | body 14px/400 | none | darken 4% |
| Tabs | Underline | transparent | `text-primary` | 1px `border` | 0px | 9px 14px | body 14px/600 | none | - |
| Navigation | Pills | `background` | `text-primary` | 1px `border` | pill | 8px 14px | body 14px/500 | none | darken 6% |
| Breadcrumbs | Chevron | `surface` | `text-secondary` | 1px `border` | 8px | - | body 13px/500 | none | underline |
| Tooltips | Dark | `text-primary` | `background` | 1px transparent | 6px | 6px 10px | body 12px/500 | md | - |

**Interaction states:** press scale 0.97, focus ring 3px in `primary`, disabled opacity 0.45.

## 7. Motion

- **Duration:** 220ms, easing `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out)
- **Section reveal on scroll:** fade, 8px travel, 40ms stagger between items, once
- **Page transitions:** fade
- **Smooth scroll:** yes · **Scroll progress bar:** no · **Parallax:** no
- **Reduced motion:** respect `prefers-reduced-motion` and disable animations

| Component | Enter | Micro-interaction |
| --- | --- | --- |
| Cards | fade | none |
| Dropdowns | fade-down | none |
| Alerts | slide-left | none |
| Modals | zoom | none |
| Tables | fade | none |
| Tabs | fade | none |
| Tooltips | fade | none |

## 8. Files in this export

| File | What it is |
| --- | --- |
| `css/*.tokens.css` | All CSS variables (light and dark), base typography, motion. **Recommended starting point:** import it in your global stylesheet. |
| `tailwind/tailwind-v4-theme.css` | Tailwind v4 `@theme`. Remove its `@import 'tailwindcss'` line if your global CSS already imports Tailwind. |
| `tailwind/tailwind.config.js` | Tailwind v3 theme extension. |
| `scss/*.scss` | SCSS variables, maps and mixins. |
| `react/*` | Tokens as TypeScript and example components (Button, Card, Input, Badge). In Next.js App Router add `'use client'` to components that use hooks. |
| `json/*.styleforge.json` | Complete design definition. Can be re-imported into StyleForge. |
