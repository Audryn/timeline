-- Timeline draft v3, 2026-11-06.
-- Companion: Life Timeline App Draft Data Model (MVP) v3.md.
-- STRUCTURAL DRAFT ONLY. Not a migration; do not apply to an existing app database.
-- Partial companion: the document's newer project collaboration rules are NOT
-- modeled here. Project roles, author-approved audiences, and shared review queues
-- need a structural redesign; reviewer_user_id still assumes one reviewer.
-- Removed co-authors' authorship-only retained history/export is not modeled either.
-- MVP explicit same-account multi-timeline event placement is NOT modeled:
-- events remain timeline-local here; participant links are not placement grants.
-- Organizing events containing separately typed events/memories are NOT modeled.
-- Assumes Supabase auth.users and anon/authenticated roles exist.
-- No app policies, RPCs, or grants are supplied: application access is fail-closed.
-- Ownership, reviewer derivation, date calculation, archive exceptions, media
-- retention and audience consent still require tested transactional functions.

BEGIN;
CREATE SCHEMA timeline_draft;

CREATE TABLE timeline_draft.app_user (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  email text,
  display_name text NOT NULL CHECK (length(btrim(display_name)) BETWEEN 1 AND 100),
  season_preference text CHECK (season_preference IN ('northern', 'southern')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE timeline_draft.project (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  kind text NOT NULL CHECK (kind IN ('real', 'fiction')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE timeline_draft.timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  project_id uuid REFERENCES timeline_draft.project(id),
  subject_person_id uuid,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  kind text NOT NULL DEFAULT 'live' CHECK (kind IN ('live', 'archive')),
  archive_state text CHECK (archive_state IN ('settling_reviews', 'frozen')),
  source_timeline_id uuid REFERENCES timeline_draft.timeline(id),
  snapshot_at timestamptz,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, kind),
  UNIQUE (id, kind, owner_user_id),
  CHECK (
    (kind = 'live' AND archive_state IS NULL AND source_timeline_id IS NULL AND snapshot_at IS NULL)
    OR
    (kind = 'archive' AND archive_state IS NOT NULL AND source_timeline_id IS NOT NULL AND snapshot_at IS NOT NULL)
  ),
  CHECK (source_timeline_id IS NULL OR source_timeline_id <> id)
);

-- One item identity per timeline representation. Sharing reads this representation;
-- archive/independent copies get new IDs while retaining durable provenance.
-- editor_user_id initially equals the creator and changes on authorized transfer.
CREATE TABLE timeline_draft.timeline_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timeline_id uuid NOT NULL REFERENCES timeline_draft.timeline(id),
  kind text NOT NULL CHECK (kind IN ('person', 'event', 'note', 'media')),
  creator_user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  editor_user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'shared')),
  origin_item_id uuid NOT NULL,
  copied_from_item_id uuid,
  copied_from_version integer CHECK (copied_from_version > 0),
  transferred_at timestamptz,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, timeline_id),
  UNIQUE (id, timeline_id, kind),
  CHECK ((copied_from_item_id IS NULL) = (copied_from_version IS NULL)),
  CHECK (copied_from_item_id IS NULL OR copied_from_item_id <> id)
);
-- Provenance IDs deliberately have no cascading source FK: source deletion cannot
-- remove copied history. RPCs set origin IDs; clients cannot forge attribution.

CREATE TABLE timeline_draft.person (
  item_id uuid PRIMARY KEY,
  timeline_id uuid NOT NULL,
  item_kind text GENERATED ALWAYS AS ('person'::text) STORED,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 100),
  is_fictional boolean NOT NULL DEFAULT false,
  linked_user_id uuid REFERENCES timeline_draft.app_user(id),
  link_confirmed_at timestamptz,
  UNIQUE (item_id, timeline_id),
  FOREIGN KEY (item_id, timeline_id, item_kind)
    REFERENCES timeline_draft.timeline_item(id, timeline_id, kind),
  CHECK ((linked_user_id IS NULL) = (link_confirmed_at IS NULL))
);
ALTER TABLE timeline_draft.timeline ADD CONSTRAINT timeline_subject_person_fk
  FOREIGN KEY (subject_person_id, id)
  REFERENCES timeline_draft.person(item_id, timeline_id)
  DEFERRABLE INITIALLY DEFERRED;
-- A live timeline needs a subject before its creation RPC commits. Nullable during
-- construction / an archive selection; that aggregate invariant needs the RPC.

CREATE TABLE timeline_draft.place (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timeline_id uuid NOT NULL REFERENCES timeline_draft.timeline(id),
  creator_user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 300),
  parent_place_id uuid,
  kind text NOT NULL DEFAULT 'other' CHECK (kind IN ('country', 'region', 'city', 'address', 'other')),
  latitude numeric(9,6) CHECK (latitude BETWEEN -90 AND 90),
  longitude numeric(9,6) CHECK (longitude BETWEEN -180 AND 180),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  UNIQUE (id, timeline_id),
  FOREIGN KEY (parent_place_id, timeline_id)
    REFERENCES timeline_draft.place(id, timeline_id),
  CHECK (parent_place_id IS NULL OR parent_place_id <> id)
);
-- Reject multi-node hierarchy cycles and preserve archived places in write RPCs.

CREATE TABLE timeline_draft.event (
  item_id uuid PRIMARY KEY,
  timeline_id uuid NOT NULL,
  item_kind text GENERATED ALWAYS AS ('event'::text) STORED,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  event_type text NOT NULL DEFAULT 'moment' CHECK (length(btrim(event_type)) BETWEEN 1 AND 40),
  date_shape text NOT NULL DEFAULT 'moment' CHECK (date_shape IN ('moment', 'span')),
  end_state text CHECK (end_state IN ('specified', 'unknown', 'ongoing')),
  date_text text CHECK (length(date_text) <= 400),
  place_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details) = 'object'),
  manual_sequence integer,
  UNIQUE (item_id, timeline_id),
  FOREIGN KEY (item_id, timeline_id, item_kind)
    REFERENCES timeline_draft.timeline_item(id, timeline_id, kind),
  FOREIGN KEY (place_id, timeline_id) REFERENCES timeline_draft.place(id, timeline_id),
  CHECK (
    (date_shape = 'moment' AND end_state IS NULL)
    OR (date_shape = 'span' AND end_state IS NOT NULL)
  )
);
-- App-supplied types: moment, memory, residence, job, schooling, trip,
-- relationship, other. Validate the exact list/details in shared contracts and RPCs.
-- Types do not force date_shape. No public direct write path is granted.

-- Endpoint fields are authored facts; no filler day is stored for a month/year.
-- Bounds/sort anchors are derived by validated SQL/TS helpers, not user assertions.
CREATE TABLE timeline_draft.date_endpoint (
  item_id uuid NOT NULL,
  timeline_id uuid NOT NULL,
  endpoint text NOT NULL CHECK (endpoint IN ('birth', 'start', 'end')),
  precision text NOT NULL CHECK (precision IN ('day', 'month', 'year', 'season', 'unknown', 'custom')),
  wording text CHECK (length(wording) <= 200),
  approximate boolean NOT NULL DEFAULT false,
  year integer CHECK (year BETWEEN 1 AND 9999),
  month integer CHECK (month BETWEEN 1 AND 12),
  day integer CHECK (day BETWEEN 1 AND 31),
  season text CHECK (season IN ('spring', 'summer', 'autumn', 'winter')),
  season_hemisphere text CHECK (season_hemisphere IN ('northern', 'southern')),
  placement_state text NOT NULL CHECK (placement_state IN ('resolved', 'unresolved')),
  earliest_day date,
  latest_day date,
  PRIMARY KEY (item_id, endpoint),
  FOREIGN KEY (item_id, timeline_id) REFERENCES timeline_draft.timeline_item(id, timeline_id),
  CHECK (
    (placement_state = 'unresolved' AND earliest_day IS NULL AND latest_day IS NULL)
    OR
    (placement_state = 'resolved' AND earliest_day IS NOT NULL AND latest_day IS NOT NULL
      AND earliest_day <= latest_day)
  ),
  CHECK (
    (precision = 'day' AND year IS NOT NULL AND month IS NOT NULL AND day IS NOT NULL
      AND season IS NULL AND season_hemisphere IS NULL AND placement_state = 'resolved')
    OR
    (precision = 'month' AND year IS NOT NULL AND month IS NOT NULL AND day IS NULL
      AND season IS NULL AND season_hemisphere IS NULL AND placement_state = 'resolved')
    OR
    (precision = 'year' AND year IS NOT NULL AND month IS NULL AND day IS NULL
      AND season IS NULL AND season_hemisphere IS NULL AND placement_state = 'resolved')
    OR
    (precision = 'season' AND year IS NOT NULL AND month IS NULL AND day IS NULL AND season IS NOT NULL
      AND ((placement_state = 'resolved' AND season_hemisphere IS NOT NULL)
        OR (placement_state = 'unresolved' AND season_hemisphere IS NULL)))
    OR
    (precision = 'unknown' AND year IS NULL AND month IS NULL AND day IS NULL
      AND season IS NULL AND season_hemisphere IS NULL AND placement_state = 'unresolved')
    OR
    (precision = 'custom' AND wording IS NOT NULL AND length(btrim(wording)) > 0
      AND year IS NULL AND month IS NULL AND day IS NULL
      AND season IS NULL AND season_hemisphere IS NULL)
  )
);
-- RPCs validate real Gregorian days/leap years, exact derived bounds, endpoint
-- kind (Person.birth vs Event.start/end), and possible span ordering.
-- Required Event.start and specified Event.end are aggregate invariants.
-- Unknown/ongoing ends use event.end_state, with no fabricated end endpoint.
-- earliest_day is a Gregorian DATE, despite the historical column name.
-- Moment ordering uses the start endpoint's earliest_day; manual_sequence is
-- secondary user-confirmed order, never evidence for date/conflict calculations.

CREATE TABLE timeline_draft.event_person (
  timeline_id uuid NOT NULL,
  event_id uuid NOT NULL,
  person_id uuid NOT NULL,
  role text CHECK (length(role) <= 100),
  PRIMARY KEY (event_id, person_id),
  FOREIGN KEY (event_id, timeline_id) REFERENCES timeline_draft.event(item_id, timeline_id),
  FOREIGN KEY (person_id, timeline_id) REFERENCES timeline_draft.person(item_id, timeline_id)
);

CREATE TABLE timeline_draft.topic (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timeline_id uuid NOT NULL REFERENCES timeline_draft.timeline(id),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 100),
  position integer NOT NULL DEFAULT 0,
  archived_at timestamptz,
  UNIQUE (id, timeline_id)
);
CREATE TABLE timeline_draft.event_topic (
  timeline_id uuid NOT NULL,
  event_id uuid NOT NULL,
  topic_id uuid NOT NULL,
  PRIMARY KEY (event_id, topic_id),
  FOREIGN KEY (event_id, timeline_id) REFERENCES timeline_draft.event(item_id, timeline_id),
  FOREIGN KEY (topic_id, timeline_id) REFERENCES timeline_draft.topic(id, timeline_id)
);

CREATE TABLE timeline_draft.note (
  item_id uuid PRIMARY KEY,
  timeline_id uuid NOT NULL,
  item_kind text GENERATED ALWAYS AS ('note'::text) STORED,
  event_id uuid NOT NULL,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 20000),
  FOREIGN KEY (item_id, timeline_id, item_kind)
    REFERENCES timeline_draft.timeline_item(id, timeline_id, kind),
  FOREIGN KEY (event_id, timeline_id) REFERENCES timeline_draft.event(item_id, timeline_id)
);

CREATE TABLE timeline_draft.media_asset (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  storage_bucket text NOT NULL,
  storage_key text NOT NULL,
  readiness text NOT NULL DEFAULT 'pending' CHECK (readiness IN ('pending', 'ready', 'failed')),
  media_type text NOT NULL,
  byte_length bigint CHECK (byte_length > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (storage_bucket, storage_key)
);
-- Private immutable blob identity, never a public or persisted signed URL.
-- References grant no asset access by themselves. Storage policies must authorize
-- the visible media item; garbage collection must respect every retained reference.

CREATE TABLE timeline_draft.media (
  item_id uuid PRIMARY KEY,
  timeline_id uuid NOT NULL,
  item_kind text GENERATED ALWAYS AS ('media'::text) STORED,
  event_id uuid NOT NULL,
  asset_id uuid NOT NULL REFERENCES timeline_draft.media_asset(id),
  kind text NOT NULL CHECK (kind IN ('photo', 'audio', 'import')),
  caption text NOT NULL DEFAULT '' CHECK (length(caption) <= 2000),
  FOREIGN KEY (item_id, timeline_id, item_kind)
    REFERENCES timeline_draft.timeline_item(id, timeline_id, kind),
  FOREIGN KEY (event_id, timeline_id) REFERENCES timeline_draft.event(item_id, timeline_id)
);

CREATE TABLE timeline_draft.share_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timeline_id uuid NOT NULL REFERENCES timeline_draft.timeline(id),
  granted_by_user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  recipient_user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  role text NOT NULL CHECK (role IN ('view', 'contribute')),
  status text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  revoked_at timestamptz,
  UNIQUE (id, timeline_id),
  CHECK (granted_by_user_id <> recipient_user_id),
  CHECK (
    (status = 'invited' AND accepted_at IS NULL AND revoked_at IS NULL)
    OR (status = 'active' AND accepted_at IS NOT NULL AND revoked_at IS NULL)
    OR (status = 'revoked' AND revoked_at IS NOT NULL)
  )
);
CREATE UNIQUE INDEX share_one_open_recipient
  ON timeline_draft.share_access(timeline_id, recipient_user_id)
  WHERE status IN ('invited', 'active');
CREATE TABLE timeline_draft.share_exclusion (
  timeline_id uuid NOT NULL,
  share_id uuid NOT NULL,
  item_id uuid NOT NULL,
  PRIMARY KEY (share_id, item_id),
  FOREIGN KEY (share_id, timeline_id) REFERENCES timeline_draft.share_access(id, timeline_id),
  FOREIGN KEY (item_id, timeline_id) REFERENCES timeline_draft.timeline_item(id, timeline_id)
);
CREATE TABLE timeline_draft.share_private_authorization (
  timeline_id uuid NOT NULL,
  share_id uuid NOT NULL,
  item_id uuid NOT NULL,
  authorized_by_user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  authorized_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (share_id, item_id),
  FOREIGN KEY (share_id, timeline_id) REFERENCES timeline_draft.share_access(id, timeline_id),
  FOREIGN KEY (item_id, timeline_id) REFERENCES timeline_draft.timeline_item(id, timeline_id)
);
-- Explicit permission for an existing private item, NOT future private content.
-- RPC verifies the item's creator/current independent editing owner's authority.
-- Other creators' private records cannot be authorized by the timeline sharer.
-- Active share, role, exclusions, and ancestor visibility still govern access.
-- Item visibility remains private; grants never imply public access or direct edits.
-- Contributors may create/edit their own private items without a proposal, but
-- only their creator/editor sees them absent explicit permission. Ownership of
-- the timeline alone must not expose them or copy them into the sender's archive.
-- Active shares include future non-private permitted content; exclusions narrow
-- access per recipient. Private ancestors require explicit permission; excluded
-- ancestors deny attached content regardless of an attachment's permission.
-- Unsharing is revocation, NOT copying. Mixed-authorship audience consent is required.

CREATE TABLE timeline_draft.review_trust (
  timeline_id uuid NOT NULL REFERENCES timeline_draft.timeline(id),
  reviewer_user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  contributor_user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  auto_accept boolean NOT NULL DEFAULT false,
  PRIMARY KEY (timeline_id, reviewer_user_id, contributor_user_id),
  CHECK (reviewer_user_id <> contributor_user_id)
);

-- Trust covers shared additions and edits/replacements this reviewer can decide.
-- Earlier direct-sharing model only, NOT the project shared review queue.
-- The timeline owner approves inclusion of additions; an item's editing authority
-- approves edits/replacements. RPC checks permissions and applies acceptance
-- atomically with validation, version checks where applicable, and audit history.
CREATE TABLE timeline_draft.contribution (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timeline_id uuid NOT NULL REFERENCES timeline_draft.timeline(id),
  share_id uuid NOT NULL,
  contributor_user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  reviewer_user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  operation text NOT NULL CHECK (operation IN ('add', 'edit', 'replace_media')),
  target_kind text NOT NULL CHECK (target_kind IN ('person', 'event', 'note', 'media')),
  target_item_id uuid,
  base_version integer CHECK (base_version > 0),
  proposed_item_id uuid,
  source_item_id uuid, -- provenance only; no recipient read rights to the source timeline
  parent_event_id uuid,
  submitted_payload jsonb NOT NULL CHECK (jsonb_typeof(submitted_payload) = 'object'),
  submitted_context jsonb NOT NULL CHECK (jsonb_typeof(submitted_context) = 'object'),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled', 'outdated')),
  decided_by_user_id uuid REFERENCES timeline_draft.app_user(id),
  decided_at timestamptz,
  decision_mode text CHECK (decision_mode IN ('manual', 'auto_accept', 'contributor_cancel', 'new_owner_cancel', 'outdated')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, timeline_id),
  UNIQUE (timeline_id, proposed_item_id),
  FOREIGN KEY (share_id, timeline_id) REFERENCES timeline_draft.share_access(id, timeline_id),
  FOREIGN KEY (target_item_id, timeline_id, target_kind)
    REFERENCES timeline_draft.timeline_item(id, timeline_id, kind),
  FOREIGN KEY (parent_event_id, timeline_id) REFERENCES timeline_draft.event(item_id, timeline_id),
  CHECK (contributor_user_id <> reviewer_user_id),
  CHECK (
    (operation = 'add' AND target_item_id IS NULL AND base_version IS NULL AND proposed_item_id IS NOT NULL
      AND ((target_kind IN ('note', 'media') AND parent_event_id IS NOT NULL)
        OR (target_kind IN ('person', 'event') AND parent_event_id IS NULL)))
    OR
    (operation IN ('edit', 'replace_media') AND target_item_id IS NOT NULL
      AND base_version IS NOT NULL AND proposed_item_id IS NULL AND parent_event_id IS NULL)
  ),
  CHECK (operation <> 'replace_media' OR target_kind = 'media'),
  CHECK (
    (status = 'pending' AND decided_at IS NULL AND decided_by_user_id IS NULL AND decision_mode IS NULL)
    OR
    (status <> 'pending' AND decided_at IS NOT NULL AND decided_by_user_id IS NOT NULL AND decision_mode IS NOT NULL)
  )
);
-- Review metadata is derived, not trusted from caller JSON. Terminal transitions
-- and immutable submitted snapshots require RPC enforcement. Before/after snapshots
-- are sensitive, even for cancelled requests; protect them with dedicated policies.

CREATE TABLE timeline_draft.ownership_transfer (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  live_timeline_id uuid NOT NULL REFERENCES timeline_draft.timeline(id),
  sender_user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  recipient_user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  sender_archive_id uuid REFERENCES timeline_draft.timeline(id),
  archive_kind text GENERATED ALWAYS AS ('archive'::text) STORED,
  expected_timeline_version integer NOT NULL CHECK (expected_timeline_version > 0),
  status text NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed', 'committed', 'declined', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  committed_at timestamptz,
  FOREIGN KEY (sender_archive_id, archive_kind, sender_user_id)
    REFERENCES timeline_draft.timeline(id, kind, owner_user_id),
  CHECK (sender_user_id <> recipient_user_id),
  CHECK (
    (status = 'committed' AND sender_archive_id IS NOT NULL AND committed_at IS NOT NULL)
    OR (status <> 'committed' AND sender_archive_id IS NULL AND committed_at IS NULL)
  ),
  CHECK (sender_archive_id IS NULL OR sender_archive_id <> live_timeline_id)
);
CREATE UNIQUE INDEX transfer_one_proposed
  ON timeline_draft.ownership_transfer(live_timeline_id) WHERE status = 'proposed';

CREATE TABLE timeline_draft.transfer_item (
  transfer_id uuid NOT NULL REFERENCES timeline_draft.ownership_transfer(id),
  source_item_id uuid NOT NULL REFERENCES timeline_draft.timeline_item(id),
  source_version integer NOT NULL CHECK (source_version > 0),
  include_in_recipient boolean NOT NULL,
  retain_in_sender_archive boolean NOT NULL,
  archive_item_id uuid REFERENCES timeline_draft.timeline_item(id),
  private_authorized_by_user_id uuid REFERENCES timeline_draft.app_user(id),
  private_authorized_at timestamptz,
  archive_private_authorized_by_user_id uuid REFERENCES timeline_draft.app_user(id),
  archive_private_authorized_at timestamptz,
  PRIMARY KEY (transfer_id, source_item_id),
  UNIQUE (transfer_id, archive_item_id),
  CHECK ((private_authorized_by_user_id IS NULL) = (private_authorized_at IS NULL)),
  CHECK ((archive_private_authorized_by_user_id IS NULL) = (archive_private_authorized_at IS NULL)),
  CHECK (retain_in_sender_archive OR archive_item_id IS NULL)
);
-- RPC verifies source scope, selection completeness, private creator consent,
-- recipient live ownership, sender archive scope, dependent items/assets, and
-- recipient confirmation. Archive permission is separate from transfer inclusion.
-- retain_in_sender_archive distinguishes intentional non-retention from a copy
-- still waiting to be populated; committed retained selections need an archive ID.
-- Excluded items must remain only in an authorized retained context, not leak
-- through asset IDs, proposal context, or recipient links.

CREATE TABLE timeline_draft.transfer_review (
  transfer_id uuid NOT NULL REFERENCES timeline_draft.ownership_transfer(id),
  contribution_id uuid NOT NULL REFERENCES timeline_draft.contribution(id),
  live_target_item_id uuid REFERENCES timeline_draft.timeline_item(id),
  archive_target_item_id uuid REFERENCES timeline_draft.timeline_item(id),
  live_base_version integer CHECK (live_base_version > 0),
  archive_base_version integer CHECK (archive_base_version > 0),
  PRIMARY KEY (transfer_id, contribution_id),
  CHECK ((live_target_item_id IS NULL) = (live_base_version IS NULL)),
  CHECK ((archive_target_item_id IS NULL) = (archive_base_version IS NULL))
);
-- Pending captured reviews lock their affected included items (parent event for
-- additions). No stored lock bool to drift from pending state. Resolve both mapped
-- versions atomically; accepted pre-transfer changes reach live and archive copies
-- where authorized content exists. New owner may cancel abandoned captured reviews.
-- Freeze archive when every captured review closes. Further live edits never sync.
-- Excluded targets / repeated transfer while settling need explicit workflow rules.
-- Cross-timeline item mappings in transfer_item/transfer_review are deliberately
-- checked by the transfer RPC, not scoped by composite FKs in this draft.

CREATE TABLE timeline_draft.change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timeline_id uuid NOT NULL,
  item_id uuid NOT NULL,
  version_before integer NOT NULL CHECK (version_before > 0),
  version_after integer NOT NULL,
  before_value jsonb NOT NULL,
  after_value jsonb NOT NULL,
  proposed_by_user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  approved_by_user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  contribution_id uuid REFERENCES timeline_draft.contribution(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (item_id, timeline_id) REFERENCES timeline_draft.timeline_item(id, timeline_id),
  CHECK (version_after = version_before + 1)
);

CREATE TABLE timeline_draft.mutation_receipt (
  actor_user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  request_id uuid NOT NULL,
  fingerprint text NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (actor_user_id, request_id)
);
CREATE TABLE timeline_draft.notification (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id uuid NOT NULL REFERENCES timeline_draft.app_user(id),
  actor_user_id uuid REFERENCES timeline_draft.app_user(id),
  type text NOT NULL CHECK (length(btrim(type)) BETWEEN 1 AND 80),
  timeline_id uuid NOT NULL REFERENCES timeline_draft.timeline(id),
  contribution_id uuid,
  share_id uuid,
  transfer_id uuid REFERENCES timeline_draft.ownership_transfer(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  FOREIGN KEY (contribution_id, timeline_id) REFERENCES timeline_draft.contribution(id, timeline_id),
  FOREIGN KEY (share_id, timeline_id) REFERENCES timeline_draft.share_access(id, timeline_id)
);
-- No content/message payload. Metadata still needs audience-aware filtering.
-- In-app only; no decline/cancellation/outdated notifications or legacy activation.

CREATE INDEX timeline_owner ON timeline_draft.timeline(owner_user_id, kind);
CREATE INDEX item_timeline ON timeline_draft.timeline_item(timeline_id, kind);
CREATE INDEX item_origin ON timeline_draft.timeline_item(origin_item_id);
CREATE INDEX endpoint_order ON timeline_draft.date_endpoint(timeline_id, endpoint, earliest_day, item_id);
CREATE INDEX event_person_subject ON timeline_draft.event_person(person_id, event_id);
CREATE INDEX event_topic_topic ON timeline_draft.event_topic(topic_id, event_id);
CREATE INDEX event_place ON timeline_draft.event(place_id);
CREATE INDEX note_parent ON timeline_draft.note(event_id);
CREATE INDEX media_parent ON timeline_draft.media(event_id);
CREATE INDEX media_asset_reference ON timeline_draft.media(asset_id);
CREATE INDEX place_parent ON timeline_draft.place(parent_place_id);
CREATE INDEX share_recipient ON timeline_draft.share_access(recipient_user_id, status);
CREATE INDEX review_inbox ON timeline_draft.contribution(reviewer_user_id, status, created_at);
CREATE INDEX review_target ON timeline_draft.contribution(target_item_id, status);
CREATE INDEX captured_review ON timeline_draft.transfer_review(contribution_id);
CREATE INDEX notification_inbox ON timeline_draft.notification(recipient_user_id, read_at, created_at DESC);

-- Default deny, including tables created under permissive provider defaults.
-- This schema is NOT app-usable until reviewed read policies and narrow write RPCs
-- exist. Never substitute service-role browser access for the missing policies.
REVOKE ALL ON SCHEMA timeline_draft FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA timeline_draft FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA timeline_draft FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA timeline_draft FROM PUBLIC, anon, authenticated;
DO $$
DECLARE relation record;
BEGIN
  FOR relation IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'timeline_draft'
  LOOP
    EXECUTE format('ALTER TABLE timeline_draft.%I ENABLE ROW LEVEL SECURITY', relation.tablename);
    EXECUTE format('ALTER TABLE timeline_draft.%I FORCE ROW LEVEL SECURITY', relation.tablename);
  END LOOP;
END $$;
COMMIT;
