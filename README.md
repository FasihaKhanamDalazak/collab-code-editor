# Pairspace

Pairspace is a shared code room for pairing, teaching, interviews, and working
through ideas together. Open a room, invite someone with a link, and edit in
the same workspace.

## Features

- Live multi-user editing with Monaco and Yjs
- Live participant presence and optional collaborator cursor labels
- Six shared languages: JavaScript, TypeScript, Python, C++, Java, and Go
- Shared code execution results through Judge0 CE
- Six-character room codes, optional room passwords, and invite links
- Hashed room passwords, short-lived room JWTs, and rate-limited endpoints
- Room metadata and editor documents saved on the server
- Responsive landing page, room setup flow, and editor interface

## Requirements

- Node.js 20.19 or newer (or a current Node.js 22 release)
- npm
- Docker Desktop or a Docker Engine for container builds

## Local setup

1. Copy `.env.example` to `Backend/.env` and set a long, unique `JWT_SECRET`.
2. Install and start the backend:

   ```powershell
   cd Backend
   npm install
   npm run dev
   ```

3. In a second terminal, install and start the frontend:

   ```powershell
   cd Frontend
   npm install
   npm run dev
   ```

4. Open the Vite URL (normally `http://localhost:5173`). The Vite development
   server proxies `/api` and `/socket.io` to the backend at
   `http://localhost:3000`.

The backend reads `Backend/.env`. `Frontend/.env.local` may set
`VITE_API_PROXY_TARGET` if the backend is listening on a different address.

## Environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | HTTP and Socket.IO server port |
| `JWT_SECRET` | Temporary random secret in development; required in production | Secret used to sign room JWTs. Set a stable secret so tokens remain verifiable after a restart. |
| `DATA_DIR` | `Backend/data` | Directory for room metadata and Yjs LevelDB documents |
| `JUDGE0_URL` | `https://ce.judge0.com` | Judge0 CE base URL |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | Allowed browser origin for Socket.IO in development |
| `VITE_API_PROXY_TARGET` | `http://localhost:3000` | Backend target used by the Vite development proxy |

Never commit `.env` files or real signing secrets. In production, set
`JWT_SECRET` to a unique, high-entropy value through your deployment's secret
manager. `DATA_DIR` should point to writable persistent storage.

## Docker

Build and run the single-port production app from the repository root:

```powershell
docker build -t pairspace .
docker run --rm -p 3000:3000 -e JWT_SECRET="replace-with-a-long-random-secret" -v pairspace-data:/app/data pairspace
```

Open `http://localhost:3000`. The named volume mounted at `/app/data` keeps
room metadata and Yjs documents across container restarts. A host directory can
be mounted instead, for example `-v C:\pairspace-data:/app/data` in
PowerShell. Back up this directory to preserve rooms and editor contents.

The multi-stage image builds the Vite frontend, copies `dist` into the backend,
and serves the SPA, API, and Socket.IO from port 3000.

## Architecture

The React client creates one Yjs document for the room. `y-socket.io` syncs its
shared text, `settings` map, and `run` map through Socket.IO; the server stores
document updates in LevelDB. Each room uses its own `/yjs|<roomId>` namespace.
Joining a room returns a 12-hour JWT containing its room code and username.
Both room APIs and the websocket namespace verify the token and its room
binding. Room passwords are stored as bcrypt hashes in `rooms.json`, never as
plaintext. Code execution requests are authorized by the room JWT and sent to
Judge0 CE; the completed result is written to the shared Yjs `run` map.

## Validation

```powershell
cd Frontend
npm run lint
npm run build
```

The backend can be started with `npm start` from `Backend`.
