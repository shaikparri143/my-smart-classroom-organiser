# UI redesign changelog

## 2026-10-17 — Premium workspace redesign pass

- Replaced the understated workspace chrome with a floating, softly lit glass sidebar, grouped navigation, violet/cyan active indicator, refined account controls, and a layered top bar.
- Strengthened the page hierarchy with larger editorial headings, wider spacing, luminous glass cards, elevated data cards, gradient action buttons, and a more pronounced theme-aware background.
- Added theme-aware control styling across forms, selects, text areas, marks tables, attendance, announcements, discussions, notifications, and settings so feature styles no longer retain their old white/gray controls in dark mode.
- Rebuilt the Doubt Box form and question list with dedicated styles while retaining its existing course and question data flow.
- Refined the Sun/Moon switch and added restrained card hover, skeleton shimmer, and entrance motion.
- Wired workspace navigation to a roughly 400 ms shrink/fade and expand transition, temporarily blocks interaction in the page area, respects reduced motion, and records in-app pages in browser history.
- Browser-checked the authenticated shell and Doubt Box with temporary route-intercepted preview identity/course data. This verified visual layout and navigation without claiming live backend-data verification.

## 2026-10-17 — Glass workspace refresh

- Added shared light/dark colour, typography, spacing, radius, blur, shadow, and motion tokens; theme follows the OS on first visit and is saved locally.
- Added reusable accessible Toggle, themed day/night switch, Button, Input, GlassCard, Modal, Toast, Tabs, Skeleton, ProgressRing, and EmptyState components.
- Restyled the existing dashboard shell, cards, controls, auth surfaces, and discussion feed with responsive frosted-glass surfaces, focus states, and slim scrollbars.
- Added a functional Ctrl/Cmd+K page-search popover; Enter opens a matching workspace page, while unmatched text continues to filter course results.
- Added Settings controls for theme and reduced motion, plus lazy-loaded dashboard and AI pages with a skeleton fallback.
- Reworked Discussions into a channel-like feed with author initials, a persistent scroll area, composer after the message history, success toasts, and an accessible delete-confirmation dialog.
- Fixed horizontal overflow on narrow screens by removing the inherited 320px body minimum width and tightening the mobile auth header.
- Applied animated checkmark/radio styling to selection controls. Existing checkboxes are only bulk/student multi-selects; announcement recipient and quiz-answer radio groups keep their native selection semantics. Theme and reduced-motion booleans use accessible switches.
- Existing primary/secondary action styles now use shared pill, gradient, hover, pressed, disabled, and focus treatments; the reusable Button also supports a pending spinner.
- Added restrained, theme-aware aurora lighting over warm ivory/light blue-violet and midnight blue palettes, with motion respecting the reduced-motion preference.
- Wired workspace navigation through a short exit/entry transition while keeping the sidebar and top bar stable; reduced-motion and unsupported-animation fallbacks update pages immediately.

### Known scope limitation

The admin page JSX files in this checkout are empty and no admin frontend service modules are present. The redesign does not fabricate admin pages or data; the current shell still lacks a working admin navigation flow.
