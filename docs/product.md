# Timeline product brief

## Purpose and vocabulary

Timeline helps people collect life events across categories and see them in
context. Personal journaling is the initial focus, with multiple real people
or fictional characters supported inside a project.

- **Account:** the single owner of private projects.
- **Project:** a collection of people, categories, events, and eventually stories.
- **Person/character:** a project record, not another account or invited editor.
- **Event:** one memory/milestone with participants, categories, and a flexible date.
- **Timeline:** a filtered chronological view of events, not a separate object.
- **Story:** planned longer authored or transcribed text, manually linked to events.
- **Browser draft:** incomplete/unconfirmed local work, not a cloud-saved event.

## Active delivery approach

A responsive web app developed on Windows, usable from desktop and mobile
browsers. Canonical records live online in Supabase; local event drafts protect
editing work where browser storage is available. Native apps and full offline
replication are deferred. See [ADR 0001](decisions/0001-web-first-online-first.md).

README's [current milestone](../README.md#current-milestone) distinguishes
implemented functionality from the intended MVP below.

## First-use experience

Welcome -> create account -> verify email -> create project and first person
-> empty timeline -> add an event -> view the acknowledged saved event.

Keep the interface calm: warm paper/forest green, clear hierarchy, mobile-friendly
controls, and accessible text rather than color alone. Starting should not
require a birthday, biography, photo, or exact date.

One setup action creates the project, first person, and default categories.
The empty timeline invites a first memory; guided questions and story capture
are planned alternate entry paths, not mandatory onboarding steps.

## Event and date requirements

- At least one participant; optional multiple categories, notes, and location.
- One shared event appears on every participant's view but only once in the
  project's combined view.
- Initial editable category templates cover home, education, work, friendships,
  romantic relationships, travel, health, children/family, attended events,
  athletics, spiritual life, name changes, and personal growth.
- Preserve exact-day, month/year, year-only, range, season, approximate, ongoing,
  unknown, and custom-wording dates. No fictional calendar system in the MVP.
- Seasons use a project-level hemisphere and meteorological month bounds.
  Cross-year seasons are labeled with the year they start.
- Unknown/unplaced custom dates belong in Undated. Placement bounds aid
  sorting/filtering but must not become displayed claims of exact dates.
- Visually distinguish uncertain placement from an actual duration.
- Filter by participants, categories, date overlap, and text. Multiple selections
  within a filter use OR; different filter types use AND. Undated is explicit.
- Archive categories without erasing historical associations. Removing a person
  must not silently remove shared events or leave an event without a participant.

## Intended MVP beyond the current slice

These requirements are not statements of implemented support:

| Capability | Agreed boundary |
| --- | --- |
| Guided capture | Curated category prompts; user reviews/saves, no inferred facts |
| Stories | Typed text or recording/transcript; manually create/link events |
| Images and PDFs | Up to 25 MB per file; private storage and explicit transfer state |
| Audio recording | Foreground; up to 60 minutes or 100 MB, whichever comes first |
| Transcription | Optional verified on-device support; typing/recording remain usable |
| Deletion | 30-day Trash then purge; explicit account deletion is a separate lifecycle |
| Export | Filtered, paginated printable PDF with A4/US Letter and visible omissions |
| Session privacy | Reauthentication/lock with honest browser limitations |

Do not reduce approved limits silently if browser reliability is insufficient;
bring evidence and obtain a product decision.

## Privacy and boundaries

Personal histories may include highly sensitive material. Keep projects private
to their owner. No journal-content analytics, private content in fixtures/logs,
or automatic cloud speech fallback. On-device transcription does not imply
saved recordings never reach the selected private backend.

Browser drafts can be lost through clearing site data, eviction, private browsing,
or device loss. PDF is publication output, not a restorable archive. Git/USB
source backups do not back up Supabase records or browser drafts.

Deferred: collaboration/public sharing, native clients, full offline sync,
PWA-specific offline guarantees, AI extraction/biographies, fictional calendars,
video/OCR, app-managed end-to-end encryption, archival restore, and bound-book
layouts/ordering. Changes to these boundaries require an explicit decision.

## Future collaboration feature: discussion notes/chat

Defer in-app collaborator discussion notes or chat until after the current MVP
scope. Owners and Co-Authors could use a contribution-linked conversation to
consult before approving or declining a proposal. This discussion is separate
from event memories/notes and does not itself approve or modify a contribution.

Conversation access must respect the contribution's authorized audience and
must not expose hidden/private material. Detailed participants, notifications,
retention, and moderation behavior remain unspecified. No chat implementation
or schema is required at this stage.
