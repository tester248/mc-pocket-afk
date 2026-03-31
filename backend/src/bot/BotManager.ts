import mineflayer, { type Bot, type BotOptions } from "mineflayer";

import { AntiAfkController } from "./antiafk/AntiAfkController";
import { FabricPayloadInjector } from "./fabric/PayloadInjector";
import { resolveConnectVersion } from "./VersionResolver";
import type {
  AntiAfkMode,
  ConcreteAntiAfkMode,
  ConnectConfig,
  ServerEvent,
} from "../types/protocol";

interface BotManagerCallbacks {
  onEvent: (event: ServerEvent) => void;
}

interface MsaCodePayload {
  userCode?: string;
  verificationUri?: string;
  message?: string;
}

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

const normalizeHost = (host: string): string => {
  return host.trim();
};

export class BotManager {
  private bot: Bot | null = null;
  private lastConfig: ConnectConfig | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private shouldReconnect = false;

  private readonly antiAfk: AntiAfkController;
  private fabricInjector: FabricPayloadInjector | null = null;

  public constructor(private readonly callbacks: BotManagerCallbacks) {
    this.antiAfk = new AntiAfkController({
      onModesChanged: (activeModes) => {
        this.emit({ event: "afk_state", activeModes });
      },
      onInfo: (message) => {
        this.emit({ event: "ack", action: "afk", message });
      },
      onError: (message) => {
        this.emit({ event: "error", message });
      },
    });
  }

  public async connect(config: ConnectConfig): Promise<void> {
    const normalizedHost = normalizeHost(config.host);
    if (!normalizedHost) {
      throw new Error("A server host is required.");
    }

    if (this.bot) {
      await this.disconnect("switching_server");
    }

    const normalizedConfig: ConnectConfig = {
      ...config,
      host: normalizedHost,
    };

    const versionResolution = await resolveConnectVersion(normalizedConfig);
    const resolvedConfig: ConnectConfig = {
      ...normalizedConfig,
      version: versionResolution.resolvedVersion,
    };

    this.emit({
      event: "version_resolution",
      requestedVersion: versionResolution.requestedVersion,
      resolvedVersion: versionResolution.resolvedVersion,
      source: versionResolution.source,
      detectedVersionName: versionResolution.detectedVersionName,
      detectedProtocol: versionResolution.detectedProtocol,
      warning: versionResolution.warning,
    });

    if (versionResolution.warning) {
      this.emit({ event: "ack", action: "version", message: versionResolution.warning });
    }

    this.lastConfig = resolvedConfig;
    this.shouldReconnect = true;
    this.clearReconnect();

    this.emit({
      event: "status",
      state: "connecting",
      message: `Connecting to server with version '${versionResolution.resolvedVersion}'...`,
    });

    const botOptions: BotOptions & {
      onMsaCode?: (code: MsaCodePayload) => void;
    } = {
      host: normalizedHost,
      port: resolvedConfig.port,
      version: resolvedConfig.version,
      username: this.resolveUsername(resolvedConfig),
      auth: resolvedConfig.authMode === "premium" ? "microsoft" : "offline",
      onMsaCode: (code: MsaCodePayload) => {
        const event: ServerEvent = {
          event: "msa_code",
          code: code.userCode ?? code.message ?? "Open microsoft.com/link and enter your code.",
          verificationUri: code.verificationUri,
        };
        this.emit(event);
      },
    };

    this.bot = mineflayer.createBot(botOptions as unknown as BotOptions);
    this.antiAfk.setBot(this.bot);
    this.attachFabricInjector(this.bot, resolvedConfig);
    this.attachBotListeners(this.bot, resolvedConfig);
  }

  public async disconnect(reason = "manual_disconnect"): Promise<void> {
    this.shouldReconnect = false;
    this.clearReconnect();

    this.antiAfk.stop();

    const currentBot = this.bot;
    this.bot = null;
    this.antiAfk.setBot(null);
    this.fabricInjector = null;

    if (currentBot) {
      try {
        currentBot.quit(reason);
      } catch {
        try {
          currentBot.end(reason);
        } catch {
          // no-op
        }
      }
    }

    this.emit({ event: "status", state: "disconnected", message: reason });
  }

  public sendChat(text: string): void {
    const bot = this.requireBot();
    bot.chat(text);
  }

  public startAfk(mode: AntiAfkMode): void {
    this.requireBot();
    this.antiAfk.start(mode);
  }

  public stopAfk(mode?: AntiAfkMode): void {
    this.antiAfk.stop(mode);
  }

  public getActiveAfkModes(): ConcreteAntiAfkMode[] {
    return this.antiAfk.getActiveModes();
  }

  private resolveUsername(config: ConnectConfig): string {
    if (config.authMode === "premium") {
      return config.username?.trim() || "MCPocketAFK";
    }

    return config.username?.trim() || `MCPocketAFK_${Math.floor(Math.random() * 9_999)}`;
  }

  private requireBot(): Bot {
    if (!this.bot) {
      throw new Error("Bot is not connected.");
    }

    return this.bot;
  }

  private attachBotListeners(bot: Bot, config: ConnectConfig): void {
    bot.once("spawn", () => {
      this.reconnectAttempts = 0;
      this.emit({ event: "status", state: "connected", message: "Bot spawned successfully." });

      if (config.autoCommand?.trim()) {
        bot.chat(config.autoCommand.trim());
      }

      this.emit({
        event: "vitals",
        health: bot.health,
        food: bot.food,
      });
    });

    bot.on("message", (message) => {
      this.emit({ event: "chat", text: message.toString() });
    });

    bot.on("health", () => {
      this.emit({
        event: "vitals",
        health: bot.health,
        food: bot.food,
      });
    });

    bot.on("error", (error) => {
      this.emit({ event: "error", message: `Bot error: ${toErrorMessage(error)}` });
    });

    bot.on("kicked", (reason) => {
      this.emit({ event: "error", message: `Kicked: ${toErrorMessage(reason)}` });
    });

    bot.on("end", (reason) => {
      this.antiAfk.stop();
      this.fabricInjector = null;
      this.emit({ event: "status", state: "disconnected", message: `Connection ended: ${reason}` });
      this.scheduleReconnect(`end:${reason}`);
    });
  }

  private attachFabricInjector(bot: Bot, config: ConnectConfig): void {
    this.fabricInjector = null;

    if (!config.fabricProfile) {
      return;
    }

    if (
      config.fabricProfile.gameVersion &&
      config.version &&
      config.fabricProfile.gameVersion !== config.version
    ) {
      this.emit({
        event: "error",
        message: `Fabric profile version '${config.fabricProfile.gameVersion}' does not match resolved version '${config.version}'.`,
      });
      return;
    }

    this.fabricInjector = FabricPayloadInjector.fromProfile(config.fabricProfile, {
      onInfo: (message) => {
        this.emit({ event: "ack", action: "fabric", message });
      },
      onError: (message) => {
        this.emit({ event: "error", message });
      },
    });

    this.fabricInjector?.attach(bot);
  }

  private scheduleReconnect(reason: string): void {
    if (!this.shouldReconnect || !this.lastConfig || this.reconnectTimer) {
      return;
    }

    this.reconnectAttempts += 1;
    const delayMs = Math.min(30_000, 2_000 * 2 ** (this.reconnectAttempts - 1));

    this.emit({
      event: "status",
      state: "reconnecting",
      message: `Reconnect scheduled in ${delayMs}ms (attempt ${this.reconnectAttempts}).`,
    });
    this.emit({ event: "reconnect_scheduled", attempt: this.reconnectAttempts, delayMs, reason });

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.lastConfig || !this.shouldReconnect) {
        return;
      }

      void this.connect(this.lastConfig).catch((error) => {
        this.emit({ event: "error", message: `Reconnect failed: ${toErrorMessage(error)}` });
        this.scheduleReconnect("reconnect_failed");
      });
    }, delayMs);
  }

  private clearReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private emit(event: ServerEvent): void {
    this.callbacks.onEvent(event);
  }
}
