import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type AuthMode = "cracked" | "premium";
type AfkMode = "all" | "swing" | "look" | "jump" | "fish";
type SocketState = "disconnected" | "connecting" | "connected";

interface MobileProfile {
  backendUrl: string;
  host: string;
  port: string;
  authMode: AuthMode;
  username: string;
  version: string;
  autoCommand: string;
}

interface VersionResolutionState {
  source?: string;
  resolvedVersion?: string;
  tested?: boolean;
  warning?: string;
}

const STORAGE_KEY = "mcpocketafk.mobile.profile.v1";
const DEFAULT_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_WS_URL ?? "ws://localhost:8080";

const DEFAULT_PROFILE: MobileProfile = {
  backendUrl: DEFAULT_BACKEND_URL,
  host: "",
  port: "25565",
  authMode: "cracked",
  username: "",
  version: "",
  autoCommand: "",
};

const appendWithLimit = (items: string[], next: string): string[] => {
  const capped = [...items, next];
  if (capped.length <= 140) {
    return capped;
  }

  return capped.slice(capped.length - 140);
};

const ActionButton = ({
  label,
  onPress,
  variant = "primary",
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
}) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.button,
        variant === "secondary" ? styles.buttonSecondary : undefined,
        variant === "danger" ? styles.buttonDanger : undefined,
      ]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </TouchableOpacity>
  );
};

export default function App() {
  const [profile, setProfile] = useState<MobileProfile>(DEFAULT_PROFILE);
  const [socketState, setSocketState] = useState<SocketState>("disconnected");
  const [botState, setBotState] = useState("idle");
  const [keepAliveEnabled, setKeepAliveEnabled] = useState(true);
  const [chatText, setChatText] = useState("");
  const [versionResolution, setVersionResolution] = useState<VersionResolutionState>({});
  const [events, setEvents] = useState<string[]>([]);

  const socketRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const log = (message: string): void => {
    const stamp = new Date().toLocaleTimeString();
    setEvents((prev) => appendWithLimit(prev, `[${stamp}] ${message}`));
  };

  const setProfileField = (key: keyof MobileProfile, value: string): void => {
    setProfile((prev) => ({ ...prev, [key]: value }));
  };

  const stopPinger = (): void => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  };

  const sendAction = (action: Record<string, unknown>): void => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      log("Cannot send action while WebSocket is disconnected.");
      return;
    }

    socketRef.current.send(JSON.stringify(action));
  };

  const disconnectSocket = (): void => {
    stopPinger();

    if (socketRef.current) {
      socketRef.current.close(1000, "mobile_disconnect");
      socketRef.current = null;
    }

    setSocketState("disconnected");
  };

  const parseEvent = (raw: string): void => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      log(`RAW ${raw}`);
      return;
    }

    if (typeof parsed !== "object" || parsed === null) {
      return;
    }

    const event = parsed as Record<string, unknown>;
    const eventName = typeof event.event === "string" ? event.event : "unknown";

    switch (eventName) {
      case "status": {
        const state = typeof event.state === "string" ? event.state : "unknown";
        setBotState(state);
        const detail = typeof event.message === "string" ? ` (${event.message})` : "";
        log(`STATUS ${state}${detail}`);
        break;
      }
      case "version_resolution": {
        setVersionResolution({
          source: typeof event.source === "string" ? event.source : undefined,
          resolvedVersion:
            typeof event.resolvedVersion === "string" ? event.resolvedVersion : undefined,
          tested: typeof event.tested === "boolean" ? event.tested : undefined,
          warning: typeof event.warning === "string" ? event.warning : undefined,
        });

        const resolved = typeof event.resolvedVersion === "string" ? event.resolvedVersion : "?";
        const tested = typeof event.tested === "boolean" ? event.tested : false;
        log(`VERSION ${resolved} (${tested ? "tested" : "best-effort"})`);
        break;
      }
      case "msa_code": {
        const code = typeof event.code === "string" ? event.code : "(missing code)";
        log(`MSA CODE ${code}`);
        break;
      }
      case "chat": {
        const text = typeof event.text === "string" ? event.text : "";
        log(`CHAT ${text}`);
        break;
      }
      case "error": {
        const message = typeof event.message === "string" ? event.message : "Unknown error";
        log(`ERROR ${message}`);
        break;
      }
      case "ack": {
        const action = typeof event.action === "string" ? event.action : "unknown";
        const message = typeof event.message === "string" ? event.message : "ack";
        log(`ACK ${action}: ${message}`);
        break;
      }
      default: {
        log(`EVENT ${eventName} ${JSON.stringify(event)}`);
      }
    }
  };

  const connectSocket = (): void => {
    const backendUrl = profile.backendUrl.trim();
    if (!backendUrl) {
      log("Set backend WebSocket URL first.");
      return;
    }

    disconnectSocket();
    setSocketState("connecting");

    const socket = new WebSocket(backendUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      setSocketState("connected");
      log(`WS CONNECTED ${backendUrl}`);
    };

    socket.onmessage = (event) => {
      parseEvent(String(event.data));
    };

    socket.onerror = () => {
      log("WS ERROR");
    };

    socket.onclose = () => {
      setSocketState("disconnected");
      stopPinger();
      log("WS DISCONNECTED");
    };
  };

  const saveProfile = async (): Promise<void> => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
      log("Profile saved locally.");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log(`Profile save failed: ${message}`);
    }
  };

  const loadProfile = async (): Promise<void> => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as Partial<MobileProfile>;
      setProfile((prev) => ({ ...prev, ...parsed }));
      log("Profile loaded from local storage.");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log(`Profile load failed: ${message}`);
    }
  };

  const sendBotConnect = (): void => {
    const host = profile.host.trim();
    if (!host) {
      log("Server host is required.");
      return;
    }

    const config: Record<string, unknown> = {
      host,
      authMode: profile.authMode,
    };

    const portValue = Number.parseInt(profile.port.trim(), 10);
    if (!Number.isNaN(portValue) && portValue > 0) {
      config.port = portValue;
    }

    if (profile.username.trim()) {
      config.username = profile.username.trim();
    }

    if (profile.version.trim()) {
      config.version = profile.version.trim();
    }

    if (profile.autoCommand.trim()) {
      config.autoCommand = profile.autoCommand.trim();
    }

    sendAction({ action: "connect", config });
  };

  const sendChat = (): void => {
    const text = chatText.trim();
    if (!text) {
      return;
    }

    sendAction({ action: "chat", text });
    setChatText("");
  };

  useEffect(() => {
    void loadProfile();

    return () => {
      disconnectSocket();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    stopPinger();

    if (!keepAliveEnabled || socketState !== "connected") {
      return;
    }

    pingIntervalRef.current = setInterval(() => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ action: "ping", ts: Date.now() }));
      }
    }, 25_000);

    return () => {
      stopPinger();
    };
  }, [keepAliveEnabled, socketState]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>MCPocketAFK Mobile Control</Text>
        <Text style={styles.subtitle}>Backend-first MVP control surface</Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Backend Session</Text>
          <TextInput
            style={styles.input}
            placeholder="ws://localhost:8080"
            value={profile.backendUrl}
            onChangeText={(value) => setProfileField("backendUrl", value)}
            autoCapitalize="none"
          />
          <View style={styles.row}>
            <ActionButton label="Connect WS" onPress={connectSocket} />
            <ActionButton label="Disconnect WS" variant="secondary" onPress={disconnectSocket} />
          </View>
          <View style={styles.row}>
            <ActionButton label="Save Profile" variant="secondary" onPress={() => void saveProfile()} />
            <ActionButton label="Load Profile" variant="secondary" onPress={() => void loadProfile()} />
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>WebSocket:</Text>
            <Text style={styles.metaValue}>{socketState}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Bot:</Text>
            <Text style={styles.metaValue}>{botState}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Server Config</Text>
          <TextInput
            style={styles.input}
            placeholder="mc.example.com"
            value={profile.host}
            onChangeText={(value) => setProfileField("host", value)}
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="25565"
            value={profile.port}
            onChangeText={(value) => setProfileField("port", value)}
            keyboardType="number-pad"
          />
          <View style={styles.row}>
            <ActionButton
              label="Auth: Cracked"
              variant={profile.authMode === "cracked" ? "primary" : "secondary"}
              onPress={() => setProfile((prev) => ({ ...prev, authMode: "cracked" }))}
            />
            <ActionButton
              label="Auth: Premium"
              variant={profile.authMode === "premium" ? "primary" : "secondary"}
              onPress={() => setProfile((prev) => ({ ...prev, authMode: "premium" }))}
            />
          </View>
          <TextInput
            style={styles.input}
            placeholder="Username (optional)"
            value={profile.username}
            onChangeText={(value) => setProfileField("username", value)}
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="Version (optional) e.g. 1.20.4"
            value={profile.version}
            onChangeText={(value) => setProfileField("version", value)}
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="Auto command (optional)"
            value={profile.autoCommand}
            onChangeText={(value) => setProfileField("autoCommand", value)}
            autoCapitalize="none"
          />

          <View style={styles.row}>
            <ActionButton label="Bot Connect" onPress={sendBotConnect} />
            <ActionButton
              label="Bot Disconnect"
              variant="danger"
              onPress={() => sendAction({ action: "disconnect", reason: "mobile_requested" })}
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Anti-AFK</Text>
          <View style={styles.rowWrap}>
            {(["all", "swing", "look", "jump", "fish"] as AfkMode[]).map((mode) => (
              <TouchableOpacity
                key={mode}
                style={styles.chip}
                onPress={() => sendAction({ action: "start_afk", type: mode })}
              >
                <Text style={styles.chipText}>Start {mode}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.chip, styles.chipDanger]}
              onPress={() => sendAction({ action: "stop_afk" })}
            >
              <Text style={styles.chipText}>Stop All</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Chat</Text>
          <TextInput
            style={styles.input}
            placeholder="Type message or command"
            value={chatText}
            onChangeText={setChatText}
            autoCapitalize="none"
          />
          <View style={styles.row}>
            <ActionButton label="Send Chat" onPress={sendChat} />
            <ActionButton
              label="Ping Backend"
              variant="secondary"
              onPress={() => sendAction({ action: "ping", ts: Date.now() })}
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Version Diagnostics</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Resolved:</Text>
            <Text style={styles.metaValue}>{versionResolution.resolvedVersion ?? "-"}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Source:</Text>
            <Text style={styles.metaValue}>{versionResolution.source ?? "-"}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Policy:</Text>
            <Text style={styles.metaValue}>
              {versionResolution.tested === undefined
                ? "-"
                : versionResolution.tested
                  ? "tested"
                  : "best-effort"}
            </Text>
          </View>
          {versionResolution.warning ? (
            <Text style={styles.warningText}>{versionResolution.warning}</Text>
          ) : null}
        </View>

        <View style={styles.card}>
          <View style={styles.metaRow}>
            <Text style={styles.sectionTitle}>Keep-Alive Pinger</Text>
            <Switch value={keepAliveEnabled} onValueChange={setKeepAliveEnabled} />
          </View>
          <Text style={styles.metaHint}>Sends ping every 25 seconds while WebSocket is connected.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Event Stream</Text>
          <View style={styles.logPanel}>
            {events.length === 0 ? <Text style={styles.logLine}>No events yet.</Text> : null}
            {events.map((line, idx) => (
              <Text key={`${line}-${idx}`} style={styles.logLine}>
                {line}
              </Text>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f2efe8",
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#102a43",
  },
  subtitle: {
    marginTop: 2,
    marginBottom: 4,
    fontSize: 14,
    color: "#52606d",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e4e7eb",
    gap: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1f2933",
  },
  input: {
    borderWidth: 1,
    borderColor: "#d2d6dc",
    backgroundColor: "#f8f9fb",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#1f2933",
  },
  row: {
    flexDirection: "row",
    gap: 8,
  },
  rowWrap: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  button: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    backgroundColor: "#0b6efd",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  buttonSecondary: {
    backgroundColor: "#6c757d",
  },
  buttonDanger: {
    backgroundColor: "#c92a2a",
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  chip: {
    borderRadius: 999,
    backgroundColor: "#0b6efd",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipDanger: {
    backgroundColor: "#c92a2a",
  },
  chipText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 12,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  metaLabel: {
    color: "#52606d",
    fontSize: 13,
    fontWeight: "600",
  },
  metaValue: {
    color: "#102a43",
    fontSize: 13,
    fontWeight: "700",
  },
  warningText: {
    marginTop: 2,
    color: "#b36b00",
    fontSize: 12,
    lineHeight: 17,
  },
  metaHint: {
    color: "#52606d",
    fontSize: 12,
  },
  logPanel: {
    borderWidth: 1,
    borderColor: "#d2d6dc",
    backgroundColor: "#f8f9fb",
    borderRadius: 10,
    minHeight: 150,
    maxHeight: 260,
    padding: 10,
    gap: 5,
  },
  logLine: {
    color: "#334e68",
    fontSize: 12,
  },
});
