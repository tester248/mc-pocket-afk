# MCPocketAFK WebSocket API (Backend v0.1)

This document defines the current command and event contract between the mobile app and backend.

## Connection

- WebSocket endpoint: `ws://<host>:<port>/`
- Health endpoint: `http://<host>:<port>/healthz`

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
  }
}
```

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
  "reason": "user_requested"
}
```

### `chat`

```json
{
  "action": "chat",
  "text": "/tpa Steve"
}
```

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
  "type": "fish"
}
```

If `type` is omitted, all AFK modes are stopped.

### `ping`

```json
{
  "action": "ping"
}
```

## Outbound Events (Backend -> App)

### `status`

```json
{
  "event": "status",
  "state": "connected",
  "message": "Bot spawned successfully."
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
  "message": "Chat sent to server."
}
```

### `error`

```json
{
  "event": "error",
  "message": "Action failed: Bot is not connected."
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
  "detectedVersionName": "Paper 1.20.4",
  "detectedProtocol": 765,
  "warning": "Requested version '1.20.4' is not in the supported version list; attempting anyway."
}
```

Field notes:
- `source` can be `requested`, `detected`, or `default`.
- `requestedVersion` is present when app explicitly provided a version.
- `detectedVersionName` and `detectedProtocol` are present when backend ping detection succeeds.
- `warning` is present when backend had to fallback or continue with best-effort behavior.
