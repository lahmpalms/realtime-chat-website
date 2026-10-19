# Phase 3 — chat UX, mobile layout and accessibility

Date: 2026-10-19. Implemented and verified locally against Firebase emulators. No cloud deployment.

## Changes

- Replaced the name screen with a native form. Thai and other printable Unicode names now use the same trimmed 1–20 UTF-16-unit limit as the server. Empty/control-character errors are associated with the field and retain focus. Joining failures appear inline, preserve the name and allow retry. Removed document-wide submission/clear shortcuts and automatic mobile autofocus. Enter during IME composition does not join.
- Replaced the single-line composer with a growing, bounded textarea: Enter sends; Shift+Enter inserts a newline; composition Enter does not send. The textarea remains focused and read-only while submitting. Existing per-tab draft persistence, pending request IDs, cooldown and late-acknowledgement protection remain in place. Reconnection permits draft editing, with an explicit retry control in the connection banner.
- Created one viewport-height flex layout and one actual message scroller. Removed duplicate header spacing, nested main/log landmarks and competing scroll containers. The visible viewport drives the chat shell when the keyboard/viewport changes; safe-area padding protects the header/composer. Input text is at least 16px and primary chat controls are at least 44×44px. Join/error screens can scroll on short viewports, while the chat keeps its composer visible.
- History opens at the latest message. New incoming messages follow the bottom only when already near it; reading earlier messages retains the position and shows a new-message count with a keyboard-accessible jump button. Own acknowledged messages bring the view to the bottom. Content/viewport resizing preserves the bottom anchor. Jump returns focus to the conversation.
- Separated first-message loading from empty history. Kept full-width long text/Thai text wrapping and multiline messages readable. Names/message text use theme foreground colors; user colors identify avatar borders rather than low-contrast text. Header includes the online count, connection state, theme toggle and Leave.
- Emoji choices use a labelled modal with focus containment, Escape dismissal and return to the trigger. Removed duplicate toast hosts and redundant persistent connection toasts; the connection banner is the recovery surface. Live announcements describe only new incoming messages, rather than re-reading initial history. Reduced-motion styles cover transitions/animations and smooth scrolling; browser zoom is unrestricted. Removed references to absent manifest/Apple icon files.
- Tailwind now scans all source directories, including the layout component under `contexts`, so its viewport/layout utilities are emitted in production.

## Verification

Run `npm run test:phase3` on Node 22 with Java 21+ after installing Chromium (`npx playwright install chromium`). It builds Functions and starts local Auth, RTDB and Functions emulators with the demo project. Fixture history writes use emulator-owner access only; browser actions use actual anonymous Auth, callables and database rules.

Coverage includes:

- The 15 existing authorization/session/quota integration tests.
- The seven existing browser regression scenarios for tabs, reconnect, saved drafts, duplicate submission, cooldown and uncertain/late acknowledgements. The pending-composer assertion now checks read-only plus disabled Send, preserving keyboard focus.
- Five UX browser scenarios: Thai/empty names, IME and multiline sending; inline admission errors/retry; initial scroll, reading history, new messages, own sends and resize anchoring; 320×568, 390×844, 844×390 and 390×360 layouts; keyboard order and emoji focus restoration.
- axe scans tagged WCAG 2 A/AA, 2.1 A/AA and 2.2 AA on join/chat screens in light/dark themes and the emoji dialog on desktop/small viewport. Bright identity colors are included in the chat fixture. Automated scans do not certify WCAG compliance.

Local results: **15/15 emulator integration tests and 12/12 Chromium browser tests passed** (27 total). `npm run check` passed frontend/backend lint, typechecks and both production builds with sample build-only configuration. The database predeploy guard, manifest/lockfile comparisons and `git diff --check` also passed. The axe assertions reported no violations for the tested tags/states. Mobile screenshots were inspected locally; this is not a visual certification or native screen-reader test.

Runtime-only dependency audits reported **0 vulnerabilities** in both frontend and Functions trees. The full frontend development tree currently reports **15 advisories (8 high, 7 moderate)** across Firebase CLI, ESLint and Tailwind tooling chains. Track these in Phase 4; automatic force fixes propose incompatible changes/downgrades or have no fix for some chains.

## Release limits and next steps

The small/keyboard-sized viewports are Chromium simulations, not physical iOS/Android keyboard verification. Synthetic composition events exercise the Enter guard, not a complete native IME. VoiceOver/NVDA, real touch devices, Safari/Firefox, text zoom and deployed network behavior still require release verification in Phase 5.

The shared-room history still has the previously documented unbounded database listener and room-wide transaction costs. Backend schemas, authorization and quotas were not changed in this phase. Phase 4 must implement bounded queries/pagination and retention, load-test contention, add operational monitoring/cost alerts and verify backup/restore. Development dependency advisories also require attention in that phase. Phase 5 then validates staging and rollout/rollback.

Next: **Phase 4 — performance, retention and operations**. Two phases remain: 4 and 5. The app is not yet approved for public production.
