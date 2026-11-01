# Collab Code Editor

A real-time collaborative code editor where multiple users can edit the same
file simultaneously. Changes sync instantly across all connected users, with
conflict-free merging powered by Yjs (CRDT).

## Features
- Real-time multi-user editing with Monaco Editor (the VS Code editor)
- Conflict-free sync using Yjs and WebSockets (Socket.io)
- Online users list
- Dockerized with a multi-stage build
- Deployed on AWS

## Tech Stack
React, Vite, Tailwind CSS, Monaco Editor, Yjs, Node.js, Express, Socket.io, Docker, AWS