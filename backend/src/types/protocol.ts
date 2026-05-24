export type AuthMode = "cracked" | "premium";

export type AntiAfkMode = "swing" | "look" | "jump" | "fish" | "all";
export type ConcreteAntiAfkMode = Exclude<AntiAfkMode, "all">;

export interface FabricPayloadEntry {
  channel: string;
  dataBase64: string;
}

export interface FabricProfile {
  gameVersion?: string;
  registerPayloadBase64?: string;
  channels?: FabricPayloadEntry[];
}

export interface ConnectConfig {
  host: string;
  port?: number;
  version?: string;
  authMode: AuthMode;
  username?: string;
  autoCommand?: string;
  reconnectMaxAttempts?: number;
  versionPingTimeoutMs?: number;
  msaLoginTimeoutMs?: number;
  fabricHandshakeTimeoutMs?: number;
  fabricProfile?: FabricProfile;
}

export interface ConnectAction {
  action: "connect";
  config: ConnectConfig;
  sessionId?: string; // optional; if not provided, server generates one
}

export interface DisconnectAction {
  action: "disconnect";
  reason?: string;
  sessionId?: string;
}

export interface ChatAction {
  action: "chat";
  text: string;
  sessionId?: string;
}

export interface StartAfkAction {
  action: "start_afk";
  type: AntiAfkMode;
  sessionId?: string;
}

export interface StopAfkAction {
  action: "stop_afk";
  type?: AntiAfkMode;
  sessionId?: string;
}

export interface PingAction {
  action: "ping";
  ts?: number;
}

export type ClientAction =
  | ConnectAction
  | DisconnectAction
  | ChatAction
  | StartAfkAction
  | StopAfkAction
  | PingAction;

export type ConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "reconnecting";

export interface StatusEvent {
  event: "status";
  state: ConnectionState;
  message?: string;
  sessionId?: string;
}

export interface ChatEvent {
  event: "chat";
  text: string;
  sessionId?: string;
}

export interface ErrorEvent {
  event: "error";
  message: string;
  sessionId?: string;
}

export interface AckEvent {
  event: "ack";
  action: string;
  message?: string;
  sessionId?: string;
}

export interface MsaCodeEvent {
  event: "msa_code";
  code: string;
  verificationUri?: string;
}

export interface AfkStateEvent {
  event: "afk_state";
  activeModes: ConcreteAntiAfkMode[];
}

export interface VitalsEvent {
  event: "vitals";
  health: number;
  food: number;
}

export interface ReconnectScheduledEvent {
  event: "reconnect_scheduled";
  attempt: number;
  delayMs: number;
  reason: string;
}

export interface ReconnectExhaustedEvent {
  event: "reconnect_exhausted";
  attempts: number;
  reason: string;
}

export interface PongEvent {
  event: "pong";
  ts: number;
}

export type VersionResolutionSource = "requested" | "detected" | "default";

export interface VersionResolutionEvent {
  event: "version_resolution";
  requestedVersion?: string;
  resolvedVersion: string;
  source: VersionResolutionSource;
  tested: boolean;
  detectedVersionName?: string;
  detectedProtocol?: number;
  warning?: string;
}

export type ServerEvent =
  | StatusEvent
  | ChatEvent
  | ErrorEvent
  | AckEvent
  | MsaCodeEvent
  | AfkStateEvent
  | VitalsEvent
  | ReconnectScheduledEvent
  | ReconnectExhaustedEvent
  | PongEvent
  | VersionResolutionEvent;

export const AFK_MODES: ConcreteAntiAfkMode[] = ["swing", "look", "jump", "fish"];
