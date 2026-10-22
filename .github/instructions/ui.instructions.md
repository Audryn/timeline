---
applyTo: "src/app/**/*.tsx,src/features/**/*.tsx,src/**/*.css"
---

# UI and capture workflows

- Use the established warm-paper/forest-green visual language, CSS Modules,
  system fonts, and shared global tokens. Keep layouts responsive.
- Root layout owns `main#main-content`; route content must not create another
  main landmark. Preserve the skip link and nonce-compatible dynamic rendering.
- Use semantic controls, accessible labels/legends, visible keyboard focus,
  readable errors/status, and non-color category cues. Support touch, zoom,
  screen readers, and reduced motion; do not use placeholders as labels.
- Keep first use short: account -> verified email -> project plus first
  person -> empty timeline -> first event. Do not require a biography, birth
  date, photo, or additional person just to start.
- Display real/fictional people as project records, not invited accounts.
  A project timeline shows a shared event once with its participants.
- Reuse the date editor/domain helpers. Offer Unknown and custom wording;
  show uncertainty differently from actual duration. Preserve Undated access.
- Keep filter selections/search across edit/close/save and routine refresh.
  Reset/refetch pagination without retaining stale rows or duplicating events.
- Autosave incomplete event drafts separately from validated cloud records.
  Show local save success only after storage succeeds; acknowledge storage
  failure and provide a recovery route instead of hiding it.
- After an ambiguous network result, retain the exact request for safe retry.
  Do not unlock changed submissions until that attempt is resolved.
- Preserve both sides of a server conflict and require an explicit merge or
  base-version choice. Do not turn a failed save into a success toast.
- Preserve cross-tab draft revision checks, editor locks, and account-change
  flushing/cleanup. Hide private UI during account transitions.
- Request microphone/file access only when the user chooses that feature.
  Do not add fake working controls for unfinished stories, media, or export.
- Browser recording/transcription is capability-dependent. No remote speech
  fallback; ordinary browser dictation is not proof of on-device processing.
- If runtime capability is unsupported, explain it and retain usable paths
  such as typing. Do not label a web session lock as native biometric storage
  protection or assume phone background recording is reliable.
