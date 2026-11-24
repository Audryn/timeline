-- Timeline v3: reviewed direction, November 23, 2026.
-- STRUCTURAL DRAFT ONLY. NOT A DEPLOYABLE MIGRATION OR APPLICATION BACKEND.
-- Companion: Life Timeline App Draft Data Model (MVP) v3.md (product authority).
-- Assumes auth.users and roles anon/authenticated. Use synthetic, isolated DBs only.
--
-- Identity: item_identity is stable common/original identity. owner_item is ONE
-- accepted representation per identity/account, NOT per placement. Shared content
-- follows the owner of the placement timeline; private editing/privacy authority
-- remains with the original creator. A Carol-owned private note may be placed on
-- Bob's timeline. There is deliberately no blanket placement/item owner-equality
-- FK. An authorized transfer-private read is a separate, revision-scoped exception,
-- never a change of creator, ordinary sharing grant, or private editing authority.
--
-- Exact accepted revisions, subtype rows, lineage, decisions, consent records,
-- and frozen content reject UPDATE/DELETE/TRUNCATE through append-only guards. These
-- guards enforce immutability, NOT authorization or valid workflow transitions.
-- Mutable pointers/state require future serialized, expected-version RPCs.
--
-- REQUIRED BUT NOT IMPLEMENTED:
-- * authenticated ownership/role derivation, private isolation, storage policies,
--   safe metadata/counts/notifications/exports and review-context filtering;
-- * same-owner shared placement scope, audience confirmation, typed subtype
--   completeness, required subject/start/end facts, derived date bounds;
-- * atomic proposal revision/decision races, first valid terminal result,
--   no self-manual-approval, promotion/backlog/trust execution and role refresh;
-- * creator-led privacy and eligible joint-editor consent at exact current
--   versions/placements, refresh on membership/content changes, 3-day nonresponse
--   prompts, explicit owner overrides/notifications (never automatic approval);
-- * whole-transfer inventory completeness, no pending proposals, current role/
--   recipient confirmation, archive freeze and independent owner-version fork;
-- * project dual-owner add/either-owner remove and succession/default suspension;
-- * source-owner destination-role routing, known-revocation/ambiguous-route
--   pauses, conflict detection even for co-authors/trust, catch-up not replay,
--   lineage closure and deduplication including alternate routes and round trips;
-- * acyclic multi-parent graph (no product depth cap), atomic version checks;
--   UI shows immediate children, Back follows the actual navigation path, and
--   other parents/counts are restricted to authorized contexts;
-- * deduplicated descendant deletion, multiply-parented children preserved by
--   default, authorized-context warnings if explicitly selected; last-placement
--   removal prompts for Trash, never silently orphans shared events;
-- * 30-day recovery/expiry, explicit permanent-delete consent/confirmation,
--   separate content/placement/edge restoration, no audience auto-reactivation.
--
-- RETENTION/PURGE BOUNDARY: No DELETE CASCADE and no purge RPC are supplied.
-- Historical references intentionally prevent accidental loss. Snapshot items
-- contain independent frozen documents and independent blob references, not just
-- live pointers. snapshot_revision_reference is a removable retention link;
-- its removal must never alter frozen provenance/payload. A future reviewed,
-- privileged purge protocol must verify complete authorized copies, remove
-- live retention links, prune/rewrite obsolete live-reference dependencies while
-- retaining minimal tombstones/dedup IDs, and perform controlled history/blob
-- deletion. The append-only guard currently rejects that deletion too: purge
-- needs a separately reviewed implementation, not disabling guards in app RPCs.
-- Do not retain all obsolete sensitive content forever merely to satisfy FKs.
-- No source revision/blob can be purged while an authorized retained reference
-- still depends on it. Snapshot metadata copies must include exact authored dates,
-- place/topic/person facts and attribution; source access is not retention consent.
--
-- Public/non-private below means timeline collaborators, NEVER internet public.
-- Identifiers/provenance/account links/project membership confer NO content access.
-- No RLS allow policy, broad app grant, or business-workflow RPC is included.

BEGIN;
CREATE SCHEMA timeline_draft;

CREATE TABLE timeline_draft.app_user (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  display_name text NOT NULL CHECK (length(btrim(display_name)) BETWEEN 1 AND 100),
  season_preference text CHECK (season_preference IN ('northern', 'southern')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE timeline_draft.project (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  kind text NOT NULL CHECK (kind IN ('real', 'fiction')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  defaults_generation integer NOT NULL DEFAULT 1 CHECK (defaults_generation > 0),
  defaults_suspended boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE timeline_draft.item_identity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('person', 'event', 'note', 'media')),
  creator_user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, kind),
  UNIQUE (id, creator_user_id)
);

CREATE TABLE timeline_draft.owner_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id uuid NOT NULL,
  kind text NOT NULL,
  owner_user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  current_revision_id uuid,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  lifecycle text NOT NULL DEFAULT 'active' CHECK (lifecycle IN ('active', 'trash', 'retired')),
  deleted_at timestamptz,
  recoverable_until timestamptz,
  retired_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, identity_id),
  UNIQUE (id, kind),
  UNIQUE (id, identity_id, kind, owner_user_id),
  UNIQUE (id, owner_user_id),
  FOREIGN KEY (identity_id, kind) REFERENCES timeline_draft.item_identity(id, kind),
  CHECK (
    (lifecycle = 'active' AND deleted_at IS NULL AND recoverable_until IS NULL AND retired_at IS NULL)
    OR (lifecycle = 'trash' AND deleted_at IS NOT NULL
      AND recoverable_until IS NOT NULL AND retired_at IS NULL
      AND recoverable_until = deleted_at + interval '30 days')
    OR (lifecycle = 'retired' AND retired_at IS NOT NULL
      AND deleted_at IS NULL AND recoverable_until IS NULL)
  )
);

CREATE TABLE timeline_draft.item_revision (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL,
  identity_id uuid NOT NULL,
  kind text NOT NULL,
  owner_user_id uuid NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  visibility text NOT NULL CHECK (visibility IN ('private', 'shared')),
  actor_user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  accepted_by_user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  acceptance_mode text NOT NULL CHECK (acceptance_mode IN
    ('direct', 'proposal', 'trusted', 'promotion', 'transfer', 'incoming', 'merge')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_id, version),
  UNIQUE (id, item_id, kind),
  UNIQUE (id, item_id, kind, version),
  UNIQUE (id, item_id, identity_id, kind),
  UNIQUE (id, item_id, visibility),
  UNIQUE (id, item_id, owner_user_id),
  UNIQUE (id, identity_id),
  FOREIGN KEY (item_id, identity_id, kind, owner_user_id)
    REFERENCES timeline_draft.owner_item(id, identity_id, kind, owner_user_id)
);
ALTER TABLE timeline_draft.owner_item ADD CONSTRAINT accepted_revision_scope_fk
  FOREIGN KEY (current_revision_id, id, kind, version)
  REFERENCES timeline_draft.item_revision(id, item_id, kind, version)
  DEFERRABLE INITIALLY DEFERRED;
-- current_revision_id may be null only during construction; RPC must complete it.
-- Retired is a historical sender representation after transfer with no retained
-- live placements, not a way to silently orphan ordinary placement removals.

CREATE TABLE timeline_draft.person_revision (
  revision_id uuid PRIMARY KEY,
  item_id uuid NOT NULL,
  item_kind text GENERATED ALWAYS AS ('person'::text) STORED,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 100),
  is_fictional boolean NOT NULL DEFAULT false,
  FOREIGN KEY (revision_id, item_id, item_kind)
    REFERENCES timeline_draft.item_revision(id, item_id, kind)
);

CREATE TABLE timeline_draft.person_account_link (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_identity_id uuid NOT NULL,
  person_kind text GENERATED ALWAYS AS ('person'::text) STORED,
  linked_user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  requested_by_user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  status text NOT NULL CHECK (status IN ('requested', 'consented', 'declined', 'revoked')),
  consented_by_user_id uuid REFERENCES timeline_draft.app_user(id),
  consented_at timestamptz,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  FOREIGN KEY (person_identity_id, person_kind)
    REFERENCES timeline_draft.item_identity(id, kind),
  CHECK ((consented_by_user_id IS NULL) = (consented_at IS NULL)),
  CHECK (consented_by_user_id IS NULL OR consented_by_user_id = linked_user_id),
  CHECK (status <> 'consented' OR consented_at IS NOT NULL)
);
-- Consent must be authenticated and may be withdrawn. This link is not a grant.

CREATE TABLE timeline_draft.timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  original_creator_user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  subject_person_item_id uuid NOT NULL,
  subject_kind text GENERATED ALWAYS AS ('person'::text) STORED,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, owner_user_id),
  FOREIGN KEY (subject_person_item_id, subject_kind)
    REFERENCES timeline_draft.owner_item(id, kind)
);
-- Exactly one Person subject; the creation/transfer RPC validates owner scope.
-- No subject/owner equality FK: an explicitly authorized creator-private Person
-- may remain creator-owned after transfer. RPC must validate that narrow read
-- exception or the ordinary owner-specific subject, without granting editing.
-- Frozen copies are snapshot records, never live timelines or settling archives.

CREATE TABLE timeline_draft.timeline_collaborator (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timeline_id uuid NOT NULL REFERENCES timeline_draft.timeline(id),
  user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  role text NOT NULL CHECK (role IN ('co_author', 'contributor', 'reviewer')),
  status text NOT NULL CHECK (status IN ('invited', 'active', 'revoked', 'declined')),
  granted_by_user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  accepted_at timestamptz,
  revoked_at timestamptz,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  UNIQUE (id, timeline_id),
  CHECK (status <> 'active' OR (accepted_at IS NOT NULL AND revoked_at IS NULL)),
  CHECK (status <> 'revoked' OR revoked_at IS NOT NULL)
);
CREATE UNIQUE INDEX one_open_timeline_collaborator
  ON timeline_draft.timeline_collaborator(timeline_id, user_id)
  WHERE status IN ('invited', 'active');
-- Owner is derived ONLY from timeline.owner_user_id; never a collaborator role.

CREATE TABLE timeline_draft.timeline_trust (
  timeline_id uuid NOT NULL REFERENCES timeline_draft.timeline(id),
  contributor_user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  configured_by_owner_user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  future_auto_accept boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  PRIMARY KEY (timeline_id, contributor_user_id)
);
-- Owner configured per timeline. Future trust alone never drains a backlog.

CREATE TABLE timeline_draft.project_membership (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES timeline_draft.project(id),
  timeline_id uuid NOT NULL REFERENCES timeline_draft.timeline(id),
  state text NOT NULL CHECK (state IN ('proposed', 'active', 'removed', 'declined')),
  expected_project_version integer NOT NULL CHECK (expected_project_version > 0),
  expected_timeline_version integer NOT NULL CHECK (expected_timeline_version > 0),
  project_owner_approved_by uuid REFERENCES timeline_draft.app_user(id),
  project_owner_approved_at timestamptz,
  timeline_owner_approved_by uuid REFERENCES timeline_draft.app_user(id),
  timeline_owner_approved_at timestamptz,
  removed_by_user_id uuid REFERENCES timeline_draft.app_user(id),
  removed_at timestamptz,
  CHECK ((project_owner_approved_by IS NULL) = (project_owner_approved_at IS NULL)),
  CHECK ((timeline_owner_approved_by IS NULL) = (timeline_owner_approved_at IS NULL)),
  CHECK ((removed_by_user_id IS NULL) = (removed_at IS NULL)),
  CHECK (state <> 'active' OR
    (project_owner_approved_at IS NOT NULL AND timeline_owner_approved_at IS NOT NULL)),
  CHECK (state <> 'removed' OR removed_at IS NOT NULL)
);
CREATE UNIQUE INDEX one_active_project_per_timeline
  ON timeline_draft.project_membership(timeline_id) WHERE state = 'active';
-- Agreement of CURRENT owners and either owner's removal authority require RPC.
-- No collaborator/trust change or content access is implied by membership.

CREATE TABLE timeline_draft.project_future_grant (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES timeline_draft.project(id),
  generation integer NOT NULL CHECK (generation > 0),
  recipient_user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  role text NOT NULL CHECK (role IN ('co_author', 'contributor', 'reviewer')),
  project_owner_authorized_by uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  project_owner_authorized_at timestamptz NOT NULL,
  suspended_at timestamptz,
  UNIQUE (id, project_id, generation)
);

CREATE TABLE timeline_draft.project_future_grant_authorization (
  default_id uuid NOT NULL,
  project_id uuid NOT NULL,
  generation integer NOT NULL,
  timeline_owner_user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  authorized_by_user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  authorized_at timestamptz NOT NULL,
  PRIMARY KEY (default_id, timeline_owner_user_id),
  FOREIGN KEY (default_id, project_id, generation)
    REFERENCES timeline_draft.project_future_grant(id, project_id, generation),
  CHECK (authorized_by_user_id = timeline_owner_user_id)
);
-- Each affected timeline owner separately authorizes defaults; no universal
-- project grant. Succession must suspend old defaults and increment generation.

CREATE TABLE timeline_draft.project_transfer (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES timeline_draft.project(id),
  sender_user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  recipient_user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  expected_project_version integer NOT NULL CHECK (expected_project_version > 0),
  status text NOT NULL CHECK (status IN ('proposed', 'accepted', 'declined', 'cancelled')),
  recipient_confirmed_at timestamptz,
  committed_at timestamptz,
  CHECK (sender_user_id <> recipient_user_id),
  CHECK (committed_at IS NULL OR (status = 'accepted' AND recipient_confirmed_at IS NOT NULL))
);
-- Recipient consent, notices to contained timeline owners, default suspension,
-- unchanged timeline roles/owners, and no former project authority: future RPC.

CREATE TABLE timeline_draft.place (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  UNIQUE (id, owner_user_id)
);
CREATE TABLE timeline_draft.place_revision (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id uuid NOT NULL,
  owner_user_id uuid NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 300),
  kind text NOT NULL CHECK (kind IN ('country', 'region', 'city', 'address', 'other')),
  parent_revision_id uuid,
  latitude numeric(9,6) CHECK (latitude BETWEEN -90 AND 90),
  longitude numeric(9,6) CHECK (longitude BETWEEN -180 AND 180),
  UNIQUE (place_id, version),
  UNIQUE (id, owner_user_id),
  FOREIGN KEY (place_id, owner_user_id) REFERENCES timeline_draft.place(id, owner_user_id),
  FOREIGN KEY (parent_revision_id, owner_user_id)
    REFERENCES timeline_draft.place_revision(id, owner_user_id),
  CHECK (parent_revision_id IS NULL OR parent_revision_id <> id)
);
-- Place hierarchy cycles, audience restrictions and copying remain RPC concerns.

CREATE TABLE timeline_draft.topic (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  UNIQUE (id, owner_user_id)
);
CREATE TABLE timeline_draft.topic_revision (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL,
  owner_user_id uuid NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 100),
  archived boolean NOT NULL DEFAULT false,
  UNIQUE (topic_id, version),
  UNIQUE (id, owner_user_id),
  FOREIGN KEY (topic_id, owner_user_id) REFERENCES timeline_draft.topic(id, owner_user_id)
);

CREATE TABLE timeline_draft.event_revision (
  revision_id uuid PRIMARY KEY,
  item_id uuid NOT NULL,
  owner_user_id uuid NOT NULL,
  item_kind text GENERATED ALWAYS AS ('event'::text) STORED,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  event_type text NOT NULL CHECK (event_type IN
    ('moment', 'memory', 'residence', 'job', 'schooling', 'trip', 'relationship', 'other')),
  additional_text text NOT NULL DEFAULT '',
  date_shape text NOT NULL CHECK (date_shape IN ('moment', 'span')),
  end_state text CHECK (end_state IN ('specified', 'unknown', 'ongoing')),
  date_text text CHECK (length(date_text) <= 400),
  manual_sequence integer,
  place_revision_id uuid,
  details jsonb NOT NULL,
  FOREIGN KEY (revision_id, item_id, item_kind)
    REFERENCES timeline_draft.item_revision(id, item_id, kind),
  FOREIGN KEY (revision_id, item_id, owner_user_id)
    REFERENCES timeline_draft.item_revision(id, item_id, owner_user_id),
  FOREIGN KEY (place_revision_id, owner_user_id)
    REFERENCES timeline_draft.place_revision(id, owner_user_id),
  CHECK ((date_shape = 'moment' AND end_state IS NULL)
    OR (date_shape = 'span' AND end_state IS NOT NULL)),
  CHECK (jsonb_typeof(details) = 'object'
    AND details ?& ARRAY['schema_version', 'event_type', 'fields']
    AND details->'schema_version' = '1'::jsonb
    AND details->>'event_type' = event_type
    AND jsonb_typeof(details->'fields') = 'object')
);
-- Typed envelope reserves app-defined field contracts; no invented template
-- fields or validation of unknown fields. Type changes preserve additional_text.

CREATE TABLE timeline_draft.note_revision (
  revision_id uuid PRIMARY KEY,
  item_id uuid NOT NULL,
  item_kind text GENERATED ALWAYS AS ('note'::text) STORED,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 20000),
  FOREIGN KEY (revision_id, item_id, item_kind)
    REFERENCES timeline_draft.item_revision(id, item_id, kind)
);

CREATE TABLE timeline_draft.media_asset (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  storage_bucket text NOT NULL CHECK (length(btrim(storage_bucket)) > 0),
  storage_key text NOT NULL CHECK (length(btrim(storage_key)) > 0),
  media_type text NOT NULL CHECK (length(btrim(media_type)) > 0),
  byte_length bigint NOT NULL CHECK (byte_length > 0),
  content_digest text NOT NULL CHECK (length(btrim(content_digest)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (storage_bucket, storage_key)
);
-- Only finalized immutable assets here. Upload readiness is a future staging
-- workflow. No public/persisted signed URLs. GC checks ALL live/frozen references.
CREATE TABLE timeline_draft.media_revision (
  revision_id uuid PRIMARY KEY,
  item_id uuid NOT NULL,
  item_kind text GENERATED ALWAYS AS ('media'::text) STORED,
  asset_id uuid NOT NULL REFERENCES timeline_draft.media_asset(id),
  media_kind text NOT NULL CHECK (media_kind IN ('photo', 'audio', 'import')),
  caption text NOT NULL DEFAULT '' CHECK (length(caption) <= 2000),
  FOREIGN KEY (revision_id, item_id, item_kind)
    REFERENCES timeline_draft.item_revision(id, item_id, kind)
);

CREATE TABLE timeline_draft.date_endpoint (
  revision_id uuid NOT NULL,
  item_id uuid NOT NULL,
  item_kind text NOT NULL CHECK (item_kind IN ('person', 'event')),
  endpoint text NOT NULL CHECK (endpoint IN ('birth', 'start', 'end')),
  calendar_id text NOT NULL DEFAULT 'gregorian_ce_v1' CHECK (calendar_id = 'gregorian_ce_v1'),
  comparison_domain text NOT NULL DEFAULT 'gregorian_civil_day_v1'
    CHECK (comparison_domain = 'gregorian_civil_day_v1'),
  precision text NOT NULL CHECK (precision IN ('day', 'month', 'year', 'season', 'unknown', 'custom')),
  wording text CHECK (length(wording) <= 200),
  approximate boolean NOT NULL DEFAULT false,
  year integer CHECK (year BETWEEN 1 AND 9999),
  month integer CHECK (month BETWEEN 1 AND 12),
  day integer CHECK (day BETWEEN 1 AND 31),
  season text CHECK (season IN ('spring', 'summer', 'autumn', 'winter')),
  season_hemisphere text CHECK (season_hemisphere IN ('northern', 'southern')),
  placement_state text NOT NULL CHECK (placement_state IN ('resolved', 'unresolved')),
  earliest_day date CHECK (earliest_day BETWEEN DATE '0001-01-01' AND DATE '9999-12-31'),
  latest_day date CHECK (latest_day BETWEEN DATE '0001-01-01' AND DATE '9999-12-31'),
  PRIMARY KEY (revision_id, endpoint),
  FOREIGN KEY (revision_id, item_id, item_kind)
    REFERENCES timeline_draft.item_revision(id, item_id, kind),
  CHECK ((item_kind = 'person' AND endpoint = 'birth')
    OR (item_kind = 'event' AND endpoint IN ('start', 'end'))),
  CHECK (
    (placement_state = 'unresolved' AND earliest_day IS NULL AND latest_day IS NULL)
    OR (placement_state = 'resolved' AND earliest_day IS NOT NULL AND latest_day IS NOT NULL
      AND earliest_day <= latest_day)
  ),
  CHECK (
    (precision = 'day' AND year IS NOT NULL AND month IS NOT NULL AND day IS NOT NULL
      AND season IS NULL AND season_hemisphere IS NULL AND placement_state = 'resolved')
    OR (precision = 'month' AND year IS NOT NULL AND month IS NOT NULL AND day IS NULL
      AND season IS NULL AND season_hemisphere IS NULL AND placement_state = 'resolved')
    OR (precision = 'year' AND year IS NOT NULL AND month IS NULL AND day IS NULL
      AND season IS NULL AND season_hemisphere IS NULL AND placement_state = 'resolved')
    OR (precision = 'season' AND year IS NOT NULL AND month IS NULL AND day IS NULL
      AND season IS NOT NULL AND ((placement_state = 'resolved' AND season_hemisphere IS NOT NULL)
        OR (placement_state = 'unresolved' AND season_hemisphere IS NULL)))
    OR (precision = 'unknown' AND year IS NULL AND month IS NULL AND day IS NULL
      AND season IS NULL AND season_hemisphere IS NULL AND placement_state = 'unresolved')
    OR (precision = 'custom' AND wording IS NOT NULL AND length(btrim(wording)) > 0
      AND year IS NULL AND month IS NULL AND day IS NULL
      AND season IS NULL AND season_hemisphere IS NULL)
  ),
  CHECK (precision <> 'day' OR day <= CASE
    WHEN month = 2 THEN CASE WHEN year % 400 = 0 OR (year % 4 = 0 AND year % 100 <> 0) THEN 29 ELSE 28 END
    WHEN month IN (4, 6, 9, 11) THEN 30 ELSE 31 END)
);
-- Explicit, stable Gregorian-only calendar/domain. No BCE/year zero/fictional
-- engine. Authored components never use filler days. Derived DATE bounds remain
-- Gregorian coordinates, NOT occurrence dates. Exact derived bounds, seasonal
-- cross-year limits, span ordering and required endpoints still need SQL/TS RPC
-- validation; ongoing/unknown ends have no fabricated end endpoint.

CREATE TABLE timeline_draft.revision_person (
  event_revision_id uuid NOT NULL,
  event_item_id uuid NOT NULL,
  event_kind text GENERATED ALWAYS AS ('event'::text) STORED,
  person_revision_id uuid NOT NULL,
  person_item_id uuid NOT NULL,
  person_kind text GENERATED ALWAYS AS ('person'::text) STORED,
  role text CHECK (length(role) <= 100),
  PRIMARY KEY (event_revision_id, person_item_id),
  FOREIGN KEY (event_revision_id, event_item_id, event_kind)
    REFERENCES timeline_draft.item_revision(id, item_id, kind),
  FOREIGN KEY (person_revision_id, person_item_id, person_kind)
    REFERENCES timeline_draft.item_revision(id, item_id, kind)
);
-- People involved are facts, never placements or permission grants.
CREATE TABLE timeline_draft.revision_topic (
  event_revision_id uuid NOT NULL,
  event_item_id uuid NOT NULL,
  event_kind text GENERATED ALWAYS AS ('event'::text) STORED,
  owner_user_id uuid NOT NULL,
  topic_revision_id uuid NOT NULL,
  PRIMARY KEY (event_revision_id, topic_revision_id),
  FOREIGN KEY (event_revision_id, event_item_id, event_kind)
    REFERENCES timeline_draft.item_revision(id, item_id, kind),
  FOREIGN KEY (event_revision_id, event_item_id, owner_user_id)
    REFERENCES timeline_draft.item_revision(id, item_id, owner_user_id),
  FOREIGN KEY (topic_revision_id, owner_user_id)
    REFERENCES timeline_draft.topic_revision(id, owner_user_id)
);

CREATE TABLE timeline_draft.item_placement (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timeline_id uuid NOT NULL REFERENCES timeline_draft.timeline(id),
  item_id uuid NOT NULL,
  item_kind text NOT NULL,
  current_version integer NOT NULL DEFAULT 1 CHECK (current_version > 0),
  UNIQUE (timeline_id, item_id),
  UNIQUE (id, timeline_id, item_id),
  UNIQUE (id, timeline_id, item_kind),
  FOREIGN KEY (item_id, item_kind) REFERENCES timeline_draft.owner_item(id, kind)
);
CREATE TABLE timeline_draft.placement_revision (
  placement_id uuid NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  timeline_id uuid NOT NULL,
  item_id uuid NOT NULL,
  state text NOT NULL CHECK (state IN ('active', 'removed')),
  actor_user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (placement_id, version),
  UNIQUE (placement_id, version, timeline_id, item_id),
  FOREIGN KEY (placement_id, timeline_id, item_id)
    REFERENCES timeline_draft.item_placement(id, timeline_id, item_id)
);
ALTER TABLE timeline_draft.item_placement ADD CONSTRAINT placement_current_revision_fk
  FOREIGN KEY (id, current_version)
  REFERENCES timeline_draft.placement_revision(placement_id, version)
  DEFERRABLE INITIALLY DEFERRED;
-- Public placements must use that timeline owner's accepted representation;
-- creator-private additions deliberately need NOT have that timeline's owner.
-- Private authorized transfer views use the exact exception below, not a second
-- ordinary item placement with recipient editing authority.

CREATE TABLE timeline_draft.event_edge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timeline_id uuid NOT NULL REFERENCES timeline_draft.timeline(id),
  parent_placement_id uuid NOT NULL,
  child_placement_id uuid NOT NULL,
  event_kind text GENERATED ALWAYS AS ('event'::text) STORED,
  current_version integer NOT NULL DEFAULT 1 CHECK (current_version > 0),
  UNIQUE (timeline_id, parent_placement_id, child_placement_id),
  UNIQUE (id, timeline_id),
  FOREIGN KEY (parent_placement_id, timeline_id, event_kind)
    REFERENCES timeline_draft.item_placement(id, timeline_id, item_kind),
  FOREIGN KEY (child_placement_id, timeline_id, event_kind)
    REFERENCES timeline_draft.item_placement(id, timeline_id, item_kind),
  CHECK (parent_placement_id <> child_placement_id)
);
CREATE TABLE timeline_draft.edge_revision (
  edge_id uuid NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  timeline_id uuid NOT NULL,
  state text NOT NULL CHECK (state IN ('active', 'inactive')),
  actor_user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (edge_id, version),
  FOREIGN KEY (edge_id, timeline_id) REFERENCES timeline_draft.event_edge(id, timeline_id)
);
ALTER TABLE timeline_draft.event_edge ADD CONSTRAINT edge_current_revision_fk
  FOREIGN KEY (id, current_version) REFERENCES timeline_draft.edge_revision(edge_id, version)
  DEFERRABLE INITIALLY DEFERRED;
-- Multi-parent DAG, not a tree: unique edge/self CHECK only. Full cycle rejection
-- requires a future atomic RPC; no parent count/depth cap. Edges are presentation
-- context, not ownership. Removing a link is neither placement removal nor delete.

CREATE TABLE timeline_draft.item_attachment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timeline_id uuid NOT NULL REFERENCES timeline_draft.timeline(id),
  item_id uuid NOT NULL,
  item_kind text NOT NULL CHECK (item_kind IN ('note', 'media')),
  parent_event_item_id uuid NOT NULL,
  parent_kind text GENERATED ALWAYS AS ('event'::text) STORED,
  current_version integer NOT NULL DEFAULT 1 CHECK (current_version > 0),
  UNIQUE (timeline_id, item_id, parent_event_item_id),
  UNIQUE (id, timeline_id),
  FOREIGN KEY (item_id, item_kind) REFERENCES timeline_draft.owner_item(id, kind),
  FOREIGN KEY (parent_event_item_id, parent_kind) REFERENCES timeline_draft.owner_item(id, kind)
);
CREATE TABLE timeline_draft.attachment_revision (
  attachment_id uuid NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  timeline_id uuid NOT NULL,
  state text NOT NULL CHECK (state IN ('active', 'inactive')),
  actor_user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (attachment_id, version),
  FOREIGN KEY (attachment_id, timeline_id)
    REFERENCES timeline_draft.item_attachment(id, timeline_id)
);
ALTER TABLE timeline_draft.item_attachment ADD CONSTRAINT attachment_current_revision_fk
  FOREIGN KEY (id, current_version)
  REFERENCES timeline_draft.attachment_revision(attachment_id, version)
  DEFERRABLE INITIALLY DEFERRED;
-- Multiple notes per event, including multiple by one creator. Association can
-- go inactive without losing independently creator-private content. Membership,
-- parent/child audience and placement consistency need the future RPC. Orphan
-- reads must not follow historical links to hidden parent metadata.

CREATE TABLE timeline_draft.revision_lineage (
  revision_id uuid NOT NULL,
  item_id uuid NOT NULL,
  identity_id uuid NOT NULL,
  item_kind text NOT NULL,
  source_revision_id uuid NOT NULL,
  source_item_id uuid NOT NULL,
  relation text NOT NULL CHECK (relation IN ('previous', 'transfer', 'incoming', 'merge', 'origin')),
  PRIMARY KEY (revision_id, source_revision_id),
  FOREIGN KEY (revision_id, item_id, identity_id, item_kind)
    REFERENCES timeline_draft.item_revision(id, item_id, identity_id, kind),
  FOREIGN KEY (source_revision_id, source_item_id, identity_id, item_kind)
    REFERENCES timeline_draft.item_revision(id, item_id, identity_id, kind),
  CHECK (revision_id <> source_revision_id)
);
CREATE TABLE timeline_draft.accepted_authorship (
  revision_id uuid NOT NULL,
  item_id uuid NOT NULL,
  identity_id uuid NOT NULL,
  item_kind text NOT NULL,
  author_user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  source_revision_id uuid NOT NULL,
  source_item_id uuid NOT NULL,
  contribution_kind text NOT NULL CHECK (contribution_kind IN ('creation', 'edit')),
  PRIMARY KEY (revision_id, author_user_id, source_revision_id),
  UNIQUE (revision_id, author_user_id, source_revision_id, contribution_kind),
  FOREIGN KEY (revision_id, item_id, identity_id, item_kind)
    REFERENCES timeline_draft.item_revision(id, item_id, identity_id, kind),
  FOREIGN KEY (source_revision_id, source_item_id, identity_id, item_kind)
    REFERENCES timeline_draft.item_revision(id, item_id, identity_id, kind)
);
-- Multiple original/upstream authors, distinct from revision.actor and outgoing
-- owner. Retain all accepted edits incl superseded edits for consent eligibility;
-- neither this history nor a pending proposal itself confers current authority.

CREATE TABLE timeline_draft.owner_review_action (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timeline_id uuid NOT NULL REFERENCES timeline_draft.timeline(id),
  contributor_user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  authorized_by_owner_user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  action text NOT NULL CHECK (action IN ('promotion', 'explicit_backlog_accept')),
  expected_timeline_version integer NOT NULL CHECK (expected_timeline_version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, timeline_id),
  UNIQUE (id, timeline_id, contributor_user_id, action, authorized_by_owner_user_id)
);
-- Promotion authorizes eligible backlog automatically. Trust-only does not.
-- A project-wide batch records one action per actually authorized timeline.

CREATE TABLE timeline_draft.proposal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timeline_id uuid NOT NULL REFERENCES timeline_draft.timeline(id),
  contributor_user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  current_submitted_revision_id uuid,
  state text NOT NULL DEFAULT 'pending'
    CHECK (state IN ('pending', 'accepted', 'declined', 'cancelled', 'outdated')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, timeline_id),
  UNIQUE (id, timeline_id, contributor_user_id)
);
-- Shared queue is derived from current owner + authorized co-authors, NEVER a
-- single reviewer ID. Role downgrade/removal has no cascade to this request.
CREATE TABLE timeline_draft.proposal_revision (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL,
  timeline_id uuid NOT NULL,
  sequence integer NOT NULL CHECK (sequence > 0),
  submitted_by_user_id uuid NOT NULL,
  operation text NOT NULL CHECK (operation IN ('add', 'edit', 'replace_media')),
  target_kind text NOT NULL CHECK (target_kind IN ('person', 'event', 'note', 'media')),
  target_item_id uuid,
  expected_target_revision_id uuid,
  proposed_identity_id uuid,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  review_context jsonb NOT NULL CHECK (jsonb_typeof(review_context) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (proposal_id, sequence),
  UNIQUE (id, proposal_id, timeline_id),
  FOREIGN KEY (proposal_id, timeline_id, submitted_by_user_id)
    REFERENCES timeline_draft.proposal(id, timeline_id, contributor_user_id),
  FOREIGN KEY (expected_target_revision_id, target_item_id, target_kind)
    REFERENCES timeline_draft.item_revision(id, item_id, kind),
  FOREIGN KEY (proposed_identity_id, target_kind) REFERENCES timeline_draft.item_identity(id, kind),
  CHECK ((operation = 'add' AND target_item_id IS NULL
      AND expected_target_revision_id IS NULL AND proposed_identity_id IS NOT NULL)
    OR (operation IN ('edit', 'replace_media') AND target_item_id IS NOT NULL
      AND expected_target_revision_id IS NOT NULL AND proposed_identity_id IS NULL)),
  CHECK (operation <> 'replace_media' OR target_kind = 'media')
);
ALTER TABLE timeline_draft.proposal ADD CONSTRAINT proposal_current_revision_fk
  FOREIGN KEY (current_submitted_revision_id, id, timeline_id)
  REFERENCES timeline_draft.proposal_revision(id, proposal_id, timeline_id)
  DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE timeline_draft.proposal_decision (
  proposal_id uuid PRIMARY KEY,
  timeline_id uuid NOT NULL,
  contributor_user_id uuid NOT NULL,
  reviewed_revision_id uuid NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('accepted', 'declined', 'cancelled', 'outdated')),
  actor_user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  mode text NOT NULL CHECK (mode IN ('manual', 'trusted', 'promotion', 'explicit_backlog_accept', 'cancel', 'outdated')),
  owner_action_id uuid,
  applied_revision_id uuid,
  applied_item_id uuid,
  applied_kind text,
  decided_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (reviewed_revision_id, proposal_id, timeline_id)
    REFERENCES timeline_draft.proposal_revision(id, proposal_id, timeline_id),
  FOREIGN KEY (proposal_id, timeline_id, contributor_user_id)
    REFERENCES timeline_draft.proposal(id, timeline_id, contributor_user_id),
  FOREIGN KEY (owner_action_id, timeline_id, contributor_user_id, mode, actor_user_id)
    REFERENCES timeline_draft.owner_review_action(id, timeline_id, contributor_user_id, action, authorized_by_owner_user_id),
  FOREIGN KEY (applied_revision_id, applied_item_id, applied_kind)
    REFERENCES timeline_draft.item_revision(id, item_id, kind),
  CHECK ((mode IN ('promotion', 'explicit_backlog_accept')) = (owner_action_id IS NOT NULL)),
  CHECK ((mode = 'cancel') = (outcome = 'cancelled')),
  CHECK ((mode = 'outdated') = (outcome = 'outdated')),
  CHECK (mode NOT IN ('trusted', 'promotion', 'explicit_backlog_accept') OR outcome = 'accepted'),
  CHECK (mode <> 'manual' OR outcome <> 'accepted' OR actor_user_id <> contributor_user_id),
  CHECK ((outcome = 'accepted' AND applied_revision_id IS NOT NULL
      AND applied_item_id IS NOT NULL AND applied_kind IS NOT NULL)
    OR (outcome <> 'accepted' AND applied_revision_id IS NULL
      AND applied_item_id IS NULL AND applied_kind IS NULL))
);
-- One immutable terminal row, exact request revision. RPC still must serialize
-- against pointer edits, validate target/current versions/actor and apply content
-- atomically; the PK alone is NOT a first-valid-decision workflow implementation.

CREATE TABLE timeline_draft.consent_request (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL,
  item_kind text NOT NULL,
  initiated_by_user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  current_revision_id uuid,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'applied', 'cancelled', 'outdated')),
  UNIQUE (id, item_id, item_kind),
  FOREIGN KEY (item_id, item_kind) REFERENCES timeline_draft.owner_item(id, kind)
);
CREATE TABLE timeline_draft.consent_revision (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL,
  item_id uuid NOT NULL,
  item_kind text NOT NULL,
  sequence integer NOT NULL CHECK (sequence > 0),
  exact_content_revision_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('privatize', 'trash', 'permanent_delete', 'remove_placements')),
  initiated_at timestamptz NOT NULL DEFAULT now(),
  nonresponse_override_after timestamptz NOT NULL,
  eligibility_checked_at timestamptz NOT NULL,
  UNIQUE (request_id, sequence),
  UNIQUE (id, request_id),
  UNIQUE (id, item_id),
  FOREIGN KEY (request_id, item_id, item_kind)
    REFERENCES timeline_draft.consent_request(id, item_id, item_kind),
  FOREIGN KEY (exact_content_revision_id, item_id, item_kind)
    REFERENCES timeline_draft.item_revision(id, item_id, kind),
  CHECK (nonresponse_override_after = initiated_at + interval '3 days')
);
ALTER TABLE timeline_draft.consent_request ADD CONSTRAINT consent_current_revision_fk
  FOREIGN KEY (current_revision_id, id) REFERENCES timeline_draft.consent_revision(id, request_id)
  DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE timeline_draft.consent_placement (
  consent_revision_id uuid NOT NULL,
  item_id uuid NOT NULL,
  placement_id uuid NOT NULL,
  placement_version integer NOT NULL,
  timeline_id uuid NOT NULL,
  PRIMARY KEY (consent_revision_id, placement_id),
  FOREIGN KEY (consent_revision_id, item_id) REFERENCES timeline_draft.consent_revision(id, item_id),
  FOREIGN KEY (placement_id, placement_version, timeline_id, item_id)
    REFERENCES timeline_draft.placement_revision(placement_id, version, timeline_id, item_id)
);
CREATE TABLE timeline_draft.consent_eligibility (
  consent_revision_id uuid NOT NULL REFERENCES timeline_draft.consent_revision(id),
  user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  timeline_id uuid NOT NULL REFERENCES timeline_draft.timeline(id),
  role_at_check text NOT NULL CHECK (role_at_check IN ('co_author', 'contributor')),
  accepted_work_revision_id uuid NOT NULL,
  attribution_source_revision_id uuid NOT NULL,
  attribution_kind text NOT NULL CHECK (attribution_kind IN ('creation', 'edit')),
  item_id uuid NOT NULL,
  item_kind text NOT NULL,
  checked_at timestamptz NOT NULL,
  PRIMARY KEY (consent_revision_id, user_id, timeline_id),
  UNIQUE (consent_revision_id, user_id, timeline_id, item_id),
  FOREIGN KEY (consent_revision_id, item_id) REFERENCES timeline_draft.consent_revision(id, item_id),
  FOREIGN KEY (accepted_work_revision_id, item_id, item_kind)
    REFERENCES timeline_draft.item_revision(id, item_id, kind),
  FOREIGN KEY (accepted_work_revision_id, user_id, attribution_source_revision_id, attribution_kind)
    REFERENCES timeline_draft.accepted_authorship(revision_id, author_user_id, source_revision_id, contribution_kind)
);
-- Eligibility is a captured check, not permanent authority. RPC verifies accepted
-- authorship (including accepted creation-only work and upstream/superseded edits),
-- current role/access and scope. No later edit is needed to qualify accepted work.
-- Membership/material changes require a fresh request revision before application.
CREATE TABLE timeline_draft.consent_response (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consent_revision_id uuid NOT NULL,
  user_id uuid NOT NULL,
  timeline_id uuid NOT NULL,
  sequence integer NOT NULL CHECK (sequence > 0),
  response text NOT NULL CHECK (response IN ('approve', 'decline')),
  responded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (consent_revision_id, user_id, timeline_id, sequence),
  UNIQUE (id, consent_revision_id, user_id, timeline_id),
  UNIQUE (id, consent_revision_id, user_id, timeline_id, response),
  FOREIGN KEY (consent_revision_id, user_id, timeline_id)
    REFERENCES timeline_draft.consent_eligibility(consent_revision_id, user_id, timeline_id)
);
CREATE TABLE timeline_draft.consent_override (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consent_revision_id uuid NOT NULL,
  user_id uuid NOT NULL,
  timeline_id uuid NOT NULL,
  owner_actor_user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  reason text NOT NULL CHECK (reason IN ('explicit_decline', 'nonresponse_after_timeout')),
  response_id uuid,
  overridden_response text GENERATED ALWAYS AS ('decline'::text) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (consent_revision_id, user_id, timeline_id)
    REFERENCES timeline_draft.consent_eligibility(consent_revision_id, user_id, timeline_id),
  FOREIGN KEY (response_id, consent_revision_id, user_id, timeline_id, overridden_response)
    REFERENCES timeline_draft.consent_response(id, consent_revision_id, user_id, timeline_id, response),
  CHECK ((reason = 'explicit_decline') = (response_id IS NOT NULL))
);
CREATE TABLE timeline_draft.consent_outcome (
  request_id uuid PRIMARY KEY,
  consent_revision_id uuid NOT NULL,
  actor_user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  outcome text NOT NULL CHECK (outcome IN ('applied', 'cancelled', 'outdated')),
  decided_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (consent_revision_id, request_id)
    REFERENCES timeline_draft.consent_revision(id, request_id)
);
-- No timeout executes anything. An explicit decline may be owner-overridden
-- immediately; nonresponse only after 3 days. Overrides cannot authorize private
-- transfer/retention. Privacy initiation is creator-only; shared deletion may be
-- initiated by Owner/authorized Co-Author. These actor/time rules need RPC.
-- RPC also rechecks the latest response; a scoped historical decline alone does
-- not establish the editor's current response or the owner's current authority.

CREATE TABLE timeline_draft.timeline_transfer (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timeline_id uuid NOT NULL REFERENCES timeline_draft.timeline(id),
  sender_user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  recipient_user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  expected_timeline_version integer NOT NULL CHECK (expected_timeline_version > 0),
  manifest_version integer NOT NULL DEFAULT 1 CHECK (manifest_version > 0),
  status text NOT NULL CHECK (status IN ('proposed', 'confirmed', 'committed', 'declined', 'cancelled')),
  recipient_confirmed_manifest_version integer,
  recipient_confirmed_at timestamptz,
  project_choice text CHECK (project_choice IN ('keep', 'remove', 'not_in_project')),
  committed_at timestamptz,
  sender_snapshot_id uuid,
  UNIQUE (id, timeline_id),
  UNIQUE (id, sender_user_id),
  UNIQUE (id, recipient_user_id),
  CHECK (sender_user_id <> recipient_user_id),
  CHECK ((recipient_confirmed_at IS NULL) = (recipient_confirmed_manifest_version IS NULL)),
  CHECK (status NOT IN ('confirmed', 'committed') OR
    (recipient_confirmed_at IS NOT NULL AND recipient_confirmed_manifest_version = manifest_version
      AND project_choice IS NOT NULL)),
  CHECK ((status = 'committed') = (committed_at IS NOT NULL)),
  CHECK ((status = 'committed') = (sender_snapshot_id IS NOT NULL))
);
CREATE UNIQUE INDEX one_open_timeline_transfer ON timeline_draft.timeline_transfer(timeline_id)
  WHERE status IN ('proposed', 'confirmed');

CREATE TABLE timeline_draft.snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('sender_archive', 'revocation_grant')),
  source_timeline_id uuid NOT NULL REFERENCES timeline_draft.timeline(id),
  beneficiary_user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  authorized_by_owner_user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  source_timeline_version integer NOT NULL CHECK (source_timeline_version > 0),
  transfer_id uuid,
  frozen_at timestamptz NOT NULL,
  irrevocable boolean NOT NULL DEFAULT true CHECK (irrevocable),
  read_only boolean NOT NULL DEFAULT true CHECK (read_only),
  export_mode text NOT NULL CHECK (export_mode IN ('not_specified', 'no_export')),
  retained_timeline_document jsonb NOT NULL CHECK (jsonb_typeof(retained_timeline_document) = 'object'),
  UNIQUE (id, source_timeline_id),
  UNIQUE (id, beneficiary_user_id),
  UNIQUE (id, transfer_id, beneficiary_user_id),
  FOREIGN KEY (transfer_id, source_timeline_id)
    REFERENCES timeline_draft.timeline_transfer(id, timeline_id),
  FOREIGN KEY (transfer_id, beneficiary_user_id)
    REFERENCES timeline_draft.timeline_transfer(id, sender_user_id),
  CHECK ((kind = 'sender_archive' AND transfer_id IS NOT NULL AND export_mode = 'not_specified')
    OR (kind = 'revocation_grant' AND transfer_id IS NULL AND export_mode = 'no_export'))
);
ALTER TABLE timeline_draft.timeline_transfer ADD CONSTRAINT transfer_sender_archive_fk
  FOREIGN KEY (sender_snapshot_id, id, sender_user_id)
  REFERENCES timeline_draft.snapshot(id, transfer_id, beneficiary_user_id)
  DEFERRABLE INITIALLY DEFERRED;
-- Always frozen at handover; no settling state/captured pending proposals.
-- Sender-archive export is undecided; this is not an implicit export grant.

CREATE TABLE timeline_draft.private_inclusion_authorization (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  authorized_by_user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  destination_kind text NOT NULL CHECK (destination_kind IN ('transfer_read', 'frozen_retention')),
  beneficiary_user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  transfer_id uuid,
  snapshot_id uuid,
  selection_mode text NOT NULL CHECK (selection_mode IN ('exclude_all', 'include_all', 'specific')),
  authorized_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, creator_user_id),
  UNIQUE (id, destination_kind, beneficiary_user_id, transfer_id),
  UNIQUE (id, destination_kind, beneficiary_user_id, snapshot_id),
  FOREIGN KEY (transfer_id, beneficiary_user_id)
    REFERENCES timeline_draft.timeline_transfer(id, recipient_user_id),
  FOREIGN KEY (snapshot_id, beneficiary_user_id)
    REFERENCES timeline_draft.snapshot(id, beneficiary_user_id),
  CHECK (authorized_by_user_id = creator_user_id),
  CHECK ((destination_kind = 'transfer_read' AND transfer_id IS NOT NULL AND snapshot_id IS NULL)
    OR (destination_kind = 'frozen_retention' AND snapshot_id IS NOT NULL AND transfer_id IS NULL))
);
CREATE UNIQUE INDEX one_private_transfer_choice_per_creator
  ON timeline_draft.private_inclusion_authorization(creator_user_id, transfer_id)
  WHERE transfer_id IS NOT NULL;
CREATE UNIQUE INDEX one_private_snapshot_choice_per_creator
  ON timeline_draft.private_inclusion_authorization(creator_user_id, snapshot_id)
  WHERE snapshot_id IS NOT NULL;
-- Authorization is per destination, creator and EXISTING exact revision set.
-- include_all means the materialized inventory below, NOT future private items.
-- REQUIRED future RPC: exclude_all has NO private_inclusion_item rows, and no
-- private-read manifest or private snapshot item may use exclude_all. Only the
-- creator's explicit include_all/specific exact inventory authorizes inclusion;
-- unique destination choices prevent contradictory include/exclude headers.
CREATE TABLE timeline_draft.private_inclusion_item (
  authorization_id uuid NOT NULL,
  creator_user_id uuid NOT NULL,
  source_item_id uuid NOT NULL,
  source_identity_id uuid NOT NULL,
  source_kind text NOT NULL,
  source_revision_id uuid NOT NULL,
  source_visibility text GENERATED ALWAYS AS ('private'::text) STORED,
  PRIMARY KEY (authorization_id, source_item_id),
  UNIQUE (authorization_id, source_item_id, source_revision_id),
  FOREIGN KEY (authorization_id, creator_user_id)
    REFERENCES timeline_draft.private_inclusion_authorization(id, creator_user_id),
  FOREIGN KEY (source_identity_id, creator_user_id)
    REFERENCES timeline_draft.item_identity(id, creator_user_id),
  FOREIGN KEY (source_revision_id, source_item_id, source_identity_id, source_kind)
    REFERENCES timeline_draft.item_revision(id, item_id, identity_id, kind),
  FOREIGN KEY (source_revision_id, source_item_id, source_visibility)
    REFERENCES timeline_draft.item_revision(id, item_id, visibility)
);
-- No response produces no authorization. Owner override is NOT an alternative.
-- No ordinary live private-item grants exist in this schema.

CREATE TABLE timeline_draft.snapshot_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id uuid NOT NULL REFERENCES timeline_draft.snapshot(id),
  source_item_id uuid NOT NULL,
  source_identity_id uuid NOT NULL,
  source_revision_id uuid NOT NULL,
  item_kind text NOT NULL CHECK (item_kind IN ('person', 'event', 'note', 'media')),
  visibility text NOT NULL CHECK (visibility IN ('private', 'shared')),
  beneficiary_user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  private_authorization_id uuid,
  private_destination text GENERATED ALWAYS AS ('frozen_retention'::text) STORED,
  retained_schema_version integer NOT NULL CHECK (retained_schema_version > 0),
  retained_document jsonb NOT NULL CHECK (jsonb_typeof(retained_document) = 'object'),
  UNIQUE (snapshot_id, source_item_id),
  UNIQUE (id, snapshot_id),
  UNIQUE (id, snapshot_id, item_kind),
  UNIQUE (id, source_item_id, source_identity_id, source_revision_id, item_kind),
  UNIQUE (id, source_item_id, source_revision_id, visibility),
  FOREIGN KEY (snapshot_id, beneficiary_user_id)
    REFERENCES timeline_draft.snapshot(id, beneficiary_user_id),
  FOREIGN KEY (private_authorization_id, source_item_id, source_revision_id)
    REFERENCES timeline_draft.private_inclusion_item(authorization_id, source_item_id, source_revision_id),
  FOREIGN KEY (private_authorization_id, private_destination, beneficiary_user_id, snapshot_id)
    REFERENCES timeline_draft.private_inclusion_authorization(id, destination_kind, beneficiary_user_id, snapshot_id),
  CHECK ((visibility = 'private') = (private_authorization_id IS NOT NULL))
);
-- Retained document is an independently stored, exact frozen content/metadata/
-- authored-date/attribution envelope, not a URL/pointer to mutable source data.
-- Its complete versioned contract and correspondence to source need future RPC.
-- Provenance UUIDs above intentionally survive live purge without a live FK.
-- REQUIRED AT FREEZE (future transactional RPC): EVERY snapshot_item must have
-- an exact, visibility-matching snapshot_revision_reference. Without this
-- aggregate check a private source could be mislabeled shared to evade consent.
-- The same RPC must validate the complete authorized frozen copy: content,
-- authored dates, provenance/accepted history, Person/place/topic metadata, assets,
-- placements, note/media associations and included parent relationships. Never
-- fetch missing frozen metadata from later live revisions or hidden contexts.
-- Completeness and authorization of copied JSON/assets are NOT implemented here.
CREATE TABLE timeline_draft.snapshot_revision_reference (
  snapshot_item_id uuid PRIMARY KEY,
  source_item_id uuid NOT NULL,
  source_identity_id uuid NOT NULL,
  source_revision_id uuid NOT NULL,
  item_kind text NOT NULL,
  visibility text NOT NULL,
  FOREIGN KEY (snapshot_item_id, source_item_id, source_identity_id, source_revision_id, item_kind)
    REFERENCES timeline_draft.snapshot_item(id, source_item_id, source_identity_id, source_revision_id, item_kind),
  FOREIGN KEY (source_revision_id, source_item_id, source_identity_id, item_kind)
    REFERENCES timeline_draft.item_revision(id, item_id, identity_id, kind),
  FOREIGN KEY (snapshot_item_id, source_item_id, source_revision_id, visibility)
    REFERENCES timeline_draft.snapshot_item(id, source_item_id, source_revision_id, visibility),
  FOREIGN KEY (source_revision_id, source_item_id, visibility)
    REFERENCES timeline_draft.item_revision(id, item_id, visibility)
);
-- Removable only by the future validated purge protocol after verifying the
-- independently retained copy. Ordinary source deletion cannot remove a snapshot.
-- After freeze, ONLY that reviewed purge protocol may remove this link; normal
-- writes may neither omit it at freeze nor replace/remove it to evade validation.
CREATE TABLE timeline_draft.snapshot_placement (
  snapshot_id uuid NOT NULL,
  snapshot_item_id uuid NOT NULL,
  source_placement_id uuid NOT NULL,
  source_placement_version integer NOT NULL CHECK (source_placement_version > 0),
  PRIMARY KEY (snapshot_id, source_placement_id),
  FOREIGN KEY (snapshot_item_id, snapshot_id) REFERENCES timeline_draft.snapshot_item(id, snapshot_id)
);
CREATE TABLE timeline_draft.snapshot_edge (
  snapshot_id uuid NOT NULL REFERENCES timeline_draft.snapshot(id),
  parent_snapshot_item_id uuid NOT NULL,
  child_snapshot_item_id uuid NOT NULL,
  source_edge_id uuid NOT NULL,
  source_edge_version integer NOT NULL CHECK (source_edge_version > 0),
  event_kind text GENERATED ALWAYS AS ('event'::text) STORED,
  PRIMARY KEY (snapshot_id, source_edge_id),
  FOREIGN KEY (parent_snapshot_item_id, snapshot_id, event_kind)
    REFERENCES timeline_draft.snapshot_item(id, snapshot_id, item_kind),
  FOREIGN KEY (child_snapshot_item_id, snapshot_id, event_kind)
    REFERENCES timeline_draft.snapshot_item(id, snapshot_id, item_kind),
  CHECK (parent_snapshot_item_id <> child_snapshot_item_id)
);
CREATE TABLE timeline_draft.snapshot_asset (
  snapshot_id uuid NOT NULL,
  snapshot_item_id uuid NOT NULL,
  asset_id uuid NOT NULL REFERENCES timeline_draft.media_asset(id),
  media_kind text GENERATED ALWAYS AS ('media'::text) STORED,
  PRIMARY KEY (snapshot_item_id, asset_id),
  FOREIGN KEY (snapshot_item_id, snapshot_id, media_kind)
    REFERENCES timeline_draft.snapshot_item(id, snapshot_id, item_kind)
);
-- Snapshot edges include ONLY authorized included events; absent parents yield
-- independent entries. Asset references protect immutable blobs independently.

CREATE TABLE timeline_draft.transfer_manifest (
  transfer_id uuid NOT NULL,
  manifest_version integer NOT NULL CHECK (manifest_version > 0),
  timeline_id uuid NOT NULL,
  placement_id uuid NOT NULL,
  placement_version integer NOT NULL,
  source_item_id uuid NOT NULL,
  source_identity_id uuid NOT NULL,
  source_kind text NOT NULL,
  source_revision_id uuid NOT NULL,
  visibility text NOT NULL CHECK (visibility IN ('private', 'shared')),
  disposition text NOT NULL CHECK (disposition IN ('mandatory_shared', 'private_excluded', 'private_read')),
  recipient_user_id uuid NOT NULL,
  recipient_private_authorization_id uuid,
  private_destination text GENERATED ALWAYS AS ('transfer_read'::text) STORED,
  recipient_item_id uuid,
  recipient_revision_id uuid,
  PRIMARY KEY (transfer_id, manifest_version, placement_id),
  FOREIGN KEY (transfer_id, timeline_id) REFERENCES timeline_draft.timeline_transfer(id, timeline_id),
  FOREIGN KEY (transfer_id, recipient_user_id) REFERENCES timeline_draft.timeline_transfer(id, recipient_user_id),
  FOREIGN KEY (placement_id, placement_version, timeline_id, source_item_id)
    REFERENCES timeline_draft.placement_revision(placement_id, version, timeline_id, item_id),
  FOREIGN KEY (source_revision_id, source_item_id, source_identity_id, source_kind)
    REFERENCES timeline_draft.item_revision(id, item_id, identity_id, kind),
  FOREIGN KEY (source_revision_id, source_item_id, visibility)
    REFERENCES timeline_draft.item_revision(id, item_id, visibility),
  FOREIGN KEY (recipient_revision_id, recipient_item_id, source_identity_id, source_kind)
    REFERENCES timeline_draft.item_revision(id, item_id, identity_id, kind),
  FOREIGN KEY (recipient_item_id, recipient_user_id)
    REFERENCES timeline_draft.owner_item(id, owner_user_id),
  FOREIGN KEY (recipient_private_authorization_id, source_item_id, source_revision_id)
    REFERENCES timeline_draft.private_inclusion_item(authorization_id, source_item_id, source_revision_id),
  FOREIGN KEY (recipient_private_authorization_id, private_destination, recipient_user_id, transfer_id)
    REFERENCES timeline_draft.private_inclusion_authorization(id, destination_kind, beneficiary_user_id, transfer_id),
  CHECK ((recipient_item_id IS NULL) = (recipient_revision_id IS NULL)),
  CHECK (
    (visibility = 'shared' AND disposition = 'mandatory_shared'
      AND recipient_private_authorization_id IS NULL AND recipient_item_id IS NOT NULL)
    OR (visibility = 'private' AND disposition = 'private_excluded' AND recipient_private_authorization_id IS NULL
      AND recipient_item_id IS NULL)
    OR (visibility = 'private' AND disposition = 'private_read' AND recipient_private_authorization_id IS NOT NULL
      AND recipient_item_id IS NULL)
  )
);
-- Inventory EVERY current placement, not selective transfer of public content.
-- A shared row needs a staged recipient accepted representation; private-read rows
-- reference creator-owned exact content without a recipient-owned editable copy.
-- Completeness, current manifest/version, pending-proposal gate, private visibility
-- truth and immutable confirmed-manifest semantics require the transfer RPC.
-- Private reads remain limited to the exact authorized revisions, not later edits.

CREATE TABLE timeline_draft.transfer_role_confirmation (
  transfer_id uuid NOT NULL REFERENCES timeline_draft.timeline_transfer(id),
  manifest_version integer NOT NULL CHECK (manifest_version > 0),
  user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  selection_scope text NOT NULL CHECK (selection_scope IN ('current_collaborator', 'future_role_selection')),
  confirmed_role text CHECK (confirmed_role IN ('co_author', 'contributor', 'reviewer')),
  decision text NOT NULL CHECK (decision IN ('continue', 'remove', 'record_for_later')),
  confirmed_by_recipient_user_id uuid NOT NULL,
  confirmed_at timestamptz NOT NULL,
  PRIMARY KEY (transfer_id, manifest_version, user_id, selection_scope),
  FOREIGN KEY (transfer_id, confirmed_by_recipient_user_id)
    REFERENCES timeline_draft.timeline_transfer(id, recipient_user_id),
  CHECK (
    (selection_scope = 'current_collaborator' AND
      ((decision = 'continue' AND confirmed_role IS NOT NULL)
        OR (decision = 'remove' AND confirmed_role IS NULL)))
    OR (selection_scope = 'future_role_selection' AND decision = 'record_for_later' AND confirmed_role IS NOT NULL)
  )
);
-- Future selections are records, not unchecked carried-over invitations/grants.
-- Transfer RPC rechecks all current roles, versions, recipient and project choice.

CREATE TABLE timeline_draft.update_relationship (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id uuid NOT NULL,
  item_kind text NOT NULL,
  source_item_id uuid NOT NULL,
  source_owner_user_id uuid NOT NULL,
  destination_item_id uuid NOT NULL,
  destination_owner_user_id uuid NOT NULL,
  source_baseline_revision_id uuid NOT NULL,
  destination_baseline_revision_id uuid NOT NULL,
  state text NOT NULL CHECK (state IN ('active', 'paused_conflict', 'paused_ambiguous', 'revoked', 'catchup_required')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  known_revoked_at timestamptz,
  UNIQUE (source_item_id, destination_item_id),
  UNIQUE (id, source_item_id, destination_item_id, identity_id, item_kind),
  UNIQUE (id, destination_item_id, destination_owner_user_id),
  FOREIGN KEY (source_item_id, identity_id, item_kind, source_owner_user_id)
    REFERENCES timeline_draft.owner_item(id, identity_id, kind, owner_user_id),
  FOREIGN KEY (destination_item_id, identity_id, item_kind, destination_owner_user_id)
    REFERENCES timeline_draft.owner_item(id, identity_id, kind, owner_user_id),
  FOREIGN KEY (source_baseline_revision_id, source_item_id, identity_id, item_kind)
    REFERENCES timeline_draft.item_revision(id, item_id, identity_id, kind),
  FOREIGN KEY (destination_baseline_revision_id, destination_item_id, identity_id, item_kind)
    REFERENCES timeline_draft.item_revision(id, item_id, identity_id, kind),
  CHECK (source_item_id <> destination_item_id),
  CHECK (source_owner_user_id <> destination_owner_user_id),
  CHECK (state <> 'revoked' OR known_revoked_at IS NOT NULL)
);
-- Relationship/baseline is provenance, NOT another permission switch or grant.
-- Source OWNER's current destination role governs outgoing accepted changes;
-- author/actor identities remain distinct. Restore access => explicit catch-up.

CREATE TABLE timeline_draft.update_delivery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id uuid NOT NULL,
  source_item_id uuid NOT NULL,
  destination_item_id uuid NOT NULL,
  destination_owner_user_id uuid NOT NULL,
  identity_id uuid NOT NULL,
  item_kind text NOT NULL,
  incoming_revision_id uuid NOT NULL,
  source_baseline_revision_id uuid NOT NULL,
  destination_baseline_revision_id uuid NOT NULL,
  expected_destination_revision_id uuid NOT NULL,
  route_timeline_id uuid NOT NULL,
  expected_relationship_version integer NOT NULL CHECK (expected_relationship_version > 0),
  routed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, destination_item_id, identity_id, item_kind),
  UNIQUE (id, route_timeline_id),
  FOREIGN KEY (relationship_id, source_item_id, destination_item_id, identity_id, item_kind)
    REFERENCES timeline_draft.update_relationship(id, source_item_id, destination_item_id, identity_id, item_kind),
  FOREIGN KEY (relationship_id, destination_item_id, destination_owner_user_id)
    REFERENCES timeline_draft.update_relationship(id, destination_item_id, destination_owner_user_id),
  FOREIGN KEY (route_timeline_id, destination_owner_user_id)
    REFERENCES timeline_draft.timeline(id, owner_user_id),
  FOREIGN KEY (incoming_revision_id, source_item_id, identity_id, item_kind)
    REFERENCES timeline_draft.item_revision(id, item_id, identity_id, kind),
  FOREIGN KEY (source_baseline_revision_id, source_item_id, identity_id, item_kind)
    REFERENCES timeline_draft.item_revision(id, item_id, identity_id, kind),
  FOREIGN KEY (destination_baseline_revision_id, destination_item_id, identity_id, item_kind)
    REFERENCES timeline_draft.item_revision(id, item_id, identity_id, kind),
  FOREIGN KEY (expected_destination_revision_id, destination_item_id, identity_id, item_kind)
    REFERENCES timeline_draft.item_revision(id, item_id, identity_id, kind)
);
CREATE TABLE timeline_draft.update_receipt (
  delivery_id uuid PRIMARY KEY,
  destination_item_id uuid NOT NULL,
  identity_id uuid NOT NULL,
  item_kind text NOT NULL,
  outcome text NOT NULL CHECK (outcome IN
    ('applied', 'proposed', 'declined', 'duplicate', 'paused_conflict', 'paused_ambiguous',
     'blocked_revoked', 'blocked_role', 'outdated', 'catchup_required', 'kept_local')),
  proposal_id uuid,
  proposal_revision_id uuid,
  proposal_timeline_id uuid,
  result_revision_id uuid,
  actor_user_id uuid REFERENCES timeline_draft.app_user(id),
  decided_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (delivery_id, destination_item_id, identity_id, item_kind),
  FOREIGN KEY (delivery_id, destination_item_id, identity_id, item_kind)
    REFERENCES timeline_draft.update_delivery(id, destination_item_id, identity_id, item_kind),
  FOREIGN KEY (proposal_revision_id, proposal_id, proposal_timeline_id)
    REFERENCES timeline_draft.proposal_revision(id, proposal_id, timeline_id),
  FOREIGN KEY (delivery_id, proposal_timeline_id)
    REFERENCES timeline_draft.update_delivery(id, route_timeline_id),
  FOREIGN KEY (result_revision_id, destination_item_id, identity_id, item_kind)
    REFERENCES timeline_draft.item_revision(id, item_id, identity_id, kind),
  CHECK ((outcome = 'proposed' AND proposal_id IS NOT NULL AND proposal_revision_id IS NOT NULL
      AND proposal_timeline_id IS NOT NULL)
    OR (outcome <> 'proposed' AND proposal_id IS NULL AND proposal_revision_id IS NULL AND proposal_timeline_id IS NULL)),
  CHECK ((outcome = 'applied') = (result_revision_id IS NOT NULL))
);
-- An immutable attempt outcome. A proposed attempt's eventual terminal decision
-- is proposal_decision; it does not mutate this receipt.
CREATE TABLE timeline_draft.update_revision_disposition (
  destination_item_id uuid NOT NULL,
  identity_id uuid NOT NULL,
  item_kind text NOT NULL,
  origin_revision_id uuid NOT NULL,
  origin_item_id uuid NOT NULL,
  disposition text NOT NULL CHECK (disposition IN ('applied', 'declined', 'kept_local')),
  delivery_id uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (destination_item_id, origin_revision_id),
  FOREIGN KEY (origin_revision_id, origin_item_id, identity_id, item_kind)
    REFERENCES timeline_draft.item_revision(id, item_id, identity_id, kind),
  FOREIGN KEY (delivery_id, destination_item_id, identity_id, item_kind)
    REFERENCES timeline_draft.update_receipt(delivery_id, destination_item_id, identity_id, item_kind)
);
-- Key is independent of route/source-forwarder. Record all carried upstream
-- origins on application/decline to suppress alternate-route/round-trip replay.
-- Lineage closure and new-vs-same revision checks must be computed atomically.
CREATE TABLE timeline_draft.update_reconciliation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL,
  destination_item_id uuid NOT NULL,
  identity_id uuid NOT NULL,
  item_kind text NOT NULL,
  current_destination_revision_id uuid NOT NULL,
  choice text NOT NULL CHECK (choice IN ('keep', 'accept', 'combine')),
  actor_user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  result_revision_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (delivery_id, destination_item_id, identity_id, item_kind)
    REFERENCES timeline_draft.update_delivery(id, destination_item_id, identity_id, item_kind),
  FOREIGN KEY (current_destination_revision_id, destination_item_id, identity_id, item_kind)
    REFERENCES timeline_draft.item_revision(id, item_id, identity_id, kind),
  FOREIGN KEY (result_revision_id, destination_item_id, identity_id, item_kind)
    REFERENCES timeline_draft.item_revision(id, item_id, identity_id, kind),
  CHECK (choice <> 'keep' OR result_revision_id = current_destination_revision_id)
);
-- Baseline/current/incoming are preserved, never silently merged. A later
-- reconciliation is a separate action; automatic routes must stay paused on
-- conflicts even for Co-Authors/trust and must not bypass known revocation.

CREATE TABLE timeline_draft.item_deletion_marker (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL,
  identity_id uuid NOT NULL,
  owner_user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  last_revision_id uuid NOT NULL,
  actor_user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  action text NOT NULL CHECK (action IN ('trashed', 'restored', 'permanently_deleted', 'expired')),
  consent_request_id uuid,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
-- Minimal UUIDs/action/time, no content and deliberately no live content FKs.
-- A marker is NOT a purge implementation or permission. Keep enough minimal
-- dedup/removal identity to reject stale saves and incoming resurrection.

CREATE TABLE timeline_draft.mutation_receipt (
  actor_user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  request_id uuid NOT NULL,
  scope_kind text NOT NULL CHECK (scope_kind IN ('timeline', 'project', 'item')),
  timeline_id uuid REFERENCES timeline_draft.timeline(id),
  project_id uuid REFERENCES timeline_draft.project(id),
  item_id uuid REFERENCES timeline_draft.owner_item(id),
  fingerprint text NOT NULL CHECK (length(btrim(fingerprint)) > 0),
  acknowledged_result jsonb NOT NULL CHECK (jsonb_typeof(acknowledged_result) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (actor_user_id, request_id),
  CHECK (
    (scope_kind = 'timeline' AND timeline_id IS NOT NULL AND project_id IS NULL AND item_id IS NULL)
    OR (scope_kind = 'project' AND project_id IS NOT NULL AND timeline_id IS NULL AND item_id IS NULL)
    OR (scope_kind = 'item' AND item_id IS NOT NULL AND timeline_id IS NULL AND project_id IS NULL)
  )
);
CREATE TABLE timeline_draft.notification (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  actor_user_id uuid REFERENCES timeline_draft.app_user(id),
  type text NOT NULL CHECK (type IN
    ('proposal_submitted', 'proposal_accepted', 'consent_requested', 'consent_declined',
     'consent_overridden', 'transfer_requested', 'transfer_committed', 'project_owner_changed', 'snapshot_granted')),
  timeline_id uuid REFERENCES timeline_draft.timeline(id),
  project_id uuid REFERENCES timeline_draft.project(id),
  proposal_id uuid,
  consent_revision_id uuid REFERENCES timeline_draft.consent_revision(id),
  consent_override_id uuid REFERENCES timeline_draft.consent_override(id),
  transfer_id uuid,
  project_transfer_id uuid REFERENCES timeline_draft.project_transfer(id),
  snapshot_id uuid REFERENCES timeline_draft.snapshot(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  FOREIGN KEY (proposal_id, timeline_id) REFERENCES timeline_draft.proposal(id, timeline_id),
  FOREIGN KEY (transfer_id, timeline_id) REFERENCES timeline_draft.timeline_transfer(id, timeline_id),
  CHECK (proposal_id IS NULL OR timeline_id IS NOT NULL),
  CHECK (transfer_id IS NULL OR timeline_id IS NOT NULL)
);
-- In-app, content-free but still sensitive metadata. Policies must hide context
-- and counts from unauthorized recipients. No ordinary proposal decline/cancel/
-- outdated notification. Consent declines/overrides explicitly DO notify.

CREATE INDEX placement_item ON timeline_draft.item_placement(item_id, timeline_id);
CREATE INDEX item_creator ON timeline_draft.item_identity(creator_user_id, kind);
CREATE INDEX revision_owner ON timeline_draft.item_revision(owner_user_id, identity_id);
CREATE INDEX endpoint_order ON timeline_draft.date_endpoint(comparison_domain, earliest_day);
CREATE INDEX edge_children ON timeline_draft.event_edge(timeline_id, parent_placement_id);
CREATE INDEX edge_parents ON timeline_draft.event_edge(timeline_id, child_placement_id);
CREATE INDEX attachment_parent ON timeline_draft.item_attachment(parent_event_item_id);
CREATE INDEX proposal_queue ON timeline_draft.proposal(timeline_id, state, created_at);
CREATE INDEX media_retention ON timeline_draft.media_revision(asset_id);
CREATE INDEX snapshot_blob_retention ON timeline_draft.snapshot_asset(asset_id);
CREATE INDEX notification_inbox ON timeline_draft.notification(recipient_user_id, read_at, created_at);

-- This one generic guard is not a business-workflow RPC. Even database-owner
-- fixture updates/deletes/truncation of append-only content fail unless deliberately
-- changing the structural design. No app-callable bypass or purge switch.
CREATE FUNCTION timeline_draft.reject_history_change() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  RAISE EXCEPTION 'Structural draft history is append-only; purge is not implemented'
    USING ERRCODE = '55000';
END;
$$;
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'item_identity', 'item_revision', 'person_revision', 'event_revision',
    'note_revision', 'media_asset', 'media_revision', 'date_endpoint',
    'place_revision', 'topic_revision', 'revision_person', 'revision_topic',
    'placement_revision', 'edge_revision', 'attachment_revision',
    'revision_lineage', 'accepted_authorship', 'owner_review_action',
    'proposal_revision', 'proposal_decision', 'consent_revision',
    'consent_placement', 'consent_eligibility', 'consent_response',
    'consent_override', 'consent_outcome', 'snapshot', 'snapshot_item',
    'snapshot_placement', 'snapshot_edge', 'snapshot_asset',
    'private_inclusion_authorization', 'private_inclusion_item',
    'transfer_manifest', 'transfer_role_confirmation', 'update_delivery', 'update_receipt',
    'update_revision_disposition', 'update_reconciliation',
    'item_deletion_marker', 'mutation_receipt'
  ] LOOP
    EXECUTE format('CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE ON timeline_draft.%I
      FOR EACH ROW EXECUTE FUNCTION timeline_draft.reject_history_change()', table_name);
    EXECUTE format('CREATE TRIGGER immutable_history_truncate BEFORE TRUNCATE ON timeline_draft.%I
      FOR EACH STATEMENT EXECUTE FUNCTION timeline_draft.reject_history_change()', table_name);
  END LOOP;
END;
$$;

-- Fail closed even under permissive provider defaults. No service-role browser
-- workaround. Future migrations must separately review all read/storage policies
-- and narrow transactional entry points before any application access.
REVOKE ALL ON SCHEMA timeline_draft FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA timeline_draft FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA timeline_draft FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA timeline_draft FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA timeline_draft REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA timeline_draft REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA timeline_draft REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated;
DO $$
DECLARE relation record;
BEGIN
  FOR relation IN SELECT tablename FROM pg_tables WHERE schemaname = 'timeline_draft'
  LOOP
    EXECUTE format('ALTER TABLE timeline_draft.%I ENABLE ROW LEVEL SECURITY', relation.tablename);
    EXECUTE format('ALTER TABLE timeline_draft.%I FORCE ROW LEVEL SECURITY', relation.tablename);
  END LOOP;
END;
$$;
COMMIT;
