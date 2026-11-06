# Life Timeline App: Revised Draft Data Model (MVP)

Draft v3, November 6, 2026

Companion: [timeline_schema_v3.sql](timeline_schema_v3.sql).
Previous proposal: [Draft v2](Life%20Timeline%20App%20Draft%20Data%20Model%20%28MVP%29.md).

## Status and scope

This document consolidates the agreed product direction. The companion SQL is
a **structural design draft**, not a migration, runnable application backend,
or completed authorization implementation. It deliberately grants no application
access. Do not paste it into an existing development or production database.

The running app still uses project-owned data and project-scoped drafts.
Implementing this direction will require an architectural decision replacing
those boundaries, updated contracts and workflows, and tested database policies
and transactional functions. Neither the original proposal nor application code
is changed by these reference files.

Events are the core content. A timeline is a saved collection/view about one
subject; projects are optional folders. Real and fictional people are supported.
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
- Each timeline-local content item records its original creator separately from
  its current editing authority. The timeline records its current owner.
  Attribution does not disappear when editing authority changes.
- By default, the creator reviews proposed changes to an existing item. After
  explicit transfer, the recipient has editing authority over transferred items,
  subject only to closing the pre-transfer reviews described below.
- Person, event, note, and media records are timeline-local representations.
  Sharing exposes the same representation to authorized users; acceptance updates
  both users' views of that timeline, not other unshared timelines.
- Related copies have stable provenance identifiers and snapshot versions, not
  an implicit live synchronization link. Place/topic data must also remain
  independent where an archive or transfer requires it.

## 2. Sharing is live access, not ownership

The action "Share this timeline" offers:

| Choice | Recipient's rights |
| --- | --- |
| View Only | Read permitted content. No editing or contribution rights. |
| View and Contribute | Read permitted content and submit shared additions or changes for review. May also create and directly edit their own private items, without modifying anyone else's content. |
| Transfer Ownership | A separate handover operation: recipient owns selected content; sender loses live access unless shared back. |

Each share belongs to a specific recipient, with its own role and exclusions.
Both sharing roles include **current and future non-private memories and
approved updates automatically**. This is not a one-time snapshot.

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
Visibility permission alone does not grant direct editing authority. Timeline ownership,
View and Contribute, and account linking do not by themselves reveal another
creator's private layers.

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
permission; the exact workflow for mixed-authorship audience changes is still
open and must be settled before enabling those changes.

## 3. Contributions, review, and trust

### Targets and reviewer

Proposals have a stable ID, recipient timeline, contributor, reviewer, typed
target, submitted payload, and base version where they change existing content.
Targets include Person, event, note, and media, not just events.

- Shared additions are reviewed for inclusion by the timeline owner. New content
  retains the contributor's original attribution. A contributor's own private
  additions do not enter another user's approval queue.
- Changes/replacements to accepted content are reviewed by that item's creator,
  or its editing authority after the transfer exception has finished.
- Notes expressing a different recollection can be separate additions rather
  than an overwrite of someone else's words.
- Media additions, caption changes, and file replacements are distinguishable
  proposals. Replacing media does not destroy a blob still retained by an archive
  or independent copy.
- Private content is not available as a proposal target to a recipient without
  explicit authority to see it.

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

There is **no retraction of accepted contributions**. Errors in accepted content
are addressed through a new change/replacement proposal.

Cancellation is allowed while pending. If acceptance, including auto-accept,
wins a simultaneous race, cancellation cannot roll it back. The database must
serialize the decision and return the actual outcome.

`auto_accept` is an explicit trust setting made by the **reviewer for one
contributor in one timeline**. It automatically accepts new shared additions
and proposed edits/replacements that reviewer is authorized to decide. For new
shared additions, the timeline owner's trust supplies inclusion approval.
A sharer cannot auto-accept edits for a different creator. Validation, audience
permissions, expected versions where applicable, and audit history still apply;
auto-accept is not unrestricted direct write access. A contributor's own private
additions need no inclusion approval and do not depend on this trust setting.

Ending a share does not silently discard pending submissions. The reviewer may
resolve the submitted payload with restricted review context; the contributor
does not regain live access. No later content is fetched from the former
relationship and no relationship is reactivated. Exact UI/read access for an
unshared contributor's retained proposals remains to be designed.

## 4. Transfer and the sender's archive

Transfer includes an explicit selection/confirmation step. The sender chooses
what passes, including whether to include their private material. Another
creator's private material needs that creator's explicit authorization; it is
not the sender's to grant.

The selected material becomes recipient-owned and editable. Excluded private
material stays out of the recipient's timeline and remains available in the
sender's archive. Transfer preserves attribution but changes editing authority.
If the recipient previously contributed private items on that timeline, those
items remain theirs and are visible alongside the transferred content. The
sender cannot exclude or acquire the recipient's own private additions.
The sender's archive does not include them without the recipient's permission.
The sender loses live viewing and editing access; continued access requires a
new share from the recipient. Existing shares must not silently grant access to
the new owner's future private content; their disposition needs confirmation
in the transfer workflow.

**Automatically create a read-only archive for the sender at transfer.**
It contains the pre-transfer content the sender is authorized to retain,
including their own excluded private notes. It must retain the referenced media
independently of deletion or replacement in the recipient's live timeline.

The archive has a narrow exception to immutability:

1. Capture the exact proposals pending at transfer, with their original
   reviewers and restricted pre-transfer context.
2. Lock each affected live item until all its captured reviews are closed.
   The new owner can edit unaffected items immediately.
3. Original creators decide those captured reviews. Accepted changes apply to
   both transferred content and the sender's corresponding archive content,
   wherever the authorized content exists.
4. The new owner can explicitly cancel abandoned captured requests, without
   applying them, to release their locks.
5. Once the captured reviews close, the archive is frozen. Recipient edits and
   new memories never flow back.

Resolving several proposals against the same version may make later proposals
outdated. Never overwrite a newer accepted revision merely to finish a queue.
Edits to an excluded item can resolve in its authorized retained context, but
must not recreate that item in the recipient's timeline.

Invitations, recipient acceptance, selection validation, and transfer commitment
must be separate from ordinary sharing. The recipient-confirmation UX and the
handling of pending additions spanning included/excluded items are still open.
Do not silently grant the sender general access for review.

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

| Structure | Purpose |
| --- | --- |
| app_user, project, timeline | Auth-linked profile, optional folder, owner-controlled live timeline/archive. |
| timeline_item | Timeline-local identity, kind, creator, current editor, privacy, version, copy provenance. |
| person, event, note, media | Typed content for each item; content/link IDs cannot cross timeline scopes. |
| date_endpoint | Authored civil components/wording and per-endpoint uncertainty bounds. |
| place, topic, event_topic, event_person | Structured location, optional labels, participant links. |
| share_access, share_exclusion, share_private_authorization | Per-recipient live roles, exclusions, and explicit authorization for existing private items. |
| review_trust | Reviewer-specific auto-accept for a contributor's shared additions and edits/replacements. |
| contribution | Stable typed proposals, target/version, submitted snapshot, status and decision metadata. |
| ownership_transfer, transfer_item, transfer_review | Selection, archive mappings, and captured pending-review lock bookkeeping. |
| change_log, mutation_receipt | Private revision audit and replay-safe mutation results. |
| media_asset | Private immutable storage-object identity and readiness; retained references protect snapshots. |
| notification | Content-free in-app activity; pending count is a query, not stored. |

Constraints enforce many shapes and same-timeline foreign keys. They do **not**
implement reviewer derivation, media retention, consent, endpoint-bound
calculation, review locks, ownership changes, or audience rules. These are
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
  or reviewer IDs. Derive authorization and reviewer using authoritative rows.
- RLS must protect accepted content, private layers, Person/place metadata,
  proposal previews, before/after audit data, notifications, and archive assets.
- Private visibility requires explicit per-item/per-recipient authorization;
  "everything" never authorizes future private items or another creator's
  private content implicitly. Contributor-owned private items must not leak
  through owner queries, review queues, notifications, or transfer archives.
- Allow only validated transactional RPC writes, not direct browser table writes.
  Lock/version-check targets and share state; prevent author/owner/version forgery.
- Apply review result, content update, links, version increment, log, notifications,
  archive exception, and review-lock release atomically.
- Use actor-scoped stable request IDs, payload fingerprints, and durable
  acknowledged results. Replays return the prior result; changed content cannot
  reuse a request identity. Stale versions preserve user work.
- Transfer changes ownership/access only after selection and authorized archive
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
2. Mixed-authorship onward/audience permissions and any creator-originated edits
   that would alter another owner's already accepted content. Preserve the
   earlier requirement for recipient approval; a shared view is not permission
   to silently overwrite someone else's words.
3. Existing third-party shares on transfer, repeated transfers during pending
   review, and pending additions with excluded parents. Require explicit
   resolution; do not create unsupported cross-archive propagation.
4. Birth-date edits/account-link consent presentation and retaining another
   creator's private content with explicit permission.
5. Retained pending proposals when an individual item is hidden, and what the
   former recipient can see after unsharing without regaining live access.
   Recovery/access to a contributor's own private additions after unsharing
   also needs an explicit workflow; no copy-on-unshare behavior is assumed.
6. Actual validated payload contracts, derived date calculation, versioned RPCs,
   RLS/storage policies, archive freeze rules, and focused concurrency tests.

## Superseded v2 rules

- Authorship alone no longer determines ownership/editing authority after transfer.
- Ordinary unsharing does not create independent recipient copies.
- No retraction of accepted contributions; pending cancellation remains allowed.
- Person account linking does not change the reviewer.
- Single event-level precision is replaced by independent endpoint descriptions.
- Place does not automatically determine seasonal interpretation.
- Event type is not a replacement for optional multi-topic categorization.
- Legacy functionality is deferred rather than represented as an active grant.
