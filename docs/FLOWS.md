# Timeline flows and future SwiftUI screen specification

The web app remains online-first. This document maps implemented behavior,
not promised native authentication, offline sync, media, stories or export.
Every browser API operation uses `packages/shared/client.ts`; schemas are in
`packages/shared/{models,dates,contracts}.ts` and [OpenAPI](openapi.yaml).

| Flow | Screens / transitions | API operations |
| --- | --- | --- |
| First use | Welcome -> Create account -> Check email -> Callback -> Projects | `GET /api/session`; `POST /api/auth/signup`; consuming `GET /api/auth/callback` |
| Confirm email again | Check email / Resend form -> Email instructions | `GET /api/session`; explicit `POST /api/auth/resend` |
| Sign in | Sign-in form -> Projects | `GET /api/session`; `POST /api/auth/signin`; broadcast account change, full navigation |
| Recover password | Reset form -> Email -> Callback -> New password -> Projects | `POST /api/auth/reset`; consuming callback GET; `GET /api/session`; `POST /api/auth/password` |
| Create project | Projects -> Project + first person form -> Empty timeline | `GET /api/projects`; `POST /api/projects`; `GET /api/projects/{id}`; `GET /api/projects/{id}/events` |
| Switch project | Projects -> Selected project timeline | `GET /api/session`; `GET /api/projects`; `GET /api/projects/{id}`; event list |
| Add person/character | Project timeline -> Inline person form -> Refreshed timeline | `POST /api/projects/{id}/people`; reload detail and event list |
| Add event | Empty/populated timeline -> Event editor -> Acknowledged timeline | owner-scoped local draft first; explicit `POST /api/projects/{id}/events`; refresh detail/list after acknowledgment |
| Edit event | Timeline row -> Editor -> Save -> Timeline with filters retained | same save endpoint with expected version; server returns new version |
| Search/filter/page | Project timeline -> Apply filters -> Load more | event GET with repeated `person`/`category`, `q`, `from`, `to`, `undated`, `offset` |
| Uncertain save | Editor -> Locked pending request -> Explicit identical retry | same request ID and payload; no automatic replay or new identity |
| Conflict | Editor -> Current account version + retained draft -> Explicit merge/base choice | save returns 409; event GET with `event={id}`; explicit new save after choosing base |
| Local recovery | Open/close editor -> Browser draft; download/discard choices | no API for local draft writes, download or discard; canonical events are not deleted |
| Account switch | Any open workspace -> Hide old private UI -> Flush draft -> Reload | `GET /api/session` on focus/account broadcasts; previous owner's draft remains scoped |
| Sign out | Workspace -> Confirm draft handling -> Sign in | cross-tab exclusive lock; `POST /api/auth/signout`; owner-scoped IndexedDB cleanup; broadcast |
| Missing setup | Account/workspace -> Setup instructions | session returns `configured=false,user=null`; no invented account/save |

## Screen and state invariants for SwiftUI

- One project has multiple people/characters; a shared event appears once.
- Preserve civil date precision, wording, uncertainty and hemisphere. Sorting
  bounds are not assertions of an exact date.
- Browser/device draft, pending unconfirmed submission and cloud-saved are
  distinct states. Only a validated server acknowledgment confirms a save.
- Preserve exact pending payload/request identity across retry. Never silently
  overwrite a newer local or server revision.
- Account transitions must hide old private state before reopening content.
- Loading/error presentation is shared by the web UI, but platform-specific
  focus, storage, navigation and editing lifecycle remain client responsibilities.
- The mobile tab bar links only existing Home, Projects and Account screens;
  it does not pretend unimplemented stories/media/export screens exist.

## Native gaps and API inconsistencies

Current auth uses project-specific HttpOnly SSR cookies and exact web Origin
checks. No native bearer-token issuance/refresh/secure-storage or callback
deep-link contract is supplied. Design and test that separately before building
a production SwiftUI client. Do not copy web tokens into JavaScript/shared code.

See [API notes](API.md) for preserved status, naming and pagination differences.
