# MCPocketAFK Backend Deployment (Initial)

## Local Run

1. Install Node.js 20+.
2. Install dependencies:

```bash
cd backend
npm install
```

3. Build:

```bash
npm run build
```

4. Start:

```bash
npm start
```

5. Health check:

```bash
curl http://localhost:8080/healthz
```

## Environment Variables

- `PORT` (default `8080`)
- `HOST` (default `0.0.0.0`)

See [backend/.env.example](../backend/.env.example).

## Render Notes

- Use a Web Service (not static site).
- Build command: `cd backend && npm install && npm run build`
- Start command: `cd backend && npm start`
- Expose `PORT` from Render runtime.
- Keep-alive can be driven by the mobile app via `ping` action or `/healthz` HTTP checks while sessions are active.
- Ensure outbound network to target MC server is allowed because backend may pre-ping server for version detection when connect payload omits `version`.

## Known Limitations (v0.1)

- Fabric payload injection is request/response channel-based and depends on accurate exported profile data.
- Multi-session persistence is in-memory only.
- Premium auth is backend-owned via Mineflayer device flow; app only displays code and status.
