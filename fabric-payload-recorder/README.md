# Fabric Payload Recorder

A Fabric client mod for Minecraft 1.21.11 that generates a template Fabric profile JSON compatible with MCPocketAFK.

## Overview

Due to API changes in Minecraft 1.21.11, automatically capturing custom payloads requires complex packet interception. This mod takes a simplified approach:

1. **Generates a template** `fabric-profile-template.json` when you join a server.
2. **Provides the JSON structure** that you can populate with your server's actual payloads.
3. **Integrates with MCPocketAFK** — the resulting profile can be imported via the mobile app.

## How to get your server's payloads

There are several methods to capture the actual custom payloads your server sends:

### Method 1: Use a packet capture tool (Recommended)

Tools like **Wireshark**, **tcpdump**, or **mitmproxy** can intercept Minecraft packets. However, if using Microsoft auth, traffic is encrypted.

### Method 2: Use a debug proxy

Set up a proxy like **ViaVersion**, **BungeeCord**, or **Waterfall** and add logging to capture custom payloads server-side.

### Method 3: Check server mod documentation

Many Fabric servers publish their required payloads in documentation or mod changelogs.

### Method 4: Manually encode payloads

If you know what data your server expects, you can:
1. Write the data to a file.
2. Encode it to Base64: `base64 -w0 < data.bin`.
3. Add it to the `fabric-profile.json`.

## Installation & Usage

### Build the mod

```bash
cd fabric-payload-recorder
gradle build
```

Output: `build/libs/payload-recorder.jar`

### Install in Minecraft

1. Download or build the mod JAR.
2. Copy it to your Fabric profile's `mods/` folder:
   - Linux: `~/.minecraft/mods/`
   - Windows: `%APPDATA%\.minecraft\mods\`
   - macOS: `~/Library/Application Support/minecraft/mods/`
3. Launch Minecraft with Fabric Loader 0.19.2+ for Minecraft 1.21.11.
4. Join a server → the template `fabric-profile-template.json` is written to your Minecraft working directory.

### Populate the template

1. Open `fabric-profile-template.json` (created in your Minecraft working directory).
2. Replace the example payloads with your server's actual payloads (using one of the methods above).
3. Rename it to `fabric-profile.json`.
4. **Import into MCPocketAFK**:
   - Copy the file to your mobile device.
   - Open the MCPocketAFK app → Dashboard → **Import Fabric Profile** button.
   - The profile is now saved and will be sent on every connect.

## Example fabric-profile.json

```json
{
  "gameVersion": "1.21.11",
  "registerPayloadBase64": "dGVzdF9yZWdpc3Rlcl9wYXlsb2Fk",
  "channels": [
    {
      "channel": "fabric:screen-handler-factory",
      "dataBase64": "dGVzdF9jaGFubmVsX3BheWxvYWQ="
    },
    {
      "channel": "fabric:networking",
      "dataBase64": "YW5vdGhlcl9wYXlsb2Fk"
    }
  ]
}
```

## Build Info

- **Minecraft**: 1.21.11
- **Fabric Loader**: 0.19.2
- **Fabric API**: 0.141.4+1.21.11
- **Yarn Mappings**: 1.21.11+build.5

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Mod doesn't load | Ensure Fabric Loader 0.19.2 is installed and the JAR is in `mods/` folder. |
| No template file created | Make sure you actually join the server (wait for player spawn). Template is created on join. |
| Template file not found | Check your Minecraft working directory (where `launcher_profiles.json` is located). |

## License

MIT

