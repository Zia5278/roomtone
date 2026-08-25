# RoomTone

RoomTone is a Clubhouse/X Spaces-style web application with live audio rooms and realtime room chat.

## Core experience

- A host creates a room and shares its link.
- Guests join as muted listeners with a consistent identity across audio and chat.
- The host can invite listeners to speak, mute speakers, and end the room for everyone.
- Refresh, early arrival, reconnect, and host-tab close have deliberate recovery behavior.

## Stack

- Next.js App Router, React, TypeScript, Tailwind CSS, and shadcn/ui
- FastAPI, Pydantic, SQLAlchemy, Alembic, and PostgreSQL
- GetStream Video for live audio and GetStream Chat for realtime messages
- TanStack Query for REST request state

## Repository

```text
roomtone/
├── apps/
│   ├── web/       # Next.js frontend
│   └── api/       # FastAPI backend and migrations
├── docs/
│   └── ARCHITECTURE.md
├── .env.example
└── README.md
```

## Architecture

The browser connects directly to Stream for realtime audio and chat. FastAPI remains the trusted control plane for identity, authorization, room lifecycle, and Stream tokens. PostgreSQL stores application sessions and room lifecycle state.

See [the architecture document](./docs/ARCHITECTURE.md) for the detailed request, identity, and room-state flows.

`STREAM_API_SECRET` is server-only and must never be exposed through a `NEXT_PUBLIC_*` variable or browser response.
