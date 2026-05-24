# MCPocketAFK WebSocket API (Backend v0.2)

This document defines the command and event contract between the mobile app and backend.

## Connection

- WebSocket endpoint: `ws://<host>:<port>/`
- Health endpoint: `http://<host>:<port>/healthz`

## Multi-Session Support (v0.2+)

The backend supports multiple concurrent bot sessions per client connection via `sessionId`. This enables a single WebSocket connection to manage multiple simultaneous bot instances.

### Session Lifecycle

1. **Connect**: Client sends `connect` action without `sessionId` → server generates a UUID and returns it in the ack response.
2. **Use Session**: Client includes the `sessionId` in subsequent actions (`chat`, `start_afk`, `stop_afk`, etc.).
3. **Auto-Routing**: Events from that session are tagged with the same `sessionId` for client-side routing.
4. **Disconnect**: Client sends `disconnect` with the `sessionId` to close that specific session.
5. **Cleanup**: When the WebSocket closes, all sessions are automatically disconnected.

### Backwards Compatibility

- If `sessionId` is omitted and only one session exists, the backend assumes that session.
- If `sessionId` is omitted and multiple sessions exist, the backend returns an error.
- Clients using a single session do not need to supply `sessionId`.

## Auth Ownership

- Premium (Microsoft) authentication is handled by Mineflayer in the backend.
- The app does not run OAuth. It only displays `msa_code` events and sends connect or retry actions.

## Inbound Commands (App -> Backend)

The backend accepts either `action` or `command` as the command key.

### `connect`

```json
{
  "action": "connect",
  "config": {
    "host": "mc.example.com",
    "port": 25565,
    "authMode": "cracked",
    "username": "PocketBot",
    "autoCommand": "/login mypassword"
  },
  "sessionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

- `sessionId`: optional UUID string. If omitted, server generates one and returns it in the ack response.
- All other fields as before.

Shortcut payload (also supported):

```json
{
  "command": "connect",
  "ip": "mc.example.com",
  "authMode": "premium"
}
```

Fields:
- `host` or `ip`: required
- `port`: optional (default Minecraft port)
- `version`: optional explicit game version; when omitted, backend attempts server ping-based detection and chooses the best supported version, otherwise falls back to backend default
- `authMode`: `cracked` or `premium` (also accepts `auth: microsoft` for compatibility)
- `username`: optional (required by some cracked servers)
- `autoCommand`: optional, runs once on spawn
- `fabricProfile`: optional modded handshake payloads used by backend injection logic

Fabric profile shape:

```json
{
  "gameVersion": "1.20.4",
  "registerPayloadBase64": "AAECAwQ=",
  "channels": [
    {
      "channel": "fabric:registry/sync/direct",
      "dataBase64": "AAECAwQ="
    }
  ]
}
```

Fabric behavior:
- Backend listens for incoming `custom_payload` packets from the server.
- If `fabricProfile.gameVersion` is provided and does not match resolved connect version, backend refuses injection and emits an error.
- If packet channel is `minecraft:register` and `registerPayloadBase64` was provided, backend replies with that payload.
- If packet channel matches any `fabricProfile.channels[].channel`, backend replies with the mapped payload bytes.
- Invalid base64 profile entries are ignored and reported as `error` events.

### `disconnect`

```json
{
  "action": "disconnect",
  "reason": "user_requested",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

- `sessionId`: optional (required if multiple sessions are active).

### `chat`

```json
{
  "action": "chat",
  "text": "/tpa Steve",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

- `sessionId`: optional (required if multiple sessions are active).

Compatibility format:

```json
{
  "command": "chat",
  "message": "hello world"
}
```

### `start_afk`

```json
{
  "action": "start_afk",
  "type": "fish"
}
```

`type` values:
- `swing`
- `look`
- `jump`
- `fish`
- `all`

### `stop_afk`

```json
{
  "action": "stop_afk",
  "type": "fish",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

- `type`: optional specific AFK mode to stop; if omitted, all modes are stopped.
- `sessionId`: optional (required if multiple sessions are active).

### `ping`

```json
{
  "action": "ping",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

- `sessionId`: optional.

## Outbound Events (Backend -> App)

All events now include an optional `sessionId` field for client-side routing in multi-session scenarios.

### `status`

```json
{
  "event": "status",
  "state": "connected",
  "message": "Bot spawned successfully.",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

`state` values:
- `idle`
- `connecting`
- `connected`
- `disconnected`
- `reconnecting`

### `ack`

```json
{
  "event": "ack",
  "action": "chat",
  "message": "Chat sent to server.",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### `error`

```json
{
  "event": "error",
  "message": "Action failed: Bot is not connected.",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### `chat`

```json
{
  "event": "chat",
  "text": "[Server] Welcome!"
}
```

Chat is forwarded as plain text to reduce payload size.

### `msa_code`

```json
{
  "event": "msa_code",
  "code": "ABCD-EFGH",
  "verificationUri": "https://www.microsoft.com/link"
}
```

### `afk_state`

```json
{
  "event": "afk_state",
  "activeModes": ["swing", "jump"]
}
```

### `vitals`

```json
{
  "event": "vitals",
  "health": 20,
  "food": 18
}
```

### `reconnect_scheduled`

```json
{
  "event": "reconnect_scheduled",
  "attempt": 2,
  "delayMs": 4000,
  "reason": "end:socket closed"
}
```

### `reconnect_exhausted`

```json
{
  "event": "reconnect_exhausted",
  "attempts": 10,
  "reason": "reconnect_failed"
}
```

Emitted when the backend reaches the maximum reconnect attempts and will stop retrying.

### `pong`

```json
{
  "event": "pong",
  "ts": 1760000000000
}
```

### `version_resolution`

```json
{
  "event": "version_resolution",
  "requestedVersion": "1.20.4",
  "resolvedVersion": "1.20.4",
  "source": "requested",
  "tested": false,
  "detectedVersionName": "Paper 1.20.4",
  "detectedProtocol": 765,
  "warning": "Requested version '1.20.4' is not in the supported version list; attempting anyway."
}
```

Field notes:
- `source` can be `requested`, `detected`, or `default`.
- `tested` indicates whether `resolvedVersion` is in the backend tested matrix.
- `requestedVersion` is present when app explicitly provided a version.
- `detectedVersionName` and `detectedProtocol` are present when backend ping detection succeeds.
- `warning` is present when backend had to fallback or continue with best-effort behavior.

Current tested matrix behavior:
- Backend currently marks only the runtime default version as tested.
- Non-tested versions are still allowed, but `tested` will be `false` and `warning` will indicate best-effort mode.
