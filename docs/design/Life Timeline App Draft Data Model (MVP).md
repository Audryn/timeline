# Life Timeline App: Draft Data Model (MVP)

Draft v2, November 3, 2026

## Core principles

1. **Events are the core object.** A timeline is a saved view of events involving one person. Projects are an optional folder added later.
2. **Authorship is ownership.** Everyone owns what they write. Nobody edits someone else's words directly.
3. **Shared and private layers.** Facts, photos, recordings and shared notes can cross a connection. Private notes never do.
4. **One review rule.** Anything a contributor adds or changes on someone else's content goes through the reviewer's inbox (Accept or Decline).
5. **Connections are ongoing but endable.** Ending one stops future flow. What was already received stays as the recipient's own copy, with no syncing afterward.
6. **Legacy contacts are separate.** They use access grants, independent of any kid connection.

**Scope.** The app is for building and comparing people's lives, real or fictional. It is not a story-plotting tool, so narrative order, flashbacks and relative dates are out of scope.

## Tables

### Identity

**User**: id, email, display\_name

**Person**: id, name, birth\_date, birth\_date\_precision, birth\_date\_text (all optional; age is derived, never stored), is\_fictional, created\_by\_user\_id, linked\_user\_id (null until the person has an account)

**Project** (optional): id, owner\_user\_id, name, kind (real or fiction), calendar\_id (null for Gregorian)

**Timeline**: id, subject\_person\_id, owner\_user\_id, project\_id (null), title

### Events and layers

**Event**: id, author\_user\_id, title, event\_type (moment, residence, job, school, other; captioned "Category" in the UI), place\_id, start\_date, end\_date, earliest\_day, latest\_day, sort\_position, sequence, date\_precision (day, month, season, year, unknown), date\_text (e.g. "summer 1994"), is\_ongoing, details (JSON, fields that apply only to some types), copied\_from\_event\_id (null), version, created\_at

**Place**: id, name, parent\_place\_id (null for top level), kind (country, region, city, address, other), latitude and longitude (optional), created\_by\_user\_id. Parent links let Missoula sit inside Montana, so comparisons can match at the right level.

**EventPerson**: event\_id, person\_id, role (optional). Many-to-many link of people to events.

**TimelineEvent**: timeline\_id, event\_id, source (native or contributed), shared (bool). This is what puts an event on a timeline.

**Note**: id, event\_id, author\_user\_id, body, visibility (private or shared)

**Media**: id, event\_id, author\_user\_id, kind (photo, audio, import), url, visibility (default private for imports)

### Access and review

**Connection**: id, timeline\_id, connected\_user\_id, status (active or ended), auto\_accept (bool), ended\_at

**AccessGrant**: id, timeline\_id, user\_id, role (viewer or contributor), activate\_on (null or a later trigger, for legacy contacts)

**Contribution** (the review inbox): id, timeline\_id, contributor\_user\_id, **reviewer\_user\_id**, kind (new\_event, note, edit), target\_event\_id (null for new events), payload (JSON, e.g. field, old, new), base\_version, status (pending, accepted, declined, outdated, withdrawn), decided\_at

**ChangeLog**: id, event\_id, field, old, new, proposed\_by, approved\_by, at

**Notification**: id, user\_id (the recipient), type, actor\_user\_id, timeline\_id, contribution\_id (nullable), connection\_id (nullable), access\_grant\_id (nullable), created\_at, read\_at

## Rules the app must enforce

- **Direct edits are author-only.** Check Event.author\_user\_id before any write. Everyone else gets the "propose a change" flow.
- **Reviewer depends on kind.** New events and notes go to the timeline owner. Edits go to the target event's author.
- **Person records follow the same rule.** The creator edits directly and others propose. Once linked\_user\_id is set, that user becomes the reviewer for their own record.
- **Declines are quiet.** The contributor sees "not added to Mom's timeline," not a rejection. Their event stays on their own timeline.
- **Stale proposals.** If Contribution.base\_version does not match Event.version, mark it outdated.
- **Imports land private.** A review step comes before anything is shared.
- **Optional trust setting.** Connection.auto\_accept lets an owner skip manual review for a trusted contributor.

## How the scenarios map

- **Spin-off to a kid's account:** create a Connection. The kid's account reads the shared TimelineEvents.
- **Kid adds a forgotten memory:** it is the kid's Event, plus a Contribution of kind new\_event. Accepting adds a TimelineEvent (source contributed), shown as "from Emma." Declining leaves it only on the kid's timeline.
- **Correction to a date:** a Contribution of kind edit, reviewed by the event's author, shown as before and after. Accepted changes are written to ChangeLog.
- **Disconnect:** set the Connection to ended and copy the shared events to the kid's account using copied\_from\_event\_id. No syncing after this. Contributions the kid made stay on the parent's timeline, attributed to the kid.
- **Withdraw:** the contributor sets their Contribution to withdrawn and the TimelineEvent row is removed. They can pull back what they gave, just as the parent keeps what was received.
- **Legacy contact:** an AccessGrant on the timeline. Their contributions use the same review flow, and disconnecting a kid never affects them.

## Dates, places and comparison

Age is derived, never stored. It shows only when the subject has a birth date, and reads "about 34" when that date is loose.

- **Display versus order.** date\_text and date\_precision are what people read ("summer 1994"). sort\_position is a day count from the calendar's epoch and is what actually orders events, so any calendar can sort alongside any other.
- **Bounds.** earliest\_day and latest\_day hold the range a loose date could fall in. An exact day has equal bounds, and an unknown date leaves them empty.
- **Sequence.** An optional manual order for events whose dates are not known yet.
- **Event types.** Any event with an end date is drawn as a span, and the type only sets the default (a residence starts as a span, a birthday as a point). is\_ongoing marks a span that is still running, as opposed to one with an unknown end. The type also decides which fields and captions the UI shows: captions live in app code, and type-specific fields (employer, school name) live in details. Residence periods answer "where was this person in year X."
- **Calendars.** Fictional calendars are not in the MVP. Project.calendar\_id is the placeholder for a later Calendar table (eras, month names and lengths, epoch).

Comparison features come after the MVP, but the data above already supports them:

- **Could they have met:** overlapping residence periods in the same place.
- **Conflict flags:** one person in two places at once, or in a place that contradicts a residence. Fuzzy dates show "possible overlap," not "conflict."
- **Side-by-side view:** two or more timelines in parallel with shared moments highlighted.
- **Gaps:** years where a character's whereabouts are unknown.

## Notifications

The MVP has in-app notifications only. Almost every notification is triggered by a Contribution, Connection or AccessGrant changing state.

- **Contribution created:** the reviewer is told "Emma added a memory" or "Emma proposed a change."
- **Contribution accepted:** the contributor is told.
- **Declined, withdrawn or outdated:** no notification. Declines stay quiet, and the reviewer's inbox simply updates.
- **Connection and access:** invited, connected, ended, and a legacy contact being activated.

Three rules apply. Notifications never show content, only who did what, so private-layer text never appears in a notification channel. The pending count in the inbox is a query on Contribution where status is pending, not a stored value. Notification types are validated in app code.

Email digests, push and per-type preferences come after the MVP.

## Decisions made

- Two-way connections, with approval required for all incoming contributions (new events, notes, edits).
- Edits are reviewed by the event's author.
- No syncing after disconnect.
- Disconnect keeps what the recipient already received.

* Scope is character creation and comparison, not story plotting.
* Fictional calendars get room in the schema only, not MVP support.
* MVP dates: precision, text, earliest and latest bounds, sort position and manual sequence.
* Places are structured, and events have a type, so residence periods can power comparisons.

- One event\_type field (UI caption: Category) sets the default span or point, the fields and captions shown, and how the event is drawn. The list of types is validated in app code, not by a database constraint.

* Notifications are in-app only for the MVP, never show content, and are not sent for declines.

## Still to work through

- **Dates:** the Calendar table (eras, month names and lengths, epoch) and computing age in a fictional calendar. The schema has room for both.
- **Imports:** Facebook memories, photos and voice recordings, and the private-by-default review step.
- **Notifications:** email digest, push and per-type preferences, after the in-app MVP.
- **Legacy contact triggers:** what activates activate\_on.

* **Comparison view and conflict checks:** built on the place, kind and bounds fields.
* **Export:** a character's timeline in a form other story-planning tools can use.

## SQL

A matching SQL schema is provided separately for use with a coding agent.
