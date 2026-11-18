# Life Timeline App: Revised Draft Data Model (MVP)

Draft v3, November 6, 2026; updated November 17, 2026

Companion: [timeline_schema_v3.sql](timeline_schema_v3.sql).
Previous proposal: [Draft v2](Life%20Timeline%20App%20Draft%20Data%20Model%20%28MVP%29.md).

## Status and scope

This document consolidates the agreed product direction. The companion SQL is
a **structural design draft**, not a migration, runnable application backend,
or completed authorization implementation. It deliberately grants no application
access. It also predates the project collaboration decisions below: project
timeline-level roles, author-approved participant access, and shared review
queues still need a structural redesign. Departure retention remains unresolved.
Its single-reviewer fields do not model those rules.
The explicit multi-timeline event placements now required for MVP are also not
represented by its timeline-local event structure.
Organizing events containing related entries also need structural design.
The SQL's item-selection transfer and settling-review archive structures are
superseded by whole-timeline transfer with no pending proposals and an immediately
frozen archive. Connected/paused/independent event states are not modeled.
Do not paste it into an existing development or production database.

The running app still uses project-owned data and project-scoped drafts.
Implementing this direction will require an architectural decision replacing
those boundaries, updated contracts and workflows, and tested database policies
and transactional functions. Neither the original proposal nor application code
is changed by these reference files.

Events are the core content. A timeline is a saved collection/view about one
subject; projects provide collaboration spaces as well as optional organization.
Real and fictional people are supported.
Explicit placement of one event on multiple subjects' timelines within one
account is MVP scope, especially for family histories. It is not automatic
sharing. Explicit continuity of already placed events after transfer is the
limited cross-account exception described in section 4, not general sync.
Story plotting, fictional calendars, comparisons, and legacy activation remain
outside this implementation slice. The app remains online-first with recoverable
browser drafts, not an offline replica or a custom two-way sync engine.

## 1. Identity, ownership, and provenance

- `app_user.id` is the Supabase `auth.users.id`, not a separately generated
  application identity. Email is optional; phone-only accounts are supported.
  Credentials and sessions never become transferable application data.
- A Person is a subject described in a timeline, not automatically a user.
  Linking a Person to an account requires that account's consent. Linking alone
  grants no access, transfers no ownership, and changes no review authority.
- Each content item records its original creator separately from
  its current editing authority. The timeline records its current owner.
  Attribution does not disappear when editing authority changes.
- The original timeline creator is its first Owner and Author. The current Owner
  has administrative control; original creation is historical attribution after
  transfer, not continuing authority. Ownership and authorship of contributed
  material are distinct and do not establish intellectual-property rights.
- Authorized timeline co-authors can edit shared content directly and review
  contributor proposals regardless of origin, whether or not a project is used.
  Co-authorship and proposal approval do not transfer ownership. Changing the
  owner always requires transfer, even if the former owner remains a collaborator.
- An event can have explicit placements on multiple subjects' timelines within
  one account. Those placements refer to one event, not independent event copies;
  shared-fact edits update every placement. Person involvement alone creates no
  placement or audience permission. Ordinary sharing exposes permitted content
  to authorized users, not unrelated timelines or private layers.
- Related copies have stable provenance identifiers and snapshot versions, not
  an implicit live synchronization link. Place/topic data must also remain
  independent where an archive or transfer requires it.

### One event on multiple timelines (MVP)

Keep **People involved** separate from **Show on timelines** in the event editor.
For example, while recording a birth on a parent's timeline, adding the child
as an involved person makes the child's existing timeline available as an
unchecked placement option. The user can explicitly select it during creation
or a later edit; adding a person does not open a mandatory confirmation dialog.
Do not silently create a timeline for an involved person who has none.

The current timeline is selected for initial event creation. Additional
placements require explicit selection, even when both timelines belong to the
same account. A birth-oriented prompt may make the option more prominent without
selecting it automatically. This behavior applies to events generally, not
only births.

Saving commits the event and the selected placement changes together. No extra
save-time placement prompt is needed unless the change would expand the audience.
Different timelines in the same account may have different sharing audiences:
any expansion needs explicit confirmation and applicable author permissions.
Confirmation cannot substitute for authority the user does not have.

Show a placed event once in a combined timeline view. Shared-fact edits affect
every placement; removing one placement does not delete the event from the
others. Placement does not transfer ownership or independently grant editing
rights. The UI must distinguish removing a placement from deleting the event.

Personal recollections, medical details, notes, and attachments are not
automatically exposed through another placement. A child's birth appearing on
their timeline must not reveal a parent's private childbirth account.
The shared event/placement schema, audience checks, and private-detail boundaries
must be designed and tested before enabling this feature. Cross-account event
placement is not generally offered. Continuing connections for events already
placed on retained timelines at transfer follow section 4.

### Organizing events and their entries (MVP)

An event can organize related events and memories added at creation or later.
For example:

- A five-week Trip to India in Spring 2001 can contain town visits, sights,
  train journeys, wedding celebrations, and individual memories.
- A Job with a month/year span can contain promotions, title changes, and
  work-location changes.

Each contained entry is an event in its own right, with its own type, people,
place, additional-details text, and optional date information. Preserve uncertain
or unknown dates: "during the India trip" supplies context, not an invented
occurrence date or a claim that the entry lasted for the entire trip.

Offer "Add an event or memory within this..." from the organizing event, and
allow an existing entry to be associated with an organizing event when editing.
Its detail view brings permitted contained entries together. Open text elaborates
on the organizing event itself; a contained Memory is a separate entry.

This is a narrow organizing relationship, not general-purpose event linking.
A job change and a residence change can be entered separately without an
explicit link between them. Arbitrary event-to-event relationships are outside
MVP scope. Organizing an entry is also distinct from placing one event on
multiple subjects' timelines; neither relationship implies the other.

Containment does not grant visibility, transfer ownership, or automatically
share private memories. Parent/entry visibility and derived counts must respect
audience boundaries. Hierarchy depth, timeline expansion/collapse, ordering,
and behavior when moving or removing an organizing event remain design details,
not silently chosen defaults.

## 2. Sharing is live access, not ownership

### Timeline sharing

Sharing grants a timeline role from the table below. Transfer Ownership is a
separate whole-timeline handover, not a sharing role or an event-by-event action.
Collaborators is the umbrella term for owners/authors, co-authors, contributors,
and read-only reviewers.

Each share belongs to a specific recipient, with its own role and exclusions.
Sharing includes current and future permitted non-private content and approved
updates, subject to the applicable author-audience rules. It is not a snapshot.

The sharer can select **everything**, **everything except private items**, or
exclude additional content for that recipient. "Everything" includes the sharer's
own private items explicitly authorized at that time; another creator's
private items still require that creator's permission. Future private items
are not included automatically and require explicit per-recipient authorization.
The items remain marked private; authorization does not make them public.
Excluding an event excludes its attached notes,
media, and any routes or derived results that would reveal that event. Item,
attachment, Person, place, search, counts, and notification queries all need to
respect the effective audience; authorization is not just a UI filter.

Private content remains accessible to its creator/current independent editing
owner and any explicitly authorized recipients, subject to their sharing role.
For private items, visibility permission alone does not grant direct editing
authority; the co-author view-implies-edit rule below applies to shared
content only. Timeline ownership, a Contributor role, co-authorship,
and account linking do not by themselves reveal another creator's private layers.

Contributors may keep their own private additions on the shared timeline and
edit those additions directly. The timeline owner and other recipients cannot
see them without explicit authorization from that contributor. These are private
items, not proposals waiting for the timeline owner to approve. Submitting
changes to someone else's content still requires review; the proposal is visible
to its authorized reviewer.

The owner can later hide previously shared content or revoke the entire share.
**Unsharing removes live viewing/contribution access and creates no recipient
copy.** It cannot erase previous downloads, independent copies, or archives.
This supersedes v2's copy-on-disconnect rule for ordinary sharing.

Recipients cannot share someone else's material onward in the MVP. A future
onward-sharing feature requires the original author's explicit permission.
Granting access to another creator's contribution must not bypass that creator's
permission. Collaborator access follows the explicit approval rules below;
external onward sharing and transfer/archive consent remain separate workflows.

### Timeline roles and project bulk controls

Permissions and collaborator roles belong to each timeline, not its project.
The timeline owner alone manages invitations, roles, removals, trust settings,
and ownership transfer. Co-authors may approve proposals but cannot administer
collaborators merely by being co-authors.

| Role | Rights within authorized content |
| --- | --- |
| Owner | Current timeline owner, direct editor and proposal approver; alone manages sharing, roles, removals, trust, and transfer. Shared submissions remain visible to the owner; creator-only private items remain protected. |
| Co-Author | Directly edits authorized shared content and approves/declines eligible proposals regardless of origin. Does not acquire ownership or collaborator-administration authority. |
| Contributor | Proposes shared additions and edits for approval by the owner or an authorized co-author. Can keep creator-only private items separately. |
| Reviewer | Reads permitted content only; cannot propose or directly edit content. |

One collaborator does not require a project. Sharing with multiple collaborators
prompts the user to create one as an organizational aid, not an access-control
requirement. Projects can also contain multiple private timelines with no other
participants. Users can create projects and add/remove timelines at any time.
Moving a timeline into, out of, or between projects preserves its owner,
collaborators, permissions, and existing trust; it does not widen access.

Projects offer bulk controls over timeline-level grants, including a people-by-
timeline view with mixed roles shown explicitly. For a family project, each child
can access only their timeline while a partner has Co-Author access to all.
For a screenplay, lead writers can be Co-Authors on all character timelines and
consultants Reviewers on all, with per-timeline changes still possible.

The project owner can explicitly authorize grants for future timelines,
separately from applying grants to existing timelines. These defaults may apply
to timelines that owner owns; another timeline owner's authorization is required
for their timeline. Adding an existing timeline must preserve its access and
offer any additional grants explicitly. Project ownership alone cannot override
timeline ownership, private-item protection, or author audience permissions.
Detailed authority for project-container management and mixed-owner projects
remains open; a project handover never silently transfers its timelines.

Authorship attribution and timeline ownership remain distinct. A co-author's
direct edits must still use version checks and revision history; "no approval"
does not permit silent overwrites of concurrent changes.

### Author-approved participant access

Each author controls whether other collaborators can view their shared
contributions. For a Contributor, the author can also allow or deny suggestions
on that author's work. Such permission cannot elevate the participant's role:
a Reviewer never gains suggestion rights, and a participant who cannot view an
item cannot suggest changes to it.
This controls proposal submission/access, not the decision on an already
authorized proposal. It does not create an original-author veto in the shared
queue or a suggestion-only restriction on a Co-Author's authorized shared work.

For a Co-Author, permission to view shared content includes direct editing;
there is no separate read-only or suggestion-only restriction on that content.
An author can withhold access, but cannot grant a co-author viewing without the
associated editing rights. Shared submissions remain visible to the timeline
owner; creator-only private items remain protected from both owner and co-authors.
Explicitly sharing a private item is not an implicit conversion to shared
project content or an automatic grant of direct co-author editing rights.

When participants join, notify affected authors and request approval before
exposing their existing contributions. Do not use the earlier proposed wording
that contributions are shared with newcomers by default. Approval by the
timeline owner does not substitute for another author's audience permission.

A new co-author can activate with partial access while approvals are pending.
For example, the new co-author can edit the owner's authorized shared content
immediately, while another author's work stays hidden until that author approves.
Approval then includes direct editing under the co-author role.

Audience controls must cover accepted content, pending proposals, before/after
history, attached media, and derived results. Editing or approving another
author's work must not relabel its authorship to bypass their audience controls.
How permissions apply to jointly edited material, later revocation, and future
contributions must be specified in the remaining workflows below.

### Removal, retention, and withdrawal: reopened

The timeline owner can remove a collaborator, revoking the access that grant
provided. It does not erase another independently authorized timeline or archive.
The earlier guarantee of authorship-only read access/export after removal is
**not settled**. A small edit must not provide a way to export somebody else's
whole timeline, record snapshots, or surrounding text after access is revoked.

Contribution withdrawal is also reopened. Access revocation, deleting material,
retaining/exporting it, and permission to reuse/publish it are separate issues.
Authorship or an app role does not establish a right to retract or reuse content;
collaborator agreements may affect those rights. The app does not interpret
contracts or guarantee that previously read/exported material cannot be reused.

A departure notification offering to leave contributions or request removal is
a candidate workflow only. Guaranteed deletion, handling jointly edited work,
nonresponse, and export entitlement remain unresolved. Do not automatically
delete accepted contributions or promise retained access based on this draft.

## 3. Contributions, review, and trust

### Targets and reviewer

Proposals have a stable ID, recipient timeline, contributor, authorized review
audience, typed target, submitted payload, and base version where they change existing content.
Targets include Person, event, note, and media, not just events.

- Shared additions retain contributor attribution and enter the authorized
  timeline review queue. New content
  retains the contributor's original attribution. A contributor's own private
  additions do not enter another user's approval queue.
- Changes/replacements use that same authorized queue, not an original-creator
  veto. A co-author directly edits authorized shared work without a proposal.
- Notes expressing a different recollection can be separate additions rather
  than an overwrite of someone else's words.
- Media additions, caption changes, and file replacements are distinguishable
  proposals. Replacing media does not destroy a blob still retained by an archive
  or independent copy.
- Private content is not available as a proposal target to a recipient without
  explicit authority to see it.

Contributor proposals go to a **shared review queue for the timeline owner
and all authorized co-authors**, regardless of who originated the target content.
Any one authorized owner or co-author can approve or decline; unanimity and a
separate original-creator approval are not required. The role and access check includes
the target, submitted payload, and before/after context. A co-author cannot learn
about hidden work through a proposal, notification, or queue count.
The read-only Reviewer role is not a proposal-approval role.

Once resolved, a proposal closes for everyone. Decisions must serialize so
concurrent reviewers cannot apply it twice or overwrite its terminal outcome.
The deciding actor is recorded separately from original authorship and the set
of people eligible to review. Loss of reviewer access while a proposal is
pending remains a workflow decision; approval is not self-review.

Submitting a proposal does **not** itself modify accepted content; manual or
trusted automatic acceptance applies the change atomically. While pending, the contributor
sees a clearly marked "Pending approval" preview; the reviewer sees before and
after. The submitted payload is fixed; correcting it requires cancellation and
a new request. A separately authored source item can remain on the contributor's
own timeline, without giving recipients access to that timeline.

### Review outcomes

| Status | Effect |
| --- | --- |
| Pending | Await a decision; only a proposal preview differs from accepted content. |
| Accepted | Apply the approved change/addition and record its provenance atomically. |
| Declined | Close without applying. Show a quiet "not added" result, not a rejection notification. |
| Cancelled | Close an unaccepted proposal and remove its preview/queue entry; accepted content is unchanged. |
| Outdated | Close without applying because its target/version is no longer valid. A new proposal is required. |

Accepted contributions cannot be undone by cancelling their original proposal.
Corrections use new changes/proposals under the actor's role. A separate right
or workflow to withdraw accepted material remains reopened, as described above.

Cancellation is allowed while pending. If acceptance, including auto-accept,
wins a simultaneous race, cancellation cannot roll it back. The database must
serialize the decision and return the actual outcome.

### Trust and clearing a contributor's backlog

The **timeline owner manages auto-accept trust for each contributor on that
timeline**. Co-authors may manually approve or decline authorized proposals,
but do not independently configure trust. Project bulk controls act on these
timeline settings only where the acting owner has authority.
Validation, audience permissions, expected versions, and audit history still
apply. A contributor's own private additions need no inclusion approval.
The owner's "Always accept contributions from this person" action enables
automatic acceptance of that contributor's new shared additions and proposed
edits/replacements on the timelines explicitly included in that action.

Offer an explicit option alongside that action to **also accept all eligible
pending proposals from this person across the project**. Enabling future trust
alone does not silently accept the backlog. The optional bulk action covers
pending proposals across authorized project timelines, not only the currently
displayed page. It does not include unrelated timelines or override another
owner's settings. Show the action's exact scope and any mixed trust settings.

Trust and bulk acceptance do not grant content access or bypass author audience
permissions, private-item protection, validation, expected versions, or the
no-self-approval rule. Recheck the owner's authority, applicable trust, and each
proposal's state when applying acceptance. Each proposal resolves atomically
against concurrent approval, decline, or cancellation; the first valid committed
decision wins. One accepted proposal may make another proposal against the same
item version outdated.

The bulk result must distinguish accepted proposals from outdated, already
resolved, or otherwise unapplied proposals without exposing restricted context.
Do not claim the entire backlog was accepted if some proposals could not be
applied. Detailed batch confirmation, progress, and failure/retry UX still need
design. Accepted contributions remain accepted if trust is later disabled.

Ending a share does not silently discard pending submissions. The reviewer may
resolve the submitted payload with restricted review context; the contributor
does not regain live access. No later content is fetched from the former
relationship and no relationship is reactivated. Exact UI/read access for an
unshared contributor's retained proposals remains to be designed.

## 4. Transfer and the sender's archive

### Whole-timeline handover and prerequisites

Changing the owner is a formal transfer even when the former owner remains a
Contributor or Co-Author. Delegating content leadership and proposal review
without changing ownership uses the Co-Author role. Delegated administration
without ownership has not been added.

Transfer covers the timeline and all its events, not an item-selection or
standalone event-transfer workflow. Private content remains subject to explicit
authorization: neither timeline ownership nor transfer reveals another creator's
private layers. The sender can authorize their own private material; another
creator's material needs that creator's permission. Recipient-owned private
additions remain theirs. Private exclusions must not be used to leak content
through notes, metadata, history, or media.

Before handover completes:

1. Resolve all pending proposals affecting the transferring timeline. They may
   be accepted, declined, cancelled, or outdated as appropriate; clearing the
   queue does not mean accepting everything.
2. The recipient explicitly confirms which existing collaborators and roles
   carry over, including any continuing role for the sender. Unconfirmed access
   does not carry over. Access can therefore begin at handover, not only through
   a new share afterward.
3. Confirm the shared-event connection policy below and prepare the authorized
   frozen archive and retained media.
4. Commit ownership, confirmed access, event-connection state, and archive
   atomically. Recheck versions and the absence of pending proposals; new
   submissions or edits must not slip in after confirmation and invalidate it.
   The exact short-lived transfer gate/reconfirmation workflow needs design.

The sender loses ownership and any live access not explicitly confirmed.
Role confirmation does not silently authorize private content or widen another
author's audience. Project ownership and the disposition of mixed-owner project
containers remain separate from this timeline transfer.

### Frozen archive at every transfer

Automatically create a read-only archive for the sender at every transfer,
including when they stay as a Contributor or Co-Author. Freeze it immediately:
no pending reviews cross the transfer boundary, and no later live changes flow
back. This supersedes settling-review archives, captured-review locks, and
live/archive proposal propagation.

Keep the archive in a separate Archives area, not mixed into the active timeline.
It records authorized pre-transfer content, including the sender's own private
material not passed on. It does not acquire another creator's private work
without permission. Retain its media independently of live deletion/replacement.
Archive contents are not necessarily identical to recipient-visible contents.

A former owner who stays as an authorized Co-Author can compare the handover
snapshot with the current live timeline to spot changes. Comparison never grants
access to later private/restricted material and is not automatic restoration or
rollback. The detailed comparison UI remains to be designed.

### Events also placed on retained timelines

A birth shared between parent/child timelines, a trip on partners' timelines,
or a fictional event on several character timelines must not disappear from a
retained timeline because another placement is transferred.
Transfer offers one timeline-level connection policy for affected events, not
an event-by-event review. Events found only on the transferring timeline simply
transfer. A continuing collaborator role alone does not authorize synchronization.

| State | Meaning |
| --- | --- |
| Connected | Authorized placements use one live event under mutually agreed access/editing rules; shared-fact updates reach those placements. |
| Paused connection | Each side retains its authorized handover version; changes do not flow, but common event identity and the common handover version are retained for possible reconciliation. |
| Made independent | An explicit separation. Versions evolve independently with no automatic reconnect in MVP. |

If continued collaboration/connection is not authorized, **pause rather than
irreversibly split by default**. A new recipient need not understand or resolve
every shared event just to accept a timeline. Explain that changes will not
update the other person's timelines unless both agree to reconnect.
Making events independent is a separate explicit choice, not a consequence of
declining editing rights. It has no automatic undo; permanent impossibility of
future reconciliation is not claimed.

Later, offering collaboration can include a separate "Reconnect shared events"
action with both sides' authorization:

- Neither side changed: reconnect without choosing between different content.
- One side changed: show the proposed update for confirmation.
- Both sides changed: preserve both and require reconciliation before reconnecting.

Unresolved events can stay paused while others reconnect. Private additions and
new audiences must not leak through comparison or reconnection. Neither timeline
owner automatically controls the other's placement or can delete the event
everywhere. Later loss of collaboration needs an explicit disconnect workflow
that preserves independently retained history without granting ongoing access.

Reconciliation tooling may be deferred initially, but stable common identities,
authorized baseline versions, and paused-state provenance must be designed now.
Version/common-baseline tracking must remain correct if reconnection tooling is
introduced later. Exact multi-party/multiple-transfer rules remain open.
This limited transfer-continuity mechanism is distinct from ordinary unsharing,
which does not create copies for recipients without their own retained placement.

## 5. Flexible dates: facts, uncertainty, and placement

Event type and date shape are separate. Each event is either a moment or a span.
A Memory may be a moment or span; a Job does not require exact dates.

Each endpoint has its own precision, wording, approximation indicator, and
optional placement:

- Exact day, month, year, season, unknown, and custom wording are supported.
- A span's start and end can differ in precision: "September 2001-June 12, 2005."
- A span end is **specified**, **unknown**, or **ongoing**. No end date alone
  cannot mean "still happening."
- Store the authored civil components separately from calculated earliest/latest
  possible endpoint bounds. Bounds are uncertainty, not occupied duration.
- For a moment, calculate ordering from the earliest possible start. January 1
  for "sometime in 1994" is a layout anchor, never an invented occurrence date.
- Preserve the date label and show visible uncertainty cues, including uncertain
  span edges. Do not turn an uncertain moment into a year-long event.
- Unknown/unplaced wording remains unplaced; optional sequence orders it without
  manufacturing dates. Ordering multiple uncertain moves may need explicit
  user confirmation.

A later move may **suggest** a residence between moves. Ask the user to confirm
residence and any ambiguous order before creating a span. Jobs and schooling
use the same endpoint model; starting a later job/residence never silently ends
an earlier one, because concurrent jobs/homes and missing events are possible.

### Text-first date entry and explicit interpretation

Use one primary **When?** text field for a date or span, with a readable
interpretation shown underneath before saving. Parse a documented set of common
formats deterministically, not through AI or permissive platform date guessing.
Examples include "Spring 2021", "2/7/2007", and "March 2009 - Jan 2010".
The month-to-month example preserves month precision independently at each end;
it does not store invented first/last occurrence days.

Numeric date order cannot be inferred reliably from location, browser locale,
or the entry alone. Offer an optional explicit date-order preference in settings
or at the first ambiguous entry. Without that preference, ask whether "2/7/2007"
means 7 February or July 2, using month names in the interpretation. Provide an
explicit "Remember this date order" option rather than silently saving a guess.
An unambiguous ISO-style date such as "2007-02-07" means 7 February 2007.

**Never infer a century or apply a two-digit-year cutoff.** For "12.11.67",
resolve day/month order if necessary and require the user to specify the year
explicitly. Do not assume 1967 or 2067, particularly for historical fiction.
If the intended year is 67 CE, the user must be able to specify that explicitly
within the supported calendar model; a short year is not automatically modern.
Date-order preferences do not authorize century guessing.

Preserve the entered wording separately from its confirmed structured meaning.
Changing preferences never reinterprets saved dates. Keep a **Date options**
control for uncertainty, independent endpoint precision, unknown/ongoing ends,
and other cases not clearly expressed by shorthand. Seasonal interpretation
still follows the confirmed rules below, not an inferred hemisphere.

If parsing fails or remains ambiguous, explain the issue and let the user
clarify or explicitly retain unplaced wording. Never silently accept a guessed
date or present unplaced text as a successfully parsed date. Exact accepted
syntax, supported input languages, and early-year/era presentation remain to
be specified; this does not add fictional calendars or expand calendar limits.

### Seasonal wording and preference

User preference provides a default of northern or southern seasons, or no
preference. Optional country/region selection can suggest it for confirmation
during onboarding, with "Decide later." No precise GPS or silent IP lookup.

An endpoint preserves wording such as "Summer 1994" separately from its
confirmed interpretation, displayed with the interpreted month range.
An event's location alone does not determine whose summer was intended.
Users may override the suggested hemisphere or leave placement unresolved.
Changing preference, sharing, or transferring never recalculates saved dates.

The default convention uses the year in which the season starts. Northern
summer 1994 is June-August 1994; southern summer 1994 is December
1994-February 1995. Exact month/year limits and validated derived bounds must
agree in TypeScript and PostgreSQL.

Gregorian ordering can use integer days since a shared epoch. Fictional calendars
are deferred; their independent epochs are not automatically comparable.
Approximate ages must respect uncertain birth dates; no exact birth day is
invented and age is never stored.

### Birthday age markers on the timeline

When the timeline subject has a specified exact birthdate (day, month, and
full year), show birthday markers along the timeline's date line, marking each
new age in completed years. These are derived display markers, not automatically
created birthday events. Age is calculated from civil dates, not stored or
derived from elapsed milliseconds/browser time zones.

The primary age display is at birthdays, not a mandatory age label beside every
event. Where an event's age is displayed, show a single age only when the
available date information establishes it. Otherwise show the possible age
range when bounds are available; do not calculate a definitive age from an
uncertain event's earliest placement anchor. Unplaced dates do not supply a
calculable age. Do not invent a birthday for a partial or uncertain birthdate.

Only derive markers or ages from birthdate information the viewer is authorized
to see; hiding the birthdate must not leak it through age markers.
February 29 anniversary handling, marker density at different zoom levels,
pre-birth/post-death display, and labeling combined multi-person views remain
presentation/behavior decisions before implementation.

## 6. Event forms and topics

App-supplied default event types:
**Moment, Memory, Residence, Job, Schooling, Trip, Relationship, Other.**

Ask "What are you recording?" rather than requiring users to understand a
technical type. Moment and Memory are interchangeable entry points matching
users' mental models. They can share fields/capabilities, use different prompts,
and switch without loss of content or date meaning.

Types supply defaults, relevant fields, and prompts; they do not dictate
precision or prohibit spans. Users do not build custom event types in the MVP.
Detailed type-specific fields and screens will be supplied later.

Every event type and guided template must include an open-ended text field for
**additional details or memories**, alongside any structured fields. Users can
record their own wording without fitting it into type-specific prompts.
Changing an event's type or template must preserve this text. The field follows
the event's applicable visibility permissions; entering a personal recollection
does not automatically make it private.
Every event also has a required Title, separate from type and additional text,
with a maximum of 200 characters in the current contracts and structural draft.

Separately, optional multiple topics/categories organize and filter an event:
Work, Family, Travel, etc. Users can add these labels. For example, a Residence
can have Work and Family topics. Do not label both concepts "Category."
The SQL retains optional many-to-many topics; starter topic labels and final
wording remain to be confirmed.

Places are structured, with country/region/city/address hierarchy. Hierarchy
changes must reject cycles and preserve audience boundaries. Comparison queries
are deferred: overlapping uncertainty alone does not establish simultaneous
residence or a conflict. File imports land private until explicitly reviewed.

## 7. Persistence outline and companion SQL

The SQL uses a dedicated `timeline_draft` schema so it cannot be confused with
the running app's `public` tables. It assumes Supabase authentication tables and
roles exist. Schema-only validation may use synthetic equivalents in a separate
in-memory database; that is not provider acceptance.

The table map below describes the **existing SQL draft**, not a complete model
of the newly agreed collaboration rules. The draft's `project` is still an
organizational record; it has no complete timeline-role or author-audience
permission structures. Its required `contribution.reviewer_user_id` represents
the earlier single-reviewer design, not the shared queue. Those structures and
the project trust/transfer implications must be redesigned before implementation.
The SQL's item-level creator/editor IDs and whole before/after values do not
resolve jointly edited content or establish post-removal retention rights.
The timeline-local `event` and `event_person` structures do not implement explicit
placements of one event across timelines. Participant links must not be used as
implicit placements or sharing grants. A shared event identity and placement
model, including date/detail/link ownership and audience enforcement, still
need structural design.
The SQL also has no event-to-organizing-event relationship. Its note/media
attachments do not substitute for separately typed events or memories within a
Trip or Job.
Its `transfer_item`, `transfer_review`, and `settling_reviews` structures retain
the superseded selective-transfer/pending-review design. They must be redesigned
or removed, not treated as an alternative implementation of section 4.
Connected/paused/independent event continuity and reconciliation baselines are
missing too. Historical SQL comments do not override the revised product rules.

| Structure | Purpose |
| --- | --- |
| app_user, project, timeline | Auth-linked profile, optional folder, owner-controlled live timeline/archive. |
| timeline_item | Timeline-local identity, kind, creator, current editor, privacy, version, copy provenance. |
| person, event, note, media | Typed content for each item; content/link IDs cannot cross timeline scopes. |
| date_endpoint | Authored civil components/wording and per-endpoint uncertainty bounds. |
| place, topic, event_topic, event_person | Structured location, optional labels, participant links. |
| share_access, share_exclusion, share_private_authorization | Per-recipient live roles, exclusions, and explicit authorization for existing private items. |
| review_trust | Historical reviewer-specific trust; revised trust is owner-managed per timeline. |
| contribution | Stable typed proposals, target/version, submitted snapshot, status and decision metadata. |
| ownership_transfer, transfer_item, transfer_review | Historical transfer structures; selective transfer and captured pending-review bookkeeping are superseded. |
| change_log, mutation_receipt | Private revision audit and replay-safe mutation results. |
| media_asset | Private immutable storage-object identity and readiness; retained references protect snapshots. |
| notification | Content-free in-app activity; pending count is a query, not stored. |

Constraints enforce many shapes and same-timeline foreign keys. They do **not**
implement reviewer derivation, media retention, consent, endpoint-bound
calculation, transfer preconditions, ownership changes, or audience rules. These are
mandatory database-function/policy requirements before any access is granted.
Transfer item/review mappings intentionally cross timelines: their source,
recipient, and archive scope must be checked by the transfer RPC. The draft does
not claim those cross-timeline links are protected by composite foreign keys.
Archive retention selection is explicit and separate from recipient inclusion;
private authorization for those two destinations is recorded separately.
The SQL enables and forces RLS with **no application policies or grants**:
fail-closed scaffolding, not completed security.

## 8. Required transactional and privacy implementation

- Authenticated identity comes from the server/provider, never submitted owner
  or reviewer IDs. Derive authorization and eligible reviewers using authoritative rows.
- Enforce timeline roles together with author-approved audience access. A co-author
  can directly edit authorized shared work, not private or unapproved hidden work.
  Recheck role/access and proposal state atomically when deciding a proposal;
  membership alone is not sufficient permission. Preserve original attribution.
- On collaborator removal, revoke the affected live grant. Do not promise
  authorship-only retention/export or withdrawal while those decisions remain
  open; do not expose others' work through snapshots, diff context, or media.
- RLS must protect accepted content, private layers, Person/place metadata,
  proposal previews, before/after audit data, notifications, and archive assets.
- Private visibility requires explicit per-item/per-recipient authorization;
  "everything" never authorizes future private items or another creator's
  private content implicitly. Contributor-owned private items must not leak
  through owner queries, review queues, notifications, or transfer archives.
- Allow only validated transactional RPC writes, not direct browser table writes.
  Lock/version-check targets and share state; prevent author/owner/version forgery.
- Apply review result, content update, links, version increment, log, and
  notifications atomically. No pending review may carry through transfer.
- Use actor-scoped stable request IDs, payload fingerprints, and durable
  acknowledged results. Replays return the prior result; changed content cannot
  reuse a request identity. Stale versions preserve user work.
- Transfer changes ownership/access only after pending proposals are resolved,
  recipient-confirmed grants, connection policy, and authorized frozen archive
  content/asset retention are ready. Upload steps may be staged, but the visible
  handover is atomic; failure must not produce a half-transferred account.
- Media references are private storage keys, not public URLs or cached signed
  links. Immutable blobs and separately authorized retained references prevent
  replacement/deletion from invalidating an archive.
- Preserve server-only credentials, private/no-store responses, and explicit
  browser-draft versus pending-proposal versus cloud-accepted states.

Notifications remain in-app and content-free: only permitted "who did what"
metadata. Notify reviewers of new requests and contributors of acceptance.
No decline/cancel/outdated notification. Avoid names/actors that would leak an
excluded item or revoked/private context. Email/push/preferences are deferred.

## 9. Fresh start and deferred legacy

Current database content and browser drafts are disposable test data. A fresh
database is authorized as an implementation approach; **these documents execute
no reset/deletion**, and exact target/reset steps need separate execution.
Do not guess event types from old categories.

Once production-hosted testers exist, upgrades must preserve browser drafts and
recover uncertain saves explicitly. No silent replay into a new schema, loss of
pending work, or cross-account leakage.

Legacy access/transfer is deferred. Future intent: designate a recipient and
authorize whether owned private content is included when legacy activates.
Do not transfer credentials or another creator's private material.
Account-wide inventory/transfer, activation authority, recipient confirmation,
and archive handling remain separate future decisions. No active legacy grant,
trigger, or partial account-transfer implementation is included in the SQL.

## 10. Open details before implementation

These are intentionally not silently filled in by the SQL:

1. Type-specific forms/prompts, starter topics, sharing/transfer confirmation UX.
2. Project-container administration, including mixed-owner projects, who may
   add/remove timelines, and project-owner succession. Timeline roles and access
   persist through project moves. Define future-grant activation and bulk-action
   scope/confirmation without overriding any timeline owner's authority.
3. Audience-permission lifecycle: what an approval covers for future contributions,
   how later revocation works for accepted and jointly edited content, and how
   owner exclusions interact with author permissions without widening access.
   Specify role changes, including promotion from Contributor to Co-Author, which
   changes editing rights even when the person could already view the material.
   Post-removal retention/export and contribution withdrawal are reopened,
   including jointly edited material, contractual boundaries, and the candidate
   departure-notification workflow. No automatic retention entitlement is settled.
4. Shared review lifecycle: eligibility changes while pending, contributors' edits
   to their own accepted contributions, and what happens if no authorized reviewer
   remains. Define confirmation, progress, and failure/retry UX for the optional
   authorized project-wide acceptance of a trusted contributor's backlog.
   Timeline-owner-managed trust and approval/decline by any authorized owner/co-author are settled;
   neither bypasses another author's audience permissions.
5. External onward/audience permissions and any interaction between role grants
   and private-item editing authority. Timeline co-authorship is not a right to
   view or edit another author's unapproved private content.
6. Detailed transfer gating, concurrent edits/submissions, private-content
   boundaries, and repeated/multi-party transfers. Recipient confirmation of
   collaborator roles and resolution of all pending proposals before handover
   are settled. Archives freeze immediately; no captured review queue carries over.
7. Birth-date edits/account-link consent presentation and retaining another
   creator's private content with explicit permission.
8. Retained pending proposals when an individual item is hidden, and what the
   former recipient can see after unsharing without regaining live access.
   Recovery/access to a contributor's own private additions after unsharing
   also needs an explicit workflow; no copy-on-unshare behavior is assumed.
9. Revised timeline-role/audience/shared-queue structures, project bulk/future
   grant structures, and actual
   validated payload contracts, derived date calculation, versioned RPCs,
   RLS/storage policies, archive freeze rules, and focused concurrency tests.
10. Multi-timeline event identity/placement structures, permission-aware audience
    expansion, and private note/media boundaries. Define ownership and behavior
    for conflicting timeline roles, removal of the final placement, and
    cross-account event editing authority. Connected/paused/independent transfer
    states are agreed; durable identities/baselines, safe reconnection, later
    disconnection, and multiple-party behavior still need detailed design.
11. Organizing-event/entry structures and workflows: hierarchy depth and cycle
    prevention, ordering and expanded/collapsed display without duplicate entries,
    parent/entry audience boundaries, and move/removal/transfer behavior.
    Organizing related entries is MVP scope; general-purpose event linking is not.

## Superseded v2 rules

- Authorship alone no longer determines ownership/editing authority after transfer.
- Ordinary unsharing does not create independent recipient copies.
- Cancellation applies only to pending proposals; withdrawal of accepted content
  is reopened rather than an established entitlement or absolute prohibition.
- Person account linking does not change the reviewer.
- Single event-level precision is replaced by independent endpoint descriptions.
- Place does not automatically determine seasonal interpretation.
- Event type is not a replacement for optional multi-topic categorization.
- Legacy functionality is deferred rather than represented as an active grant.

## Superseded earlier v3 rules

- Project-wide roles are replaced by timeline-level roles with project bulk
  controls and explicit future-timeline grants.
- Co-authorship does not require a project; eligible owner/co-author review is
  based on timeline authority, not original item authorship.
- Post-removal authorship-only retention/export is not a settled guarantee.
- Item-by-item transfer selection and pending-review carryover are replaced by
  whole-timeline handover with no pending proposals, recipient-confirmed access,
  and a frozen archive at every transfer.
- No editing grant does not imply irreversible shared-event separation:
  affected retained placements pause by default unless connection is authorized
  or independence is explicitly chosen.
