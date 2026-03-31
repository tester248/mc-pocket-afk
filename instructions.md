SYSTEM PROMPT & PROJECT BLUEPRINT

Project Name: WeaveBot (Placeholder)
Objective: Build a headless, mobile-controlled Minecraft Java Edition client capable of joining vanilla and Fabric-modded servers. The system uses a client-server architecture to bypass mobile background execution limits, featuring remote Anti-AFK controls, real-time chat, and secure authentication (Premium & Cracked).

1. TECH STACK

Frontend (Mobile App): React Native (Expo)

Backend (Bot Engine): Node.js (Hosted on Render/Serverless Container) using mineflayer.

Data Extraction (PC): Java (Fabric Modding API)

2. COMPONENT ARCHITECTURE & RESPONSIBILITIES

Component A: The React Native (Expo) App

Role: The UI and remote control.
Key Features to Implement:

Navigation & Local Storage:

Main Screen (Server List): Displays a list of saved servers. Users can add, edit, or delete server profiles. Server configurations are saved locally on the device (e.g., using AsyncStorage).

Server Dashboard Screen: Opened when tapping a specific server from the list. Contains all specific controls and settings for that server.

WebSocket Client: Maintains a persistent connection to the Node.js backend when a server dashboard is active.

Server-Specific Config (Inside the Server Dashboard): * Account Toggle: Switch between "Premium" (Microsoft Auth) and "Cracked" (Offline Auth) for this specific server.

If Cracked: Prompt for a custom Username.

If Premium: Display the Microsoft Device Authorization code.

Auto-Command Input: A field to specify a command to send automatically upon joining (e.g., /login mypassword).

Profile Importer: Uses expo-document-picker to let the user select a .json file containing their Fabric handshake data, attaching it to the current server profile.

Control Panel: Buttons to send WebSocket commands to the backend (e.g., {"command": "connect", "ip": "mc.server.com"}, {"command": "start_afk", "type": "fish"}).

Chat Interface: A scrollable text view displaying incoming chat messages from the server, and a text input field to send messages or console commands back to the server.

Keep-Alive Pinger: A background timer (while the app is open) that repeatedly pings the backend via HTTP/WS to prevent the Render free-tier from sleeping while the bot is actively connected.

Component B: The Node.js Backend (Render)

Role: The actual Minecraft client and connection manager.
Key Features to Implement:

WebSocket Server: Listens for commands from the Expo app and broadcasts bot status (health, hunger, chat messages, connection state).

Dynamic Authentication: * If Premium: Uses auth: 'microsoft'. Captures the onMsaCode event and emits the code over the WebSocket to the Expo app.

If Cracked: Uses auth: 'offline' and sets the username provided by the Mobile app.

Auto-Command Execution: Listens for the bot.once('spawn') event. If the mobile app provided an auto-command during the connection request, the backend uses bot.chat(autoCommand) to execute it immediately.

Chat & Command Relay: * Listens to bot.on('message') and forwards the parsed text to the Expo app via WebSocket.

Listens to WebSocket events for outgoing chat (e.g., {"command": "chat", "message": "hello world"}) and routes them through bot.chat().

Fabric Handshake Injector: When connecting, if Fabric .json data was provided by the app, it must use client.write('custom_payload', ...) to spoof the exact plugin channels and Registry Sync bytes required by the target server.

Anti-AFK Engine: Utilizes Mineflayer's native API for actions on loop when commanded:

Swing: Use bot.swingArm() on a timed interval.

Look: Use bot.look() to randomize yaw/pitch slightly.

Jump in Place: Toggle bot.setControlState('jump', true) and then false on a timer to avoid being kicked.

Auto-Fish: Utilize bot.equip(), bot.look(), and bot.fish() to cast the rod, wait for the catch event, and re-cast.

Component C: The Fabric Companion Mod (Java)

Role: A lightweight PC utility mod used once by the user to extract server-specific registry/mod data.
Key Features to Implement:

Packet Interceptor: Hooks into the Fabric networking API during server join.

Payload Recorder: Captures minecraft:register packets and the massive Fabric Registry Sync custom payload.

Data Exporter: Serializes these captured byte arrays into a structured server_profile.json file saved to the user's Minecraft directory.

3. CORE WORKFLOWS FOR THE AI AGENT

Workflow 1: Dynamic Connection & Auth

User selects a saved server from the Main Screen and opens its Dashboard.

User configures/updates the connection (IP, Premium/Cracked, Username, Auto-Command, Mod Profile).

Mobile sends the config object via WebSocket: {"action": "connect", "config": {...}}.

Backend initializes mineflayer using the provided auth type.

If Premium, backend relays Microsoft code; user authenticates.

Bot connects. Upon spawn event, backend fires the auto-command (if provided).

Backend notifies Mobile: {"status": "connected"}.

Workflow 2: Real-Time Chat Relay

Backend receives a chat packet from the MC server.

Backend parses the message to plain text and emits: {"event": "chat", "text": "[Server] Welcome!"}.

Mobile app appends the text to the Chat UI inside the active Server Dashboard.

User types /tpa Steve in the Mobile app and hits send.

Mobile emits: {"action": "chat", "text": "/tpa Steve"}.

Backend receives it and executes bot.chat('/tpa Steve').

Workflow 3: The Modded Connection Spoof

Mobile config includes fabricData extracted from the companion mod.

Backend connects to MC Server.

Backend listens for custom_payload requests from the server. It matches the channels requested by the server with the channels stored in fabricData, and responds with the spoofed byte buffers.

4. STRICT RULES FOR AI CODE GENERATION

DO NOT use complex physical pathfinding plugins (like mineflayer-pathfinder) or heavy block-breaking algorithms for Anti-AFK. Rely strictly on low-CPU Mineflayer built-ins to save resources on the free-tier backend.

DO NOT ask the user for a Microsoft password. For premium accounts, ALWAYS implement the Microsoft Device Authorization flow. Cracked accounts only require a username string.

DO NOT attempt to run raw Node.js TCP sockets (net module) inside the Expo App. The Expo app only communicates with the Backend via standard WebSockets.

CHAT PARSING: When forwarding chat from mineflayer to the frontend, ensure you are converting the complex chat objects to plain string text (e.g., message.toString()) before sending over WebSockets to avoid massive payload overhead.

LOCAL STORAGE: Ensure the React Native app uses local persistence (like @react-native-async-storage/async-storage) to save the list of servers and their individual configurations so data is not lost on app restart.