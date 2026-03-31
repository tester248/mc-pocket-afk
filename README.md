# MCPocketAFK

MCPocketAFK is a mobile-controlled Minecraft Java bot platform with a backend-first architecture.

Current implementation focus:
- Node.js + Mineflayer backend engine
- WebSocket command and event protocol
- Low-CPU Anti-AFK loops for long-running sessions

## Repository Layout

- [instructions.md](instructions.md): project blueprint and constraints
- [backend](backend): backend TypeScript service
- [docs](docs): protocol and deployment docs

## Backend Quick Start

```bash
cd backend
npm install
npm run build
npm run dev
```

Backend defaults:
- WebSocket: `ws://localhost:8080`
- Health: `http://localhost:8080/healthz`

Protocol reference: [docs/API_SPEC.md](docs/API_SPEC.md)

## Mobile Quick Start

```bash
cd mobile
npm install
cp .env.example .env
npm run start
```

Environment variables:
- `EXPO_PUBLIC_BACKEND_WS_URL` default backend WebSocket URL shown in the control app.