# Timeline workflow inventory

Derived November 20, 2026, from the
[proposed data model v3](Life%20Timeline%20App%20Draft%20Data%20Model%20%28MVP%29%20v3.md).
This user-workflow inventory is separate from the GitHub issue backlog.
These are planned flows, not a claim that they are implemented.
**Open** indicates that part of the behavior still needs a decision.
The data model remains the canonical source of product rules.

## Identity, timelines, and projects

| ID | Workflow |
| --- | --- |
| W01 | Create a Person/character and a timeline about that subject. |
| W02 | Request and give consent to link a Person to a user account, without granting timeline access. |
| W03 | Add or edit a subject's birthdate; show only authorized derived ages and birthday markers. |
| W04 | Create a project and organize timelines within it. |
| W05 | Add another owner's timeline to a project with both owners' agreement; either owner may subsequently remove it. |
| W06 | Move a timeline between projects without changing its ownership or permissions. |
| W07 | Transfer project ownership: recipient accepts, contained timeline owners are notified, future-grant defaults require fresh authorization. |

## Creating and organizing content

| ID | Workflow |
| --- | --- |
| W08 | Create or edit an event: choose one type/template, enter title, details, people, place, tags, and dates. Preserve content when switching templates. |
| W09 | Add an event to additional owned timelines; confirm any authorized audience expansion. |
| W10 | Remove a timeline placement without deleting the event's other placements. |
| W11 | Add a child event/memory from its parent; confirm suggested people and independently choose placements/privacy. |
| W12 | Associate an existing event with an organizing parent; change or detach that relationship. **Parent/depth constraints remain open.** |
| W13 | Add an event-attached note with "Only me" or "Timeline collaborators" visibility. |
| W14 | Add or replace media and edit captions under the applicable direct-edit/proposal rules. |
| W15 | Import content privately, then explicitly review it before sharing. **Detailed import experience is unspecified.** |

## Dates and browsing

| ID | Workflow |
| --- | --- |
| W16 | Enter a date/span in "When?", inspect its interpretation, resolve ambiguity, or explicitly retain unplaced wording. |
| W17 | Set date-order and seasonal preferences; override interpretation for an individual entry without reinterpreting saved dates. |
| W18 | Set independent endpoint precision and specified/unknown/ongoing ends; optionally confirm an inferred residence span or uncertain sequence. |
| W19 | Browse chronological type bands and a combined timeline without duplicating multi-timeline placements. |
| W20 | Filter across types and parent groups using tags. |
| W21 | Open immediate children and drill down; open undated child memories through the parent-title icon or browse parentless undated memories separately. |

## Collaboration and proposals

| ID | Workflow |
| --- | --- |
| W22 | Invite an account to a timeline and activate its selected role. **Invitation screens/mechanics remain open.** |
| W23 | Inspect and change roles across timelines using project bulk controls; explicitly configure future-timeline grants. |
| W24 | Submit a Contributor addition/edit and view its pending preview; revise the same request before acceptance. |
| W25 | Review the latest proposal and its before/after context; approve or decline. |
| W26 | Cancel a pending proposal, or handle an outdated/conflicted proposal without losing the submitted work. |
| W27 | Enable/disable future auto-approval; separately choose whether to accept an eligible backlog across authorized timelines. Handle partial results. |
| W28 | Promote a Contributor to Co-Author, accepting eligible pending proposals and surfacing blocked ones. |
| W29 | Downgrade/remove a collaborator while preserving pending proposals for Owner review. |
| W30 | Open permitted in-app notifications and act on review or consent requests without exposing restricted context. |

## Privacy, consent, and departure

| ID | Workflow |
| --- | --- |
| W31 | Create/edit one's own private event or note directly, without Owner approval. |
| W32 | Grant/revoke explicit private-item viewing permissions. **Private editing grants still need specification.** |
| W33 | Change an item's privacy as its creator; explain that earlier exposure/copies cannot be recalled. |
| W34 | Request privatization or deletion of jointly edited content; eligible current editors approve/decline. |
| W35 | Handle a consent decline or three-day nonresponse: resend or explicitly override as Owner, with audit and notification. |
| W36 | Revoke timeline access and choose whether to grant an irrevocable frozen copy. |
| W37 | Access/export retained creator-private additions after revocation without revealing the former parent/timeline. **Orphaned-item presentation remains open.** |

## Deletion, recovery, and export

| ID | Workflow |
| --- | --- |
| W38 | Delete an organizing event: inspect descendants, select items to include/exclude, choose affected owned placements, and confirm any required consent. |
| W39 | Recover deleted content or undo an unintended move/relationship change. **Retention windows and detailed recovery rules remain open.** |
| W40 | Export as Owner/Co-Author: include authorized non-private content and optionally one's own private items; exclude others' private content. |
| W41 | Browse a granted frozen snapshot without editing, export, or live updates. **Snapshot and sender-archive export behavior are distinct.** |

## Transfer and events in common

| ID | Workflow |
| --- | --- |
| W42 | Initiate whole-timeline transfer; resolve pending proposals and obtain authorization for included private material. |
| W43 | Recipient accepts the handover and confirms continuing collaborator roles and project placement; refresh confirmation if relevant state changes. |
| W44 | Complete transfer atomically; preserve included parent links and leave children independent where their parent wasn't transferred. |
| W45 | Browse the sender's frozen archive; compare it with the live timeline only where current access permits. |
| W46 | Send accepted event-in-common updates under the source owner's destination role; accept/decline proposals independently where applicable. |
| W47 | Reconcile divergent versions after restored access or conflicts, without silently merging or replaying changes. **Detailed workflow remains open.** |

## Cross-cutting paths easy to miss

Every relevant write flow also needs **failed-save/retry, uncertain server
acknowledgment, stale-version/conflict, access-changing-mid-action, and
reload/draft-recovery paths**. These are not separate features, but they must be
represented in the workflow designs.

The document does **not** fully specify account onboarding/recovery, invitation
delivery, or account deletion. Deferred legacy activation, fictional calendars,
story plotting, comparisons, and proposal-linked chat would require separate
future workflows.
