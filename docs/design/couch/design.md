# Discord Pad — Couch UI design proposal (Round 4)

Date: 11 October 2026. Input: `context.md` project snapshot. This is a **UX and CSS-patch specification**, not a proposal to replace `discord.com/app` or to call Discord APIs.

## Objective

Enable the following on a 16:9 television from an Xbox controller, without using a pointer or physical keyboard:

- Find a server and a text/voice channel.
- Join a server voice channel, identify who's connected, mute/deafen, and leave.
- Find and read a DM, and send a reply via the existing on-screen keyboard.
- Recognise and answer/decline an incoming DM call from anywhere in the wrapper.

Primary constraint: preserve the real Discord DOM and interaction model. Restyle the existing app using CSS plus the existing preload navigation, focus, call detection, and help overlay. No replacement message/feed/sidebar UI, scraping of private message data, or unofficial Discord API.

## Visual concept

**Theme**: dark, low-chrome, high legibility; Xbox-style focus clarity with Discord-compatible visual identity.

**Three existing regions**:

1. **Server rail** — ~88 CSS px, 56 px server targets, prominent selected/unread distinction. DM Home is the first navigable item. Avoid redundant headers, help, activity, upsell UI.
2. **Channel or DM list** — ~340 CSS px, 56 px rows, strong grouping between text and voice, keep unread badges and genuine voice occupants where native UI exposes them. When in Home, show Discord's actual DM list rather than creating a duplicate.
3. **Content** — fills remainder; header ~76–80 px, readable chat, contextual voice-call participant view using Discord's actual call UI. Message composer always accessible, no fixed call element covering messages.

**Visual states**: (a) browse/read chat; (b) browse DMs; (c) connected to voice; (d) incoming call. See `discord-pad-couch-concept.html` for an interactive *visual approximation*, not a screenshot of live Discord.

**Sizing**: target roughly 1920 × 1080 *effective CSS viewport* on a 4K TV by adjusting the existing Electron zoom setting as appropriate. Avoid designing at physical 3840 px with unreadably tiny CSS-sized controls. Treat 56 px as a starting point, not an accessibility guarantee.

**Tokens**:

| Token | Value |
|---|---|
| Background | `#111824` |
| Sidebar | `#182231` |
| Selected row | `#273651` |
| Focus ring | `#a1adff`, 3 CSS px + offset |
| Text | `#f0f4ff` |
| Secondary text | `#a2afc7` |
| Connected | `#55dca3` |
| Danger/decline | `#ff7990` |

Visually distinguish **selected** (currently open) from **focused** (next action receives A). The latter gets an always-visible focus ring. Focus, mute and connected status must not be conveyed with colour alone.

## State and navigation contract

1. D-pad up/down stays inside the current spatial region. Left/right changes region except inside a modal, call control cluster, on-screen keyboard, or other inherently horizontal content, where native ordering wins.
2. A activates the primary native control. On a text channel, opens the channel; on a DM, opens the conversation; on a voice channel, joins or opens its native join action; on a composer, launches the existing OSK. Do not turn mere navigation focus into an accidental voice join.
3. B is context-sensitive: incoming call → decline; OSK → close OSK; menu/dialog → dismiss; voice call's *normal browsing view* → back, **not hang up**. Explicit R3 remains the disconnect shortcut; an optional hold-to-disconnect guard can be configurable.
4. LB/RB cycles Discord's server navigation, including the DM Home button. LT/RT cycles channels while scoped to the current server/DM region; preserve sensible focus and skip noninteractive headings.
5. X/Y retain mute/deafen. Provide immediate visual state feedback via a small persistent connected/muted indicator and transient label; keep the native Discord call indicators intact.
6. Right stick scrolls main message content; never silently moves selection or scrolls an unrelated sidebar unless the sidebar is explicitly focused.
7. Menu retains the official Ctrl+K Quick Switcher; focus immediately transfers to input and the OSK is available. The official switcher supports `@` DMs, `#` channels, `!` voice, and `*` servers. This is a secondary route, not the only way to open DMs.
8. View continues to open help; View+Y the settings menu; View+Menu full screen. Existing remapping remains available. Do not unexpectedly reset user mappings when enabling Couch UI.
9. Any Discord modal, context menu, settings screen or OSK *traps navigation while visible*. Restore the exact previous focus target (or the nearest valid surviving target) on dismissal. Re-rendered/virtualised message rows need semantic fallback.
10. Native Discord message text must remain selectable/readable; avoid forcing users to focus every message. Right stick reading/scrolling is the normal path, optional focus mode for buttons/links on messages.

## Incoming-call contract

Ringing overrides regular navigation. The existing `calls.mjs` identifies the real Discord incoming-call dialog. CSS enlarges it and highlights answer/decline. A should target **the actual Discord answer button** only when incoming state is positively detected. B should target **the actual decline button** or the documented official Escape fallback; L3 remains an alias for answer. Show caller identity from Discord's rendered UI, not a parallel DM record. On accept/decline, restore prior focus as soon as Discord has removed the dialog; avoid synthetic optimistic success messages.

Discord documents `Ctrl+Enter` to answer and `Escape` to decline on desktop. These are fallback actions **only when the incoming dialog is confirmed**. Gamepad events only arrive while the app window has input focus; the wrapper cannot guarantee a controller answer while another application is focused.

## Voice-call contract

- Focused voice channel A joins using the native channel element or confirmed join button; if it only opens a preview, A then chooses the native Join Voice CTA. Never fake a connected state before Discord confirms it.
- After join, present the existing participant tiles in larger, clearer cards and preserve mute/deafen/camera/screen share controls, including any disabled states. Show active channel and connection state persistently.
- Normal B goes back to channels, **does not disconnect**. R3 disconnects deliberately; optional hold guard to avoid accidental leave.
- Keep the bottom call panel visible but compact; don't overlay or conceal the message composer. Any CSS reflow must be verified in video, screenshare, or narrow-window states.

## CSS implementation strategy

A **small selector adapter** in `selectors.mjs` identifies the real Discord containers and marks existing nodes with namespaced attributes, such as:

- `data-dp-region="servers|channels|main"`
- `data-dp-role="server|channel|dm|message|composer|incoming-call|secondary"`
- `data-dp-focus="true"`
- `data-dp-root="true"` and `data-dp-mode="couch"` on an ancestor

The supplied `discord-pad-couch.css` is a *scaffold for these proposed attributes*. It **will not work as-is without implementing the attributes against the real Discord DOM**. Preserve the existing `custom.css` live reload and user hide presets. Don't rely on hashed CSS-module class names; where selectors are heuristic, use accessibility roles/names first and explicit structural fallbacks. Avoid broad root-level `display:grid` rules because they can break Discord's layout, sidepanels and modals.

For high-confidence CSS-only modifications, style native elements and targeted containers. For ephemeral HUD, controller focus and incoming call priority, reuse `overlay.mjs`, `focus.mjs`, and `calls.mjs` rather than trying to achieve behavioural changes with CSS alone.

## Practical order of work

- **Round 4A — TV readability and spatial consistency**. Adapter markers; large rows; server rail; channel widths; selected-versus-focused states; message density; retained user CSS; measure zero dead focus targets.
- **Round 4B — DM navigation and native call handling**. Make Home discoverable, verify modal focus trap and restore, A to answer / B to decline, L3 alias, ringing UI priority.
- **Round 4C — Voice and context HUD**. Call participants, compact voice bar, mute/deafen feedback, contextual button legends, confirm accidental-disconnect protections.

Continue the existing workflow: one draft PR + Windows installer artifact per round; test on HTPC before merge.

## Acceptance tests on real Discord (critical)

1. From an arbitrary server text channel, reach Home → a DM → message composer using only controller; B returns, retaining context.
2. Open a server voice channel; A joins or opens the native join CTA; X/Y toggles tracked state; B navigates back without disconnecting; R3 disconnects.
3. While reading a different server's chat, receive a DM call; A answers and B declines on separate attempts. Modal traps focus until resolved and previous focus is recovered.
4. Browser refresh, UI zoom change, and Discord DOM re-render do not strand focus or permanently hide native controls.
5. With a live voice call, confirm no important controls or participants are hidden by styling; check screen sharing and video.
6. From each view, OSK can write and submit text; Search/Quick Switcher remains operational; no physical keyboard/mouse required.
7. User hide presets, custom.css and Settings menu continue working. Reduced motion support, keyboard focus and accessible button labels are not broken.

## Boundaries and unknowns

The design is grounded in the uploaded project summary but **not** in a live DOM dump or the private repo's current branch. The summary notes that the real HTPC verified Round 1, but Round 2/3 improvements still needed confirmation. CSS widths, selectors and proposed A-on-voice behaviour therefore need a live compatibility pass. Native Discord controls cannot be rearranged arbitrarily by CSS alone; new semantic aggregations, synthetic DM previews or a new dashboard would be out of scope.
