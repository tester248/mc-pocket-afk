import {
  AFK_MODES,
  type AntiAfkMode,
  type ClientAction,
  type ConnectConfig,
} from "../types/protocol";

type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord => {
  return typeof value === "object" && value !== null;
};

const isAntiAfkMode = (value: unknown): value is AntiAfkMode => {
  return typeof value === "string" && (value === "all" || AFK_MODES.some((mode) => mode === value));
};

export const parseConnectConfig = (value: unknown): ConnectConfig | null => {
  if (!isRecord(value)) {
    return null;
  }

  const hostCandidate =
    typeof value.host === "string"
      ? value.host
      : typeof value.ip === "string"
        ? value.ip
        : "";

  if (!hostCandidate.trim()) {
    return null;
  }

  const authCandidate = value.authMode ?? value.auth;
  const authMode =
    authCandidate === "premium" || authCandidate === "microsoft" ? "premium" : "cracked";

  const config: ConnectConfig = {
    host: hostCandidate.trim(),
    authMode,
  };

  if (typeof value.port === "number" && Number.isInteger(value.port)) {
    config.port = value.port;
  }

  if (typeof value.version === "string" && value.version.trim()) {
    config.version = value.version.trim();
  }

  if (typeof value.username === "string" && value.username.trim()) {
    config.username = value.username.trim();
  }

  if (typeof value.autoCommand === "string" && value.autoCommand.trim()) {
    config.autoCommand = value.autoCommand.trim();
  }

  if (isRecord(value.fabricProfile)) {
    const fabricProfile: ConnectConfig["fabricProfile"] = {};

    if (typeof value.fabricProfile.gameVersion === "string" && value.fabricProfile.gameVersion.trim()) {
      fabricProfile.gameVersion = value.fabricProfile.gameVersion.trim();
    }

    if (typeof value.fabricProfile.registerPayloadBase64 === "string") {
      fabricProfile.registerPayloadBase64 = value.fabricProfile.registerPayloadBase64;
    }

    if (Array.isArray(value.fabricProfile.channels)) {
      const channels = value.fabricProfile.channels
        .filter((entry): entry is { channel: string; dataBase64: string } => {
          return (
            isRecord(entry) &&
            typeof entry.channel === "string" &&
            typeof entry.dataBase64 === "string"
          );
        })
        .map((entry) => ({
          channel: entry.channel,
          dataBase64: entry.dataBase64,
        }));

      fabricProfile.channels = channels;
    }

    config.fabricProfile = fabricProfile;
  }

  return config;
};

export const parseClientAction = (raw: string): ClientAction | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isRecord(parsed)) {
    return null;
  }

  const actionName =
    typeof parsed.action === "string"
      ? parsed.action
      : typeof parsed.command === "string"
        ? parsed.command
        : null;

  if (!actionName) {
    return null;
  }

  switch (actionName) {
    case "connect": {
      const configSource = isRecord(parsed.config) ? parsed.config : parsed;
      const config = parseConnectConfig(configSource);
      if (!config) {
        return null;
      }
      return { action: "connect", config };
    }
    case "disconnect": {
      return {
        action: "disconnect",
        reason: typeof parsed.reason === "string" ? parsed.reason : undefined,
      };
    }
    case "chat": {
      const textCandidate = typeof parsed.text === "string" ? parsed.text : parsed.message;
      if (typeof textCandidate !== "string") {
        return null;
      }
      return { action: "chat", text: textCandidate };
    }
    case "start_afk": {
      if (!isAntiAfkMode(parsed.type)) {
        return null;
      }
      return { action: "start_afk", type: parsed.type };
    }
    case "stop_afk": {
      if (parsed.type !== undefined && !isAntiAfkMode(parsed.type)) {
        return null;
      }
      return {
        action: "stop_afk",
        type: parsed.type as AntiAfkMode | undefined,
      };
    }
    case "ping": {
      return {
        action: "ping",
        ts: typeof parsed.ts === "number" ? parsed.ts : undefined,
      };
    }
    default:
      return null;
  }
};
