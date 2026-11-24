# CampusArena visual guide

CampusArena uses a light campus workspace and an OLED dark theme. Preserve the green athletics identity in both modes.

## Design rules

- Manrope Variable for interface text; Hugeicons for icons.
- Light mode uses paper-colored backgrounds and white cards. Dark mode uses black backgrounds and neutral charcoal cards.
- Keep green primary buttons, pale-green navigation selections, and competition highlights in both themes.
- Use neutral borders, modest corners, clear focus outlines, and consistent spacing.
- No gradients, emojis, shadows, colored borders, or hover movement.
- Color transitions may be subtle; respect reduced motion.
- Keep labels, supporting text, and form values readable in both themes.

## Stylesheet responsibilities

Styles load in this order from `frontend/src/main.jsx`:

1. `global.css`: base elements and established component structures.
2. `glass.css`: legacy component layout and interaction compatibility rules. The filename is historical; newer theme rules override its materials.
3. `revamp.css`: workspace structure and shared component appearance.
4. `themes.css`: typography, semantic color tokens, theme toggle, and referee components.
5. `layout.css`: shared sizing, alignment, spacing, overflow handling, and responsive breakpoints.

Put color changes in theme tokens. Put shared layout fixes in `layout.css`. Avoid adding another stylesheet that overrides the same components.

## Responsive behavior

- Desktop: persistent navigation rail, constrained content, and readable form columns.
- Tablet: collapse match and referee sidebars before controls become cramped.
- Phone: show all navigation items in a two-column grid; stack forms and actions as needed.
- Dialogs stay within the viewport and scroll internally. Standings and staff tables scroll inside their containers.
- Tournament cards have consistent action areas. Referee team-event panels sit side by side when space permits.

Use concise campus language. Empty states explain what is missing and how to proceed. Show success only after the server confirms an action.
