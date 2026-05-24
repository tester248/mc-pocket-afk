import { createServer, type Server as HttpServer } from "node:http";
import { randomUUID } from "node:crypto";

import WebSocket, { WebSocketServer } from "ws";

import { BotManager, type BotManagerOptions } from "../bot/BotManager";
import { parseClientAction } from "./parsers";
import { type ClientAction, type ServerEvent } from "../types/protocol";

interface WSServerOptions {
  host: string;
  port: number;
  botDefaults?: Partial<BotManagerOptions>;
}

const sendJson = (socket: WebSocket, event: ServerEvent): void => {
  if (socket.readyState !== WebSocket.OPEN) {
    return;
  }

  socket.send(JSON.stringify(event));
};

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

export class MCPocketAFKWebSocketServer {
  private readonly httpServer: HttpServer;
  private readonly wsServer: WebSocketServer;
  private readonly botDefaults: Partial<BotManagerOptions>;

  public constructor(private readonly options: WSServerOptions) {
    this.botDefaults = options.botDefaults ?? {};
    this.httpServer = createServer((request, response) => {
      if (request.url === "/healthz") {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ ok: true, service: "MCPocketAFK backend" }));
        return;
      }

      response.writeHead(404, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "Not found" }));
    });

    this.wsServer = new WebSocketServer({ server: this.httpServer });
  }

  public async start(): Promise<void> {
    this.wsServer.on("connection", (socket) => {
      // Map of sessionId -> BotManager for multi-session support
      const managers = new Map<string, BotManager>();

      sendJson(socket, {
        event: "status",
        state: "idle",
        message: "Connected to MCPocketAFK backend WebSocket.",
      });

      socket.on("message", (data, isBinary) => {
        if (isBinary) {
          sendJson(socket, { event: "error", message: "Binary frames are not supported." });
          return;
        }

        const text = data.toString();
        const action = parseClientAction(text);
        if (!action) {
          sendJson(socket, { event: "error", message: "Invalid action payload." });
          return;
        }

        void this.handleAction(socket, managers, action);
      });

      socket.on("close", () => {
        // Disconnect all sessions when client disconnects
        for (const manager of managers.values()) {
          void manager.disconnect("ws_client_closed");
        }
        managers.clear();
      });

      socket.on("error", (error) => {
        sendJson(socket, { event: "error", message: `WebSocket error: ${toErrorMessage(error)}` });
      });
    });

    await new Promise<void>((resolve) => {
      this.httpServer.listen(this.options.port, this.options.host, () => resolve());
    });
  }

  public async stop(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.wsServer.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

    await new Promise<void>((resolve, reject) => {
      this.httpServer.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  private async handleAction(
    socket: WebSocket,
    managers: Map<string, BotManager>,
    action: ClientAction,
  ): Promise<void> {
    try {
      // For connect, generate a sessionId if not provided
      if (action.action === "connect") {
        const sessionId = action.sessionId ?? randomUUID();
        const manager = new BotManager({
          onEvent: (event) => {
            sendJson(socket, { ...event, sessionId });
          },
        }, this.botDefaults);
        managers.set(sessionId, manager);

        await manager.connect(action.config);
        sendJson(socket, { event: "ack", action: "connect", message: "Connect request accepted.", sessionId });
        return;
      }

      // For other actions, sessionId must be provided or default to first/only manager
      let sessionId = action.sessionId;
      if (!sessionId) {
        // If no sessionId provided and there's only one manager, use it
        if (managers.size === 1) {
          sessionId = managers.keys().next().value;
        } else if (managers.size === 0) {
          sendJson(socket, { event: "error", message: "No active sessions. Use connect action first." });
          return;
        } else {
          sendJson(socket, { event: "error", message: "Multiple sessions active. sessionId is required." });
          return;
        }
      }

      const manager = managers.get(sessionId);
      if (!manager) {
        sendJson(socket, { event: "error", message: `Session '${sessionId}' not found.`, sessionId });
        return;
      }

      switch (action.action) {
        case "disconnect": {
          await manager.disconnect(action.reason ?? "client_requested");
          sendJson(socket, {
            event: "ack",
            action: "disconnect",
            message: "Disconnect request processed.",
            sessionId,
          });
          managers.delete(sessionId);
          break;
        }
        case "chat": {
          if (!action.text.trim()) {
            sendJson(socket, { event: "error", message: "Chat text cannot be empty.", sessionId });
            return;
          }

          manager.sendChat(action.text.trim());
          sendJson(socket, {
            event: "ack",
            action: "chat",
            message: "Chat sent to server.",
            sessionId,
          });
          break;
        }
        case "start_afk": {
          manager.startAfk(action.type);
          sendJson(socket, {
            event: "ack",
            action: "start_afk",
            message: `Anti-AFK mode '${action.type}' started.`,
            sessionId,
          });
          break;
        }
        case "stop_afk": {
          manager.stopAfk(action.type);
          sendJson(socket, {
            event: "ack",
            action: "stop_afk",
            message: action.type
              ? `Anti-AFK mode '${action.type}' stopped.`
              : "All Anti-AFK modes stopped.",
            sessionId,
          });
          break;
        }
        case "ping": {
          sendJson(socket, { event: "pong", ts: Date.now(), sessionId });
          break;
        }
        default:
          sendJson(socket, { event: "error", message: "Unsupported action.", sessionId });
      }
    } catch (error) {
      sendJson(socket, { event: "error", message: `Action failed: ${toErrorMessage(error)}` });
    }
  }
}
