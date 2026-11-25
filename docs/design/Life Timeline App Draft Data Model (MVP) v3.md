# Life Timeline App: Revised Draft Data Model (MVP)

Draft v3, November 6, 2026; updated November 25, 2026

Companion: [timeline_schema_v3.sql](timeline_schema_v3.sql).
Previous proposal: [Draft v2](Life%20Timeline%20App%20Draft%20Data%20Model%20%28MVP%29.md).
Supporting reference: [Workflow inventory](workflow-inventory.md).
Tracked work: [GitHub Issues](https://github.com/Audryn/timeline/issues).

## Status and scope

This document consolidates the agreed product direction. The companion SQL is
a **structural design draft**, not a migration, runnable application backend,
or completed authorization implementation. It deliberately grants no application
access. The November 23 structural revision replaces the historical single-
reviewer, timeline-local event, selective-transfer, and settling-review design.
It models timeline roles, explicit placements, multiple containing events,
owner-specific accepted versions, revisioned proposals, consent, private
transfer/archive authorization, frozen copies, and recovery bookkeeping.
Table shapes and foreign keys are not completed workflows or authorization.
Transactional role/creator checks, acyclic graph writes, proposal/consent
decisions, routing, transfer completion, snapshot freezing, and purge still need
implemented functions and tests before any application access can be enabled.
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
sharing. Role-directed updates between events already in common after transfer
are the limited cross-account mechanism described in section 4, not a general
offline synchronization engine.
Story plotting, BCE dates, fictional calendars, comparisons, and legacy activation remain
outside this implementation slice. The app remains online-first with recoverable
browser drafts, not an offline replica or a custom two-way sync engine.

### Possible future extensions

Historical timelines could use the same chronological bands, spans, markers,
containing-event context, and tags. Non-person subjects such as a city, organization, or
historical period, and user-defined event types are possible future extensions,
not additions to the MVP or changes to its primary personal/character-history
purpose. The MVP still has one Person/character subject and app-defined types.

Custom types could initially reuse common event fields without requiring a
custom form-builder; exact capabilities remain to be decided. Subject
generalization should not implicitly alter ownership or collaborator rules.
Future date support must be able to accommodate BCE and fictional calendars;
readiness requirements are recorded in section 5 without enabling those inputs.

### Decision and workflow tracking

This document is the canonical source of product rules. GitHub Issues track
unresolved decisions and implementation separately: design decisions #1-#14,
implementation #15-#25, and deferred capabilities #26-#31, categorized with
`design-decision`, `implementation`, and `future` labels. Closing a decision
issue means the decision is documented, not that the feature is implemented.
Resolve relevant design prerequisites before implementing and verifying behavior.

The linked workflow inventory enumerates planned user flows W01-W49, including
cross-cutting save, conflict, recovery, and access-change paths. It is a
supporting checklist, not a separate authority or a claim of implemented behavior.
The historical-subject, custom-type, and BCE-readiness ideas were discussed after
the initial issue list was created; no separate issues for those additions have
yet been created.

### Account creation or trying it first

Onboarding offers **Create account** or **Try it first**. Guest users can start
their own local timeline content without an account. On web, guest work is
stored in browser-local draft storage; a future native iOS client uses
app-private local storage instead. This is a trial/draft workspace, not a
cloud account, full offline replica, or two-way synchronization system.

Clearly distinguish **Stored in this browser/on this device** from
**Saved to your account**. Browser-data clearing or app removal can lose local
work; native backup behavior still requires an explicit privacy policy.
Preserve guest work through signup, verification, interrupted navigation, and
failed or uncertain uploads. Saving it to an account requires explicit review
and confirmation of the destination account, especially on shared devices.
Only server acknowledgment marks it account-saved. Use idempotent uploads and
retain recoverable local work until acknowledgment; never silently replay it
into whichever account next signs in.

Guest storage must be separate from authenticated account-scoped drafts.
Guest trial boundaries, local recovery/import screens, native storage/backup
details, and import contracts remain to be specified. The current app and
structural SQL do not implement guest mode.

## 1. Identity, ownership, and provenance

- `app_user.id` is the Supabase `auth.users.id`, not a separately generated
  application identity. Email is optional; phone-only accounts are supported.
  Credentials and sessions never become transferable application data.
- A Person is a subject described in a timeline, not automatically a user.
  Linking a Person to an account requires that account's consent. Linking alone
  grants no access, transfers no ownership, and changes no review authority.
  The timeline owner can separately invite that account at a timeline role.
  Being named in an event does not grant access to that event either.
- Each project has exactly one owner; each timeline has exactly one owner.
  A project may contain timelines owned by different users. Co-authorship is
  not joint ownership. The proposed timeline has one Person/character subject;
  group or relationship subjects such as "Our team" or "Our marriage" are not
  included in the MVP. Future non-person subjects are discussed under scope.
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
  authorized, accepted shared-fact edits update every placement. Person involvement alone creates no
  placement or audience permission. Ordinary sharing exposes permitted content
  to authorized users, not unrelated timelines or private layers.
- After ownership separates, events in common retain stable provenance and
  owner-specific accepted versions. Updates follow destination timeline roles,
  not an unconditional live link. Archives remain frozen copies. Place/topic
  data must also remain independent where an archive or transfer requires it.

### One event on multiple timelines (MVP)

#### Flexible creation entry points

Creation can begin with a Person, timeline, or event:

- **Create Person -> Create timeline for this Person.** A Person can exist
  before a timeline; account linkage or invitation is not required.
- **Create timeline -> Select an existing Person or create one.** A completed
  MVP timeline still requires exactly one Person/character subject.
- **Create event -> Choose an existing timeline or create one**, selecting
  or creating its subject as needed. Preserve the event draft through these
  steps. Do not create an invisible accepted event without a placement.

Use one event editor from onboarding/guest trial, a timeline's **Add event**,
a saved event's **Add sub-event**, or a global **Add event** menu command.
The current timeline is initially selected when entering from that timeline.
From a saved event, initialize its containing-event relationship and suggest
involved people for confirmation, without inheriting privacy or additional
timeline placements. Other entry paths prompt for placement before completion.
Context supplies defaults, not permission; all paths retain the same explicit
visibility/placement choices, date interpretation, and role-dependent
direct-save/proposal behavior. Guest content remains locally stored, and
authenticated content becomes account-saved only after server acknowledgment.

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
any expansion needs explicit confirmation and applicable creator/joint-edit
consent. Ordinary private placement never grants access to other collaborators.
Confirmation cannot substitute for authority the user does not have.

Deduplicate timeline placements in a combined view. An intentional appearance in
both its type band and its containing event's detail view is not a duplicate event record.
Authorized, accepted shared-fact edits affect
every placement; removing one placement does not delete the event from the
others. Placement does not transfer ownership or independently grant editing
rights. The UI must distinguish removing a placement from deleting the event.

While these timelines share an owner, an Owner's or authorized Co-Author's
accepted edit updates the event on all that owner's placements. Contributor
changes do so only after approval or owner-configured auto-approval. Each
placement is not a separately approvable copy until ownership separates.
If a collaborator is a Co-Author on one placement's timeline but a Reviewer or
has no access on another timeline owned by that same owner, an edit authorized
through the first timeline still updates the owner's one accepted event on all
placements. An accepted/auto-approved Contributor proposal has the same effect.
The owner's delegation or approval makes it part of the owner's accepted version;
the other placement is not a separate approval boundary. This does not grant
the collaborator access to that other timeline, its private items, or its
metadata. Explain the shared-event effect when assigning roles or placements.

Personal recollections, medical details, notes, and attachments are not
automatically exposed through another placement. A child's birth appearing on
their timeline must not reveal a parent's private childbirth account.
The structural draft separates event identity from placements; audience checks
and private-detail boundaries must be implemented and tested before enabling
this feature. Cross-account event
placement is not generally offered. Updates between owner-specific versions of
events already placed on retained timelines at transfer follow section 4.

### Organizing events and their entries (MVP)

Use **containing event** and **sub-event** for the organizing relationship,
not parent/child event. An event can be a sub-event of several containing
events and can itself contain sub-events. These terms imply neither ownership,
inherited access, nor automatic date containment. A note attached to an event
is still a note, not a sub-event.

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
Its detail view shows permitted immediate sub-events, not a flattened list of all
nested entries. Open a sub-event to explore its own sub-events. For example, India Trip
can organize Bangalore Visit, which organizes Wedding, which organizes Wedding
Memories. Open text elaborates on the organizing event itself; a contained
Memory is a separate entry. Standalone events need no containing event.

An event can have **multiple containing events**, while remaining one event
with one type and its own placements and visibility. A Wedding can appear under
both India Trip and Relationship; removing either containment link leaves the other
intact. This is a directed acyclic graph, not a strict tree. Reject any link
that would make an event contain itself through any path.

There is **no user-facing nesting-depth limit** for MVP. Keep navigation shallow
instead: show immediate sub-events and navigate into one, rather than endlessly
indent an expanding tree. Back follows the route actually taken; a compact
navigation trail provides context, and an **Also part of...** list can expose other
authorized containing events. There is no single universal breadcrumb for an
event with multiple containers. Hidden containing events, sub-events, links,
and counts must not leak.

#### Chronological bands, containing-event context, and tags

Display content chronologically in distinct bands by event type, so employment,
education, relationships, and other types can be viewed alongside one another.
Each event has exactly one type, determining its band. An organizing event is
not a separate type: any suitable event can provide context for related entries.
A containing event's sub-events can have different types. The same Relationship event can
appear inside a Trip's detail view and independently in the Relationship band,
without bringing the Trip or its siblings into that band. Both presentations
refer to the same accepted event, under the existing permission/version rules.

Chronological overlap and explicit containment links are separate. A Trip span,
shorter Bangalore span, and dated Wedding marker can be displayed simultaneously
at their actual dates without needing containment links to produce visual nesting.
They can also be explicitly linked as containing event and sub-event. Overlap
alone creates no relationship. Do not copy a containing event's dates into a
sub-event or infer a duration.

Multiple optional topics/categories (possibly labeled tags) filter across types
and containing-event groups. Filtering by "India 2001" can show a wedding, a job offer,
and individual memories alone, in the chronological/type-band presentation.
A shared tag neither creates a containment link nor grants access to hidden content.
Final category/tag wording remains open.

Indicate permitted undated sub-event memories with an icon adjacent to the containing
event's title, whether that event is shown as a dated marker, within a date span,
or without a date span. The icon opens those memories through the containing event's
immediate-sub-event view without assigning them a position on the chronological axis.
Do not reveal inaccessible memories through the icon.
Undated memories
without a containing event appear in a clearly identified undated group in the Memories
band, visually separate from dated content with no adjacent date scale implying
when they occurred. Neither case fabricates a date. The containing-event title icon
resolves display of contained undated memories without a separate dated marker.

This is a narrow organizing relationship, not general-purpose event linking.
A job change and a residence change can be entered separately without an
explicit link between them. Arbitrary event-to-event relationships are outside
MVP scope. Organizing an entry is also distinct from placing one event on
multiple subjects' timelines; neither relationship implies the other.

#### People, placement, and visibility

When adding a sub-event, suggest the containing event's involved people for the
user to confirm; do not automatically inherit them. Later changes to that event's
people do not silently change the sub-event. Keep people involved, explicit timeline
placements, and private/non-private visibility separate.

For example, Mom can add a non-private memory to a shared Wedding while placing
the memory only on her own timeline. Neither the containment link nor non-private
status distributes that memory to the Wedding's other timeline placements.
Containment does not grant visibility, transfer ownership, or automatically
share private memories. Parent/entry visibility and derived counts must respect
audience boundaries, including hidden titles and links.

#### Removal, transfer, and historical relationships

Deleting an organizing event offers preservation of its sub-events or removal of
associated entries. Show an authorized selectable view of nested entries, with
individual include/exclude choices and select-all/clear-all shortcuts. Preview
the affected entries and placements before confirmation. For affected events
placed on multiple timelines owned by the user, let the user choose this
timeline only or all their timelines; distinguish placement removal from event
deletion. Other owners' accepted versions and frozen archives are unaffected.
Show each affected event only once even if reachable through several containers.
Preserve sub-events with multiple containers by default when deleting an organizer.
If explicitly selected for deletion, warn about their other authorized containing-event
contexts, including organizers outside the selection, without revealing hidden
relationships. Selection does not bypass joint-edit consent.

Distinguish removing a containment link, removing a timeline placement, and deleting
the event itself. A preserved sub-event loses only the removed containing-event
context; it keeps other valid containment links, or becomes independent there
if none remain. Do not silently delete it or assign a new container. Removing
only one placement must not break the retained structure on other timelines.
Removing the last placement prompts for explicit confirmation of deletion into
recoverable Trash; do not silently create an invisible unplaced event.
Placement removal that would deprive eligible joint editors of access follows
the same consent process as privatization/deletion, rather than bypassing it.

Deleted content remains recoverable in **Trash for 30 days**. Offer a distinct
**Delete permanently** action with explicit confirmation and applicable joint-edit
consent. This affects the deleting owner's content, not other owners' versions
or frozen archives. Retain deleted attachments only as needed for recovery or
independently authorized retained copies.

Restore content and placements separately. Recovery does not automatically
reactivate old collaborator access, containment links, or placements that expand the
audience. Recheck current permissions, versions, and structure. Retain minimal
deletion/removal history so stale saves and incoming updates cannot resurrect
deliberately removed content. Exact Trash, expiry, permanent-deletion, and undo
mechanics still need implementation design.

Whole-timeline transfer follows explicit placements, not an organizer's nested
entries. Transfer entries placed on the transferred timeline, subject to existing
private-content rules. Preserve containment links among included entries. A memory
placed only on Mom's retained timeline does not transfer merely because its
containing Wedding is on the child's transferred timeline. If the Wedding transfers
without its containing Bangalore event, show it independently; do not copy Bangalore or
grant access to it implicitly.

Retain an inactive historical relationship to support possible reconciliation,
not an invisible active connection. Restoration requires explicit action and
fresh permission, version/conflict, and structural checks; history grants no
access or ownership and must not expose an inaccessible containing event's metadata.
Transfer preserves active links only where both endpoints are included and
authorized. Restoring one historical link does not reactivate every former
containment relationship.
A retained link alone does not preserve deleted event content. The recovery
window is 30 days as above; detailed restore/undo workflows still need design.
Multiple containing events, no user-facing depth limit, and cycle rejection are settled.
Precise ordering/navigation controls, transactional cycle-check implementation,
and dates outside a containing event's span still need specification.

## 2. Sharing is live access, not ownership

### Timeline sharing

Sharing grants a timeline role from the table below. Transfer Ownership is a
separate whole-timeline handover, not a sharing role or an event-by-event action.
Collaborators is the umbrella term for owners/authors, co-authors, contributors,
and read-only reviewers.

Each share belongs to a specific recipient with a timeline role. The timeline
owner's grant covers **all non-private content on that timeline**, including
current and future accepted contributions from every author and approved updates.
Authors do not separately approve new collaborators, restrict particular
collaborators' access to shared items, or set per-author suggestion permissions.
There are no per-recipient exclusions for non-private items under this rule.
This replaces the earlier selective non-private sharing and author-audience model.

Private items are **creator-only in ordinary MVP use**, for both viewing and
editing. There is no general per-item private-sharing or private-editing grant
feature. To collaborate on live content, the creator can make it non-private,
subject to the joint-edit consent rules. Transfer/archive inclusion is the
narrow exception described in section 4, not ordinary private-item sharing.
Role grants never reveal private content or grant editing of it.
Item, attachment, Person, place, search, count, history, and notification queries
must preserve these boundaries; authorization is not just a UI filter.

Timeline ownership does not transfer creator-controlled privacy authority.
A transfer recipient explicitly authorized to receive private material gets
read access only: it remains private, is not visible to other collaborators, and
cannot be edited or have its privacy controlled by that recipient. Frozen-copy
inclusion is a separate authorization for enduring read-only retention.
Timeline ownership, a Contributor role, co-authorship, and account linking do
not by themselves reveal another creator's private layers.

Contributors may keep their own private additions on the shared timeline and
edit those additions directly. The timeline owner and other recipients cannot
see them in ordinary use. These are private
items, not proposals waiting for the timeline owner to approve. Submitting
changes to someone else's content still requires review; the proposal is visible
to its authorized reviewer.

The owner can revoke a timeline share. Shared-item visibility cannot be narrowed
per recipient; private-item creator boundaries remain separately protected.
**Unsharing removes live viewing/contribution access and creates no automatic
timeline copy.** Creators retain their own private additions, and the Owner may
explicitly grant a frozen snapshot as described below.
It cannot erase previous downloads, independent copies, or archives.
This supersedes v2's copy-on-disconnect rule for ordinary sharing.

Collaborators cannot invite others merely by being Co-Authors, Contributors, or
Reviewers. The timeline owner can add collaborators to all non-private timeline
content without fresh approval from its authors. This grants app access, not
legal ownership of their work. Export and external distribution follow the
trust and legal-scope rules below; transfers remain a separate workflow.

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
timeline ownership or private-item protection.

### Project entry, exit, and owner succession

Adding another owner's timeline requires agreement from both the project owner
and timeline owner. Either can remove that timeline from the project. Removing
it changes organization only, not ownership, collaborator grants, trust,
archives/snapshots, or event-in-common update relationships. It does not delete
the timeline. Project ownership alone grants no content access.

At timeline transfer, the new owner can keep it in the existing project or
remove it; continuing collaborator access is decided separately. A project may
therefore remain mixed-owner after a timeline transfer.

Transferring the project itself requires the recipient's explicit acceptance.
Notify the owners of contained timelines; they need not approve continued
placement under the new project owner and retain their right to remove them.
All timeline ownership and explicit collaborator grants remain unchanged.
The former project owner retains no project-management role, but keeps authority
over their separately owned timelines and any explicit collaborator roles.

Disable future-timeline grant defaults on project handover until the new project
owner and any affected timeline owners freshly authorize the applicable grants.
Project succession never silently transfers contained timelines or widens access.
Detailed invitation/confirmation and project-metadata visibility still need design.

Authorship attribution and timeline ownership remain distinct. A co-author's
direct edits must still use version checks and revision history; "no approval"
does not permit silent overwrites of concurrent changes.

### Timeline audience and private items

A new collaborator's role applies to all non-private timeline content immediately
when their access becomes active. No author-consent queue or partially activated
role is needed for shared contributions. Explain when contributing that shared
work is visible to current and future collaborators chosen by the timeline owner.

Co-Authors can directly edit non-private content and resolve eligible proposals;
Contributors can propose changes; Reviewers only read. No author-specific switch
can elevate or reduce those role capabilities on non-private items.
Private items remain outside that shared audience. Explicit transfer/archive
inclusion does not convert an item to shared or grant private editing rights.

This simplification does not expose pending proposals, private revision history,
or private attachments to every reader. Review queues and before/after context
still require appropriate review authority and private-content checks.
Authorship attribution remains intact. Privacy changes, deletion consent,
retention, and export follow the rules below, not ordinary edit approval.

### Event-attached notes

Provide an explicit **Add note** action on an existing event. A note is separate
content, not a new event type, a Memory event, or an edit to the event's details.
An event can have multiple notes, including multiple notes by the same author.
Each note has independent authorship and visibility; adding one does not replace
existing notes.
It has its own author and a visibility choice: **Only me** or **Timeline
collaborators**. Examples include "Look up this address" or a clarification
about moving between two residences during a period.

Owner/Co-Author notes can be added without editing the associated event. A
Contributor's shared addition follows the proposal rules; a creator-only
private note or event is added and edited directly, without Owner approval.
Private notes are hidden even from the timeline Owner in ordinary use; only
explicit transfer/archive inclusion creates the stated read-only exception.
Adding a note does not privatize the associated event or create an
entry in an event-type band. A shared note respects its timeline audience;
attachment alone does not distribute it to the associated event's other placements.
This lightweight event-note feature is required; proposal-linked discussion/chat
remains separately deferred. Detailed note forms and presentation need design.

### Creator-controlled privacy and jointly edited content

Privacy-status changes originate from the item's creator, even if the timeline
Owner previously approved that item. Approval does not transfer privacy control.
For example, Mom may add her own private Memory to Daughter's Birth event
without a proposal. Daughter owns the timeline, but cannot view that Memory
merely through ownership. The shared Birth event remains unchanged.

Making previously shared content private restricts future in-app access, not
prior exposure. Explain that collaborators may already have read, copied,
screenshotted, or exported it. The app cannot recall those copies, and this
expectation does not establish legal redistribution rights.

Privatizing or deleting jointly edited content requires a consent request to
every other eligible joint editor: current Co-Authors and current Contributors
with accepted authorship of the item (creation or edits), including subsequently
superseded edits.
Use accepted authorship history, not an attempt to measure whose words survive.
Pending proposals alone do not qualify. Current access and the eligible
role are required; removed collaborators and Reviewers have no consent/veto
right based solely on past authorship. This is a specific consent right for
Contributors, not general proposal-approval authority. The Owner or an authorized
Co-Author may initiate shared-content deletion; privacy changes still originate
only from the creator.

Each request identifies the exact item version, action, and affected placements.
Consent is not blanket permission for later edits. Material content changes
require a refreshed request and renewed consent. Recheck eligibility before
applying: removed collaborators/Reviewers no longer participate, and newly
eligible editors get a chance to respond. Descendant deletion gathers consent
per affected item, not one vague approval to delete everything.

Notify eligible editors and allow each to approve or decline. An explicit
decline notifies the Owner. Without an override, all required approvals must
be received before applying the request; existing visibility/content remains
unchanged while unresolved. Default nonresponse timeout is **three days**.
Only after that timeout, offer resend or explicit Owner override of a
nonresponse; never silently approve. The Owner may also explicitly override
a decline once received, so consent is a chance to
object, not a permanent veto. Record overrides and notify affected editors.
For privacy changes, Owner override resolves joint-edit consent only; the
request must still originate from the creator. It grants no access to another
creator's private material.

Removing an inactive collaborator's timeline access is a separate Owner action,
not an automatic consequence of nonresponse. Project removal does not revoke
timeline access. A future configurable timeout is deferred. Exact request/version
checks and resend/override UI still need implementation design.
These requests are distinct from ordinary proposals,
which any authorized Owner/Co-Author can approve without unanimity.

### Removal, retention, and withdrawal

The timeline owner can remove a collaborator, revoking the access that grant
provided. It does not erase another independently authorized timeline or archive.
Accepted shared work remains; departure does not automatically withdraw or
delete it. A removed collaborator cannot unilaterally retract jointly edited
work or retain approval/veto rights. Disputes outside these app permissions are
for participants to resolve outside the app.

A creator retains access to their own private events and notes after revocation,
and may export those retained private items. This does not retain the associated
event or surrounding timeline content. Carol's private note remains accessible
while Bob's event is no longer viewable. Parent links become inactive historical
relationships and must not reveal inaccessible titles, dates, media, or later
changes. Carol's own text remains her content even where it mentions the event.
The view for these orphaned private items is still to be designed.

Pending proposals remain in the Owner's queue after downgrade/removal; retention
of submitted work does not restore the submitter's access. Exact submitter-facing
access to retained proposals remains open.

At revocation, offer the Owner an explicit **Allow this person to keep a frozen
copy of the timeline? Yes / No** choice. Yes grants the authorized read-only
snapshot described in section 4; No creates no new timeline copy. Neither choice
removes the creator's retained private additions or recalls prior copies.
There is no automatic authorship-based entitlement to retain/export jointly
edited work or the timeline. Private-item retention, explicit snapshots, and
sender archives are specific exceptions, not rights acquired by making a small edit.

### Export, distribution trust, and legal scope

The live-timeline export command is available only to Owners and Co-Authors,
not Contributors or Reviewers. Export includes authorized non-private content
and may include the exporter's own private items. Exclude private content
belonging to other collaborators, even when the exporter has permission to view
it. Export authority does not grant otherwise missing content access.

Creators may export their retained private additions after losing timeline
access. Explicitly granted former-collaborator snapshots are read-only in-app,
with no export command. Detailed export formats and sender-archive export
behavior still need specification.

Trust to export implies trust to handle and distribute the content with the
required care; there is no separate in-app onward-sharing consent layer for
exports. This does not authorize inviting collaborators or transferring a
timeline, which remain Owner-controlled actions. Future public-link features
are not decided by this rule.

State alongside sharing/export permissions: **App permissions control access
and actions within Timeline. They do not establish or transfer copyright,
ownership of intellectual property, or other legal rights. Users are responsible
for ensuring they have the rights needed to use or distribute content.**
Legal rights, contracts, and external disputes are outside the app's scope.

## 3. Contributions, review, and trust

### Targets and reviewer

Proposals have a stable ID, recipient timeline, contributor, authorized review
audience, typed target, submitted payload, and base version where they change existing content.
Targets include Person, event, note, and media, not just events.

- Shared additions retain contributor attribution and enter the authorized
  timeline review queue. A contributor's own private
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
of people eligible to review. A reviewer who loses authority cannot decide
proposals under their former role; the Owner can still review pending work.
Approval is not self-review.

Submitting a proposal does **not** itself modify accepted content; manual or
trusted automatic acceptance applies the change atomically. While pending, the contributor
sees a clearly marked "Pending approval" preview; the reviewer sees before and
after. While pending, the Contributor may revise the same proposal repeatedly;
the queue shows its latest submitted version, not a new request for every edit.
Approval must match the proposal revision actually reviewed as well as any
accepted target's expected version. If the proposal changed, refresh before
deciding; never approve unseen replacement text. Serialize revision and decision:
if acceptance wins, later edits require a new proposal.

After acceptance, a Contributor's edits to their own accepted shared contribution
also follow the approval model, unless the Owner has enabled auto-approval.
Owner/Co-Author edits and private-item editing follow their established rules.
A separately authored source item can remain on the contributor's own timeline,
without giving recipients access to that timeline.

### Review outcomes

| Status | Effect |
| --- | --- |
| Pending | Await a decision; only a proposal preview differs from accepted content. |
| Accepted | Apply the approved change/addition and record its provenance atomically. |
| Declined | Close without applying. Show a quiet "not added" result, not a rejection notification. |
| Cancelled | Close an unaccepted proposal and remove its preview/queue entry; accepted content is unchanged. |
| Outdated | Close without applying because its target/version is no longer valid. A new proposal is required. |

Accepted contributions cannot be undone by cancelling their original proposal.
Corrections use new changes/proposals under the actor's role. Privatization,
deletion consent, and departure follow section 2; cancellation provides no
separate right to withdraw accepted jointly edited material.

Cancellation is allowed while pending. If acceptance, including auto-accept,
wins a simultaneous race, cancellation cannot roll it back. The database must
serialize the decision and return the actual outcome.

### Role changes and pending proposals

When the Owner promotes a Contributor to Co-Author, automatically approve and
apply that person's eligible pending proposals on that timeline. This acceptance
is authorized by the Owner's promotion, not self-approval by the new Co-Author.
Show that effect as part of the role change. Unlike enabling future auto-accept
trust alone, promotion includes the existing backlog.

Validation, private-content authority, current proposal revisions, expected
target versions, and concurrent-decision checks still apply. Do not silently
overwrite newer content or report blocked proposals as accepted. Conflicted or
otherwise blocked proposals remain unresolved for explicit handling, with the
reason surfaced to an authorized reviewer.

Downgrading or removing a collaborator does not discard their pending proposals.
The Owner can still approve or decline submitted work. The changed role controls
future actions; retained proposals neither restore the submitter's live access
nor allow a downgraded Co-Author to keep reviewing under their former role.

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
Only the Owner configures auto-approval; Co-Authors who tire of repeated reviews
cannot independently enable it. Future contribution-linked discussion notes/chat
may help reviewers consult, but are deferred and do not decide proposals.

Trust and bulk acceptance do not grant content access or bypass timeline
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

Ending a share does not silently discard pending submissions. The Owner may
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
additions remain theirs. For their own private material, offer **Exclude all**,
**Include all**, or **Choose specific items**. Another creator's material cannot
be selected on their behalf: it requires that creator's explicit authorization.
No creator response means no authorization to include their material.
Joint-edit nonresponse/decline overrides never substitute for this creator's
private-inclusion authorization.
Included transferred items remain private and creator-edited; the recipient
gets read access only, not editing/privacy authority, and other collaborators
gain no access. Future private items are not included automatically.
Private exclusions must not be used to leak content
through notes, metadata, history, or media.

Before handover completes:

1. Resolve all pending proposals affecting the transferring timeline. They may
   be accepted, declined, cancelled, or outdated as appropriate; clearing the
   queue does not mean accepting everything.
2. The recipient explicitly confirms which existing collaborators and roles
   carry over, including any continuing role for the sender. Unconfirmed access
   does not carry over. Access can therefore begin at handover, not only through
   a new share afterward.
3. Explain how confirmed roles govern updates to events in common, and prepare
   the authorized frozen archive and retained media. The recipient may keep the
   timeline in its current project or remove it without changing access.
4. Commit ownership, confirmed access, owner-specific event versions, and archive
   atomically. Recheck versions and the absence of pending proposals; new
   submissions or edits must not slip in after confirmation and invalidate it.
   The exact short-lived transfer gate/reconfirmation workflow needs design.

The sender loses ownership and any live access not explicitly confirmed.
Role confirmation covers non-private content, not implicit private-item access.
Project ownership and the disposition of mixed-owner project
containers remain separate from this timeline transfer. Confirmation concerns
current collaborators on this timeline, not everybody in the containing project.
Other project participants gain no access merely through project membership.

### Frozen archive at every transfer

Automatically create a read-only archive for the sender at every transfer,
including when they stay as a Contributor or Co-Author. Freeze it immediately:
no pending reviews cross the transfer boundary, and no later live changes flow
back. This supersedes settling-review archives, captured-review locks, and
live/archive proposal propagation.

Keep the archive in a separate Archives area, not mixed into the active timeline.
It records authorized pre-transfer content, including the sender's own private
material not passed on. It does not acquire another creator's private work
without explicit frozen-retention permission. For creator-owned private
inclusion, use the same exclude-all/include-all/choose-specific choices.
Transfer viewing authorization does not imply archive retention permission.
Retain its media independently of live deletion/replacement.
Archive contents are not necessarily identical to recipient-visible contents.

A former owner who stays as an authorized Co-Author can compare the handover
snapshot with the current live timeline to spot changes. Comparison never grants
access to later private/restricted material and is not automatic restoration or
rollback. The detailed comparison UI remains to be designed.

### Explicit snapshots for former collaborators

Co-Author/Contributor status does not automatically grant an archive on loss of
access. For example, Parent1 receives the sender archive when transferring a
child's timeline; Parent2 does not receive one merely from being a Co-Author.
Parent1 cannot bypass the child's removal of Parent2 by sharing that archive.

When the timeline Owner removes/does not continue a collaborator's live access, offer
a separate explicit choice to let that person retain a read-only snapshot.
Once the Owner confirms this grant, **snapshot retention is irrevocable**:
they cannot later rescind it. Explain permanence before confirmation.
The grant covers only the authorized content frozen at that point, excluding
private material without appropriate permission. It includes no later changes,
editing rights, or automatic onward-sharing/publication rights.
This is not blanket permission for the sender to share their archive with others.
Private inclusion uses the creator's exclude-all/include-all/choose-specific
authorization, not the timeline Owner's choice over another creator's items.
Frozen inclusion explicitly authorizes enduring read-only retention; a prior
live viewing permission is not sufficient.

The snapshot is read-only in-app, with no export command. Snapshot storage and
deletion mechanics still need design. The app must not
claim that copies already downloaded can be recalled, or infer legal reuse rights
from an app retention grant. A frozen snapshot never serves as a live event view.

### Events in common across ownership boundaries

A birth shared between parent/child timelines, a trip on partners' timelines,
or a fictional event on several character timelines must not disappear from a
retained timeline because another placement is transferred.
Before transfer, same-owner placements use one accepted event. After ownership
separates, each owner has an independently accepted version with common provenance.
There is no longer one live event forced to match across owners. Events found
only on the transferring timeline simply transfer.

Collaborator roles express trust and govern updates; do not make users configure
a second, independent connection-permission switch. For an update from User1's
accepted event version into User3's timeline, use **User1's current role on the
destination timeline**:

| Source owner's role on destination | Incoming change |
| --- | --- |
| Co-Author | Can apply directly, subject to authorization, version/conflict checks, and private-item boundaries. |
| Contributor | Becomes a proposal; destination Owner/Co-Authors may accept or decline, or Owner-configured trust may auto-approve it. |
| Reviewer | No incoming edits or proposals; source owner may read permitted destination updates but cannot change that timeline. |
| No access | No new updates flow through that revoked relationship in either direction; independently retained event versions remain. |

Reverse-direction updates follow the other owner's role on their destination,
not the first direction's role. For example, a Reviewer can see a timeline's
updates, but those updates do not overwrite their own version merely because
they can see them: applying there follows the sender's role on that timeline.
Explicit revocation must not be bypassed through retained provenance. Handling
conflicting residual grants and alternate multi-party routes must pause ambiguous
routing rather than bypass a known revocation. Detailed route evaluation still
needs implementation design.

Example: Mom revises "We went to Disneyland!" on her version. Dad declines the
proposal on his transferred timeline and keeps his accepted version; Kid1
accepts it on theirs. Neither decision changes the others' accepted versions.
Declining one proposal does not itself revoke collaboration or future proposals.

Record a common baseline and revision lineage for each owner's accepted version.
An authorized Co-Author update applies directly only when it does not conflict
with destination changes. Contributor updates remain proposals, with trusted
acceptance only when authorized, version-valid, and free of conflicts.
Conflicts pause automation even for Co-Authors or
trusted Contributors: preserve both versions and show the baseline, destination
version, and incoming version. Offer keep yours, accept theirs, or combine,
subject to the acting user's current authority.

A declined revision stays declined. Retries, duplicate delivery, or an alternate
route must not reapply or repeatedly repropose the same change; genuinely new
revisions may be considered separately. On restored access, present a catch-up
comparison from the last common baseline, not an automatic backlog replay.
Never silently resurrect deleted content/placements or overwrite divergent work.

### Accepted outgoing updates and attribution

If User2 changes User1's version through authorized Co-Author editing, User1's
approval, or configured auto-approval, it becomes part of User1's accepted version.
An outgoing update from that version to User3 follows User1's role on User3's
timeline, not User2's role. User3 independently applies or reviews it under that
relationship. Ignoring a pending proposal is not acceptance.

It becomes **User1's outgoing update, not User1's authorship**. Preserve User2's
attribution and review/decision history. Neither acceptance nor forwarding grants
access to private material. Destinations may therefore have different accepted
versions of the same event in common, and updates must preserve local changes.

Remember common event identity, accepted revision lineage, and handover/common
baselines without granting live access through those identifiers. Prevent loops,
duplicate proposals, and replayed applications when an accepted update travels
through several owners or returns to its origin. The conflict/catch-up rules above
are settled; exact routing, baseline storage, merge UI, and multi-party/repeated-
transfer algorithms still need implementation design. Do not silently merge or
reconnect divergent versions.

Archives always stay frozen. An event on a different timeline the sender still
owns is an active record, not the sender's transfer archive. Updating that active
record does not imply access to the transferred timeline. Ordinary unsharing
still creates no copy for someone without an independently retained placement
or an explicit archive/snapshot entitlement.

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

### Future calendar readiness, not current calendar support

Keep the current implementation limited to Gregorian CE years 1-9999.
BCE dates and fictional calendars remain deferred, but the eventual model and
contracts must preserve an extension boundary rather than treat Gregorian
components and SQL `DATE` as the universal representation:

- Record explicit calendar identity with structured dates; existing dates have
  a defined Gregorian interpretation, not a calendar inferred from wording.
- Interpret and validate components, eras, precision, seasons, and derived ages
  under that calendar. Define BCE era/year-zero conventions before enabling
  support; merely allowing negative years is not a sufficient design.
- Preserve authored wording and calendar-specific components separately from
  calculated ordering/uncertainty bounds. A future fictional date need not fit
  Gregorian months or a PostgreSQL `DATE`.
- Associate derived coordinates with an explicit comparison domain. Sort dates
  together only where they share a chronology or have an explicitly defined
  mapping; independent fictional epochs are not automatically comparable.
- Keep calendar definitions stable or versioned so edits to a definition cannot
  silently reinterpret saved dates or frozen archives.

The structural SQL's positive-year and Gregorian month/season constraints and
DATE bounds describe its current scope, not a universal future date format.
Calendar identity and comparison-domain fields reserve the extension boundary,
not support for any other calendar. Future support will require revised
contracts, storage, validation, and calculations. Do not loosen current checks or build
a calendar engine merely to reserve this boundary. Exact calendar schemas,
definitions, mapping rules, and supported ranges remain future design work.

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

Each event has exactly one type, determining its chronological display band.
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

Separately, optional multiple topics/categories (possibly labeled tags) organize and filter an event:
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

### Structural boundaries

The revised draft separates **accepted content, timeline placement, organizing
context, and frozen retention**. One owner's accepted event can be placed on
multiple timelines; transfer can create another owner's independently accepted
representation with shared provenance. Parent links are not placements, people
links are not sharing grants, and provenance IDs grant no content access.

Private creator-owned items must survive loss of access to their contextual
timeline. Their placement on another owner's timeline does not grant that owner
private editing authority. Transfer read authorization and frozen-copy retention
are separate, creator-controlled records, not general private-item sharing.

Accepted revisions and contributor attribution supply the basis for history,
consent eligibility, baseline comparison, and exact frozen copies. Retained
revision/media references must be considered before live deletion or garbage
collection. This does not mean all sensitive history is retained indefinitely:
the later purge protocol must distinguish recoverable/live history from
independently authorized frozen retention, preserving only permitted content
and minimal removal/deduplication markers after permanent deletion.

The structural table map is:

| Tables | Purpose |
| --- | --- |
| app_user, project, timeline, person_account_link | Sole ownership, Person subjects, and consent-based account linkage. |
| timeline_collaborator, project_membership, project_future_grant, project_future_grant_authorization, project_transfer | Timeline role grants, mixed-owner project membership, separately authorized future defaults, and project succession. |
| item_identity, owner_item, item_revision, revision_lineage, accepted_authorship | Common provenance, owner-specific accepted representations, creator identity, exact revisions, upstream lineage, and accepted authorship. |
| person_revision, event_revision, note_revision, media_revision, date_endpoint | Typed revision facts, multiple notes, authored date precision/wording, and Gregorian-only calendar identity and bounds. |
| place, place_revision, topic, topic_revision, revision_person, revision_topic | Revision-specific places, tags, participants, and labels without implicit timeline placement. |
| item_placement, placement_revision, event_edge, edge_revision, item_attachment, attachment_revision | Explicit timeline appearances, multiple containing events, note/media context, and removed/inactive relationship history. |
| proposal, proposal_revision, proposal_decision, timeline_trust, owner_review_action | Shared review queues, same-request revisions, exact reviewed decisions, and Owner-authorized trust/promotion/backlog actions. |
| consent_request, consent_revision, consent_placement, consent_eligibility, consent_response, consent_override, consent_outcome | Version/action/placement-specific requests, accepted-history eligibility, individual responses, and explicit Owner overrides. |
| timeline_transfer, transfer_manifest, transfer_role_confirmation, private_inclusion_authorization, private_inclusion_item | Whole-timeline inventory, recipient-confirmed roles, expected versions, and separate creator-authorized private read/frozen-retention selections. |
| snapshot, snapshot_item, snapshot_revision_reference, snapshot_placement, snapshot_edge, snapshot_asset, media_asset | Frozen sender archives and optional irrevocable collaborator snapshots, independently copied content, exact source references, and retained private assets. |
| update_relationship, update_delivery, update_receipt, update_revision_disposition, update_reconciliation | Common baselines, independent acceptance, conflict review, declined/applied revision suppression, and catch-up decisions. |
| item_deletion_marker, mutation_receipt, notification | Minimal permanent-removal markers, request replay safety, and content-free activity; recoverable deletion state also belongs to the content/placement records. |

Constraints enforce row shapes and explicitly declared reference scopes, not
every product invariant. Future transactional functions must derive authority,
validate current role/creator consent and expected versions, reject multi-node
cycles under concurrent writes, enforce whole-transfer completeness and queue
resolution, freeze retained content, deduplicate routed revisions, and coordinate
recovery/purge. The draft rejects UPDATE, DELETE, and TRUNCATE on protected
history tables; authorized creation, correct snapshot freezing, and mutable
pointer transitions still require enforced write paths. Current history guards
also prohibit purge: a reviewed purge/reference-removal protocol must be
implemented before promising permanent-erasure behavior. Dates still require
validated SQL/TypeScript calculations,
including real civil-day validity and exactly derived uncertainty bounds.

The SQL enables and forces RLS with **no application policies or grants**:
fail-closed scaffolding, not completed security. There is no ordinary private
sharing/exclusion table, assigned single-reviewer workflow, separate connection
permission switch, captured pending-review transfer, or settling archive state.
The current application's migrations and storage are unchanged.

## 8. Required transactional and privacy implementation

- Authenticated identity comes from the server/provider, never submitted owner
  or reviewer IDs. Derive authorization and eligible reviewers using authoritative rows.
- Enforce timeline roles across all non-private content. A Co-Author can directly
  edit shared work; private-item viewing and editing remain separately protected.
  Recheck role/access and proposal state atomically when deciding a proposal;
  membership alone is not sufficient permission. Preserve original attribution.
- On collaborator removal, revoke the affected live grant. Do not promise
  general authorship-only retention/export or unilateral withdrawal. Preserve
  creator-private additions, explicitly granted irrevocable snapshots, and
  authorized sender archives without exposing inaccessible context or media.
- Privatization requests originate from creators. Joint-edit consent uses
  current eligible Co-Authors/Contributors with accepted work, not every reader
  or past author. Version-check the request, approvals, and any explicit Owner
  override; record the decision and notify affected editors. Timeout alone
  never applies a privacy change or deletion.
- Enforce export restrictions server-side, including exclusion of others'
  private content even if viewable. Retained private-item export must not fetch
  inaccessible associated-event context; granted collaborator snapshots have no export.
- RLS must protect accepted content, private layers, Person/place metadata,
  proposal previews, before/after audit data, notifications, and archive assets.
- Private viewing/editing is creator-only in ordinary MVP use. Transfer read
  access and frozen-retention authorizations are explicit, separately scoped
  exceptions, never editing grants or authorization for future private items.
  Contributor-owned private items must not leak
  through owner queries, review queues, notifications, or transfer archives.
- Allow only validated transactional RPC writes, not direct browser table writes.
  Lock/version-check targets and share state; prevent author/owner/version forgery.
- Apply review result, content update, links, version increment, log, and
  notifications atomically. No pending review may carry through transfer.
- Version pending proposal edits independently from accepted content. A review
  decision must match both the reviewed proposal revision and applicable target
  version. Keep one current queue entry, not one request per correction.
- Route event-in-common changes as source-owner outgoing updates according to
  destination roles/trust. Preserve original authorship, local accepted versions,
  private boundaries, and source lineage; prevent cycles and duplicate application.
- Use actor-scoped stable request IDs, payload fingerprints, and durable
  acknowledged results. Replays return the prior result; changed content cannot
  reuse a request identity. Stale versions preserve user work.
- Transfer changes ownership/access only after pending proposals are resolved,
  recipient-confirmed grants, owner-specific event versions, and authorized frozen archive
  content/asset retention are ready. Upload steps may be staged, but the visible
  handover is atomic; failure must not produce a half-transferred account.
- Media references are private storage keys, not public URLs or cached signed
  links. Immutable blobs and separately authorized retained references prevent
  replacement/deletion from invalidating an archive.
- Preserve server-only credentials, private/no-store responses, and explicit
  browser-draft versus pending-proposal versus cloud-accepted states.

Notifications remain in-app and content-free: only permitted "who did what"
metadata. Notify reviewers of new requests and contributors of acceptance.
Ordinary proposals have no decline/cancel/outdated notification. Joint-edit
privacy/deletion requests separately notify eligible editors, notify the Owner
of declines, and notify affected editors of overrides. Avoid names/actors that would leak an
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

Normal timeline transfer provides a planned manual legacy handover when the
current owner can initiate it and the descendant has an account and explicitly
accepts. All normal proposal-resolution, collaborator-confirmation, and
private-content rules still apply. This is not post-death/incapacity activation:
if the owner cannot authorize the transfer, the deferred legacy mechanism is
still needed. Timeline transfer itself remains proposed, not implemented.

## 10. Open details before implementation

These are intentionally not silently filled in by the SQL:

1. Type-specific forms/prompts, starter topics, sharing/transfer confirmation UX.
2. Detailed project invitations, project-metadata visibility, future-grant
   activation and bulk-action confirmation. Single ownership, mixed timeline
   owners, mutual consent to add, either owner's right to remove, and project
   succession are settled in section 2. Timeline access persists through moves.
3. Private-item permission implementation: creator-originated visibility changes,
   eligible joint-editor consent, three-day nonresponse prompts, and explicit
   Owner overrides of nonresponse or declines are settled in section 2.
   Accepted-history eligibility includes superseded edits; material changes
   refresh consent, current roles are rechecked, and Owner/authorized Co-Author
   shared-deletion initiation is settled. Specify the detailed version protocol.
   All non-private content follows timeline grants, including future accepted
   contributions; there is no separate per-author audience approval or exclusion.
   Contributor-to-Co-Author promotion accepts eligible pending proposals;
   downgrade/removal preserves them for Owner review, as settled in section 3.
   Creator-private retention/export and optional irrevocable non-exportable
   snapshots are settled; no automatic joint-authorship retention or withdrawal
   entitlement follows from departure. Departure/consent screens need design.
4. Shared review lifecycle: detailed handling of blocked promotion-time proposals
   and private review context after access changes. Role-change effects,
   editable pending proposals, and continued
   approval for Contributors' edits after acceptance are settled. Define
   confirmation, progress, and failure/retry UX for the optional
   authorized project-wide acceptance of a trusted contributor's backlog.
   Timeline-owner-managed trust and approval/decline by any authorized owner/co-author are settled;
   neither bypasses private-item permissions.
5. Export formats, sender-archive export behavior, and enforcement tests.
   Owner/Co-Author live export, creator-retained private export, exclusion of
   others' private content, and no export of granted collaborator snapshots are
   settled. No extra export-redistribution consent layer; legal rights are out
   of scope. Private items are creator-edited only; ordinary per-item private
   sharing is excluded from MVP. Transfer recipients may explicitly receive
   read access; archive inclusion separately authorizes frozen retention.
6. Detailed transfer gating, concurrent edits/submissions, private-content
   boundaries, and repeated/multi-party transfers. Recipient confirmation of
   collaborator roles and resolution of all pending proposals before handover
   are settled. Archives freeze immediately; no captured review queue carries over.
7. Birth-date edits/account-link consent presentation and UI for the settled
   creator-authorized transfer/private frozen-retention choices.
8. Retained pending proposals when timeline access changes, and what the
   former recipient can see after unsharing without regaining live access.
   Creator access/export of their own private additions after unsharing is
   settled; design the orphaned-item view without exposing former associated-event content.
   No automatic timeline copy on unshare is assumed.
9. Implement and verify the structural draft's timeline roles, shared queues,
   and project bulk/future grants through validated payload contracts,
   derived date calculation, versioned RPCs,
   RLS/storage policies, archive freeze rules, and focused concurrency tests.
10. Multi-timeline event identity/placement enforcement, permission-aware audience
    expansion, and private note/media boundaries. Last-placement removal prompts
    for deletion into Trash; detailed implementation remains. Same-owner live events and independent
    cross-owner acceptance under source-owner destination roles are settled.
    Same-owner mixed-role editing follows the owner's accepted event across
    placements without granting access to other timelines. Common baselines,
    conflict-paused automation, declined-revision suppression, and explicit
    catch-up comparison are settled. Validate the baseline representation and design merge UI and
    route/deduplication algorithms; ambiguous routes pause rather than bypass
    revocation.
11. Organizing-event/entry implementation: precise ordering/navigation controls,
    transactional cycle prevention, and dates outside a containing event's span.
    Multiple containers with no user-facing depth limit, path-based Back navigation,
    and authorized alternative-container navigation are settled. Section 1
    settles type bands, immediate-sub-event drill-down, explicit containment links versus
    chronological overlap, tag filtering, suggested rather than inherited people,
    independent placements, undated-memory display (containing-event title icon
    for contained memories; separate undated group for uncontained memories), and placement-based
    transfer. Permission enforcement still needs policies, transactional writes,
    and tests.
    Deletion selection, inactive history, 30-day Trash, explicit permanent
    deletion, and separate content/placement restoration are settled. Detailed
    recovery, purge, and permission-check workflows still need implementation
    design. Organizing entries is MVP scope;
    general-purpose event linking is not.
12. Event-note forms/presentation, visibility-change confirmation, orphaned
    private-item views, and revocation/snapshot-grant screens. A separate Add note
    action with Only me/Timeline collaborators visibility is required; it does
    not add an event type or replace deferred proposal-linked discussion/chat.

## Superseded v2 rules

- Authorship alone no longer determines ownership/editing authority after transfer.
- Ordinary unsharing does not create independent recipient copies.
- Cancellation applies only to pending proposals. Accepted jointly edited content
  follows the current privacy/deletion consent and Owner-override rules, not
  unilateral withdrawal by a departed author.
- Person account linking does not change the reviewer.
- Single event-level precision is replaced by independent endpoint descriptions.
- Place does not automatically determine seasonal interpretation.
- Event type is not a replacement for optional multi-topic categorization.
- Legacy functionality is deferred rather than represented as an active grant.

## Superseded earlier v3 rules

- Per-author collaborator approval, per-author suggestion controls, and
  per-recipient non-private exclusions are replaced by timeline-wide access to
  all non-private content under the collaborator's role. November 23 further
  narrows private grants to transfer/archive inclusion; ordinary private sharing
  is excluded from MVP and private editing remains creator-only.
- Project-wide roles are replaced by timeline-level roles with project bulk
  controls and explicit future-timeline grants.
- Co-authorship does not require a project; eligible owner/co-author review is
  based on timeline authority, not original item authorship.
- Post-removal general authorship-only retention/export is not granted. Creators
  retain/export their private additions; optional collaborator snapshots are
  irrevocable read-only in-app grants without export.
- Item-by-item transfer selection and pending-review carryover are replaced by
  whole-timeline handover with no pending proposals, recipient-confirmed access,
  and a frozen archive at every transfer.
- Pending proposals are editable under one request with revision-checked approval,
  replacing immutable submissions that required cancellation for corrections.
- Projects can contain differently owned timelines; project entry/exit and owner
  succession preserve timeline ownership and explicit collaborator grants.
- Former collaborators have no automatic archive, but the new owner may explicitly
  grant irrevocable read-only snapshot retention without onward-sharing rights.
- The separate connected/paused/independent permission switch is replaced by
  role-directed updates between owner-specific accepted versions after transfer.
  Same-owner placements remain one live event. Source-owner outgoing authority
  does not erase original authorship or authorize private-content propagation.
- Creator-originated privacy changes and joint-edit privacy/deletion requests
  replace unresolved withdrawal rules: eligible current editors can object,
  with three-day nonresponse prompts and explicit recorded Owner overrides.
- Export is Owner/Co-Author-only for live timelines, includes only the exporter's
  own private items, and carries distribution trust without another consent
  layer. Legal rights remain outside app permissions.
