import { createServer, type Server as HttpServer } from "node:http";

import WebSocket, { WebSocketServer } from "ws";

import { BotManager } from "../bot/BotManager";
import { parseClientAction } from "./parsers";
import { type ClientAction, type ServerEvent } from "../types/protocol";

interface WSServerOptions {
  host: string;
  port: number;
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

  public constructor(private readonly options: WSServerOptions) {
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
      const manager = new BotManager({
        onEvent: (event) => {
          sendJson(socket, event);
        },
      });

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

        void this.handleAction(socket, manager, action);
      });

      socket.on("close", () => {
        void manager.disconnect("ws_client_closed");
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
    manager: BotManager,
    action: ClientAction,
  ): Promise<void> {
    try {
      switch (action.action) {
        case "connect": {
          await manager.connect(action.config);
          sendJson(socket, { event: "ack", action: "connect", message: "Connect request accepted." });
          break;
        }
        case "disconnect": {
          await manager.disconnect(action.reason ?? "client_requested");
          sendJson(socket, {
            event: "ack",
            action: "disconnect",
            message: "Disconnect request processed.",
          });
          break;
        }
        case "chat": {
          if (!action.text.trim()) {
            sendJson(socket, { event: "error", message: "Chat text cannot be empty." });
            return;
          }

          manager.sendChat(action.text.trim());
          sendJson(socket, {
            event: "ack",
            action: "chat",
            message: "Chat sent to server.",
          });
          break;
        }
        case "start_afk": {
          manager.startAfk(action.type);
          sendJson(socket, {
            event: "ack",
            action: "start_afk",
            message: `Anti-AFK mode '${action.type}' started.`,
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
          });
          break;
        }
        case "ping": {
          sendJson(socket, { event: "pong", ts: Date.now() });
          break;
        }
        default:
          sendJson(socket, { event: "error", message: "Unsupported action." });
      }
    } catch (error) {
      sendJson(socket, { event: "error", message: `Action failed: ${toErrorMessage(error)}` });
    }
  }
}
