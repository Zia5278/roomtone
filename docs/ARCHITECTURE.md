# RoomTone architecture

This document describes how the browser, application API, PostgreSQL, and Stream services interact.

## The mental model

```text
Next.js browser UI
  |-- HTTPS --> FastAPI: identity, room lifecycle, host authorization
  |                 |-- server SDK --> Stream: users, tokens, calls, channels
  |                 `-- PostgreSQL --> sessions, room state, host-tab leases
  |
  |-- WebSocket/WebRTC --> Stream Video: live audio and participant events
  `-- WebSocket -------> Stream Chat: messages and channel events
```

FastAPI is the trusted control plane. Stream is the realtime media and messaging plane. PostgreSQL stores the application state that Stream should not be asked to model: application sessions, our room lifecycle, and whether a host browser is still alive.

This separation keeps Python meaningful without trying to proxy audio or chat through our own server.

## Technology choices

| Area | Choice | Reason |
| --- | --- | --- |
| Web app | Next.js App Router + TypeScript | Required stack, strong routing and production build tooling |
| Styling | Tailwind CSS v4, shadcn/ui, and CSS variables | Fast custom UI using conventional accessible primitives and a consistent design language |
| Audio | `@stream-io/video-react-sdk`, `audio_room` call type | Required; listeners default to mic off and the permission workflow fits the product |
| Chat | `stream-chat` + `stream-chat-react` | Required; use SDK behavior and selectively customize UI |
| API | FastAPI + Pydantic | Required Python backend with explicit, documented request/response models |
| REST state | Typed `fetch` client + TanStack Query | Centralized transport with consistent pending, error, retry, and refresh behavior |
| Persistence | PostgreSQL through SQLAlchemy and Alembic | Persistent sessions, room status, and heartbeats with conventional schema migrations |
| App session | Opaque server-side session in an HTTP-only cookie | Server-generated identity survives refresh and cannot be edited into a host identity |
| Tests | Focused Pytest checks plus a continuous manual two-browser matrix | Protects critical backend rules while prioritizing the evaluator's real workflow |

## Identity and token flow

1. The browser submits a display name and avatar choice to `POST /v1/sessions`.
2. FastAPI creates a random user ID and an opaque application session stored in PostgreSQL.
3. FastAPI returns the session ID in an HTTP-only cookie that the browser sends automatically on later API requests.
4. An authenticated token endpoint resolves the session, upserts exactly that user in Stream, and mints a short-lived Stream token.
5. The same `id`, `name`, and `image` initialize both Stream Video and Stream Chat.

The browser never chooses its authoritative user ID or Stream role. `STREAM_API_SECRET` is read only by FastAPI. The public API key and expiring user token are safe browser inputs. Stream token providers use the application session to obtain replacements without exposing the Stream secret.

## Room lifecycle

```text
creating -> backstage -> live -> ended
                |          |
                |          `-> host missing -> grace period -> ended
                `-> guest sees waiting state
```

- `creating`: FastAPI is creating the Stream call and chat channel.
- `backstage`: the room exists but the host has not made it live yet.
- `live`: listeners may join; host controls are active.
- `ended`: terminal state; audio cannot be rejoined and chat input is disabled.

State transitions are idempotent. Retrying a join, heartbeat, or end request must return the current valid state instead of duplicating resources.

## Host-tab close behavior

Each host browser tab receives a random tab ID kept in `sessionStorage` and sends a heartbeat while it owns a live room. FastAPI stores a short lease per tab.

- A refresh can reconnect inside the grace period.
- Closing one of two host tabs does not end the room while the other lease remains active.
- When no host lease is current, FastAPI ends the Stream call and marks the room ended.
- Reconciliation runs periodically and when room endpoints are called, so stale state is also corrected after an API restart.

`pagehide`/`sendBeacon` can accelerate detection, but correctness does not depend on a browser unload event arriving.

## Proposed API surface

| Method and path | Responsibility |
| --- | --- |
| `GET /health` | Deployment health check without secrets |
| `GET /health/ready` | Confirm PostgreSQL is reachable without exposing connection details |
| `POST /v1/sessions` | Create a server-assigned fake-auth identity |
| `GET /v1/sessions/me` | Restore and validate the current identity |
| `POST /v1/stream-token` | Upsert the user and mint a short-lived Stream token |
| `POST /v1/rooms` | Create one Stream audio call and chat channel |
| `GET /v1/rooms/{room_id}` | Return safe room metadata and lifecycle state |
| `POST /v1/rooms/{room_id}/join` | Prepare an authenticated user to join the room |
| `POST /v1/rooms/{room_id}/live` | Host-only transition from backstage to live |
| `PUT /v1/rooms/{room_id}/host-tabs/{tab_id}` | Renew a host-tab lease |
| `DELETE /v1/rooms/{room_id}/host-tabs/{tab_id}` | Best-effort release of a host-tab lease |
| `POST /v1/rooms/{room_id}/end` | Host-only, idempotent end and chat freeze |

Invite-to-speak and mute can use Stream's client methods because Stream authorizes them from call capabilities assigned to the host. If integration testing reveals that the dashboard's built-in `audio_room` grants vary, those actions will move behind host-authorized FastAPI endpoints without changing the UI.

## Backend boundaries

Keep the backend small and testable:

- API routes translate HTTP to service calls; they do not contain Stream logic.
- A room service owns lifecycle rules and host authorization.
- A Stream gateway is the only code that imports and calls the Stream server SDK.
- A repository owns PostgreSQL queries and transactions through SQLAlchemy.
- Settings validate environment variables at startup and never serialize the secret.

These boundaries let unit tests use a fake Stream gateway, which makes failure cases deterministic without mocking HTTP throughout the application.

## Frontend boundaries

- App routes own page-level loading and navigation.
- Session code owns identity persistence and token refresh.
- A room provider creates and cleans up the Video and Chat clients exactly once per identity/room.
- A typed API module owns HTTP details; TanStack Query owns REST request state and metadata caching.
- Feature components render room states and invoke typed actions.
- Stream SDK hooks remain the source of realtime participants, audio, and messages; that state is not duplicated in TanStack Query.
- General product components should not know raw Stream or FastAPI response shapes.

## Robustness rules

- Join calls with `create: false`; guests must never create a typo room.
- Disable the guest microphone before joining even though `audio_room` defaults it off.
- Treat SDK connection state as product UI state, not just console output.
- Clean up both SDK clients on identity change or unmount.
- Give all mutations idempotent behavior and useful error responses.
- Never infer host authorization from a client-supplied boolean or hidden button.
- Freeze or disable chat when the room reaches `ended`.
- Keep a small grace period for refresh and transient disconnects.

## Integration spike before full UI

The first real Stream test should prove only these uncertain edges:

1. The Python SDK can create an `audio_room` with the creator/host capability set expected by the React SDK.
2. A normal user can join live as a listener but cannot send audio until invited.
3. Grant, mute, go-live, and end events arrive in both browsers as expected.
4. One server-generated token connects the same user to Video and Chat.

Only after this passes should we spend significant time on the polished room UI.

## Primary references

- [Stream React audio-room tutorial](https://getstream.io/video/sdk/react/tutorial/audio-room/)
- [Stream call types and capabilities](https://getstream.io/video/docs/react/guides/configuring-call-types/)
- [Stream permissions and moderation](https://getstream.io/video/docs/react/guides/permissions-and-moderation/)
- [Stream server-side call lifecycle](https://getstream.io/video/docs/api/call-lifecycle/)
- [Stream Python token setup](https://getstream.io/video/docs/api/)
- [Stream React Chat setup](https://getstream.io/chat/docs/sdk/react/basics/getting-started/)
