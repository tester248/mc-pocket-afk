# MCPocketAFK

MCPocketAFK is a mobile-controlled Minecraft Java bot platform with a backend-first architecture.

Current implementation focus:
- Node.js + Mineflayer backend engine
- WebSocket command and event protocol
- Low-CPU Anti-AFK loops for long-running sessions
- Fabric mod support for modded servers

## Repository Layout

- [instructions.md](instructions.md): project blueprint and constraints
- [backend](backend): backend TypeScript service
- [mobile](mobile): mobile React Native app (Expo)
- [fabric-payload-recorder](fabric-payload-recorder): Fabric client mod for capturing server payloads (Minecraft 1.21.11)
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

### Fabric Profile Support

The backend can accept an optional **Fabric profile** in the `connect` payload. This allows modded handshakes for Fabric servers.

**Getting a Fabric Profile:**

1. Build the Fabric mod from `fabric-payload-recorder/`:
   ```bash
   cd fabric-payload-recorder
   gradle build
   ```

2. Install `build/libs/payload-recorder.jar` into your Fabric client (Minecraft 1.21.11).

3. Join your target server and generate a template profile — the mod will guide you.

4. Populate the template with your server's actual payloads (see [fabric-payload-recorder/README.md](fabric-payload-recorder/README.md) for methods).

5. Import the final `fabric-profile.json` via the mobile app's **Dashboard → Import Fabric Profile** button.

**Example profile** (`backend/fabric-profile-sample.json`):

```json
{
	"gameVersion": "1.21.11",
	"registerPayloadBase64": "dGVzdF9yZWdpc3Rlcl9wYXlsb2Fk",
	"channels": [
		{
			"channel": "fabric:example_channel",
			"dataBase64": "dGVzdF9jaGFubmVsX3BheWxvYWQ="
		}
	]
}
```

The profile is sent automatically with every `connect` request when imported.

## Mobile Quick Start

```bash
cd mobile
npm install
cp .env.example .env
npm run start
```

Environment variables:
- `EXPO_PUBLIC_BACKEND_WS_URL` default backend WebSocket URL shown in the control app.