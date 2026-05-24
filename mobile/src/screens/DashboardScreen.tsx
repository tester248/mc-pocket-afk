import React, { useState, useEffect, useRef } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { Linking } from 'react-native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  Modal,
} from 'react-native';
import { NavigationRouteProp } from '@react-navigation/native';
import { RouteProp } from '@react-navigation/stack';

type AuthMode = 'cracked' | 'premium';
type AfkMode = 'all' | 'swing' | 'look' | 'jump' | 'fish';
type SocketState = 'disconnected' | 'connecting' | 'connected';

interface ServerProfile {
  id: string;
  host: string;
  port: string;
  authMode: AuthMode;
  username: string;
  version: string;
  autoCommand: string;
  fabricProfile?: any; // optional Fabric handshake payload
}

type DashboardRouteProp = RouteProp<{ params: { server: ServerProfile } }, 'params'>;

const DEFAULT_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_WS_URL ?? 'ws://localhost:8080';

export default function DashboardScreen({ route, navigation }: { route: DashboardRouteProp, navigation: any }) {
  const { server } = route.params;
  const [profile, setProfile] = useState<ServerProfile>(server);
  const [socketState, setSocketState] = useState<SocketState>('disconnected');
  const [botState, setBotState] = useState('idle');
  const [chatText, setChatText] = useState('');
  const [events, setEvents] = useState<string[]>([]);
  const [msaCode, setMsaCode] = useState<string | null>(null);
  const [msaVerificationUri, setMsaVerificationUri] = useState<string | null>(null);
  const [showMsaModal, setShowMsaModal] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);

  const log = (message: string) => {
    const stamp = new Date().toLocaleTimeString();
    setEvents(prev => [...prev.slice(-139), `[${stamp}] ${message}`]);
  };

  // Function to import a Fabric JSON profile using Expo Document Picker
  const importFabricProfile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
      if (result.type !== 'success') {
        log('Fabric profile import cancelled');
        return;
      }
      // Read file content via fetch (Expo supports fetching local file URIs)
      const response = await fetch(result.uri);
      const text = await response.text();
      const json = JSON.parse(text);
      setProfile(prev => ({ ...prev, fabricProfile: json }));
      log('Fabric profile imported');
    } catch (e) {
      log('Error importing fabric profile');
    }
  };

  const connect = () => {
    setSocketState('connecting');
    const ws = new WebSocket(DEFAULT_BACKEND_URL);
    socketRef.current = ws;

    ws.onopen = () => {
      setSocketState('connected');
      log('Connected to backend');
      ws.send(JSON.stringify({
        action: 'connect',
        config: {
          host: profile.host,
          port: parseInt(profile.port),
          authMode: profile.authMode,
          username: profile.username,
          autoCommand: profile.autoCommand,
          version: profile.version,
          ...(profile.fabricProfile ? { fabricProfile: profile.fabricProfile } : {}),
        }
      }));
    };

    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      log(JSON.stringify(data));
      if (data.event === 'bot_state') setBotState(data.state);
      if (data.event === 'msa_code') {
        setMsaCode(data.code);
        setMsaVerificationUri(data.verificationUri);
        setShowMsaModal(true);
        log(`MSA Code: ${data.code}`);
      }
    };

    ws.onclose = () => {
      setSocketState('disconnected');
      log('Disconnected from backend');
    };

    ws.onerror = (e) => {
      log('WebSocket Error');
      setSocketState('disconnected');
    };
  };

  const disconnect = () => {
    if (socketRef.current) {
      socketRef.current.send(JSON.stringify({ action: 'disconnect' }));
      socketRef.current.close();
    }
  };

  const sendChat = () => {
    if (!socketRef.current || !chatText) return;
    socketRef.current.send(JSON.stringify({ action: 'chat', text: chatText }));
    log(`Me: ${chatText}`);
    setChatText('');
  };

  const sendAfk = (mode: AfkMode) => {
    if (!socketRef.current) return;
    socketRef.current.send(JSON.stringify({ action: 'start_afk', mode }));
    log(`AFK Mode: ${mode}`);
  };

  const openVerificationUrl = async () => {
    if (msaVerificationUri) {
      try {
        await Linking.openURL(msaVerificationUri);
        log('Verification URL opened in browser');
      } catch (e) {
        log('Could not open verification URL');
      }
    }
  };

  return (
    <>
      <Modal visible={showMsaModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Microsoft Login Required</Text>
            <Text style={styles.modalText}>Enter this code at microsoft.com/link:</Text>
            <View style={styles.codeBox}>
              <Text style={styles.codeText}>{msaCode}</Text>
            </View>
            <TouchableOpacity style={styles.modalButton} onPress={openVerificationUrl}>
              <Text style={styles.modalButtonText}>Open Verification URL</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalButton, styles.modalButtonSecondary]} onPress={() => setShowMsaModal(false)}>
              <Text style={styles.modalButtonText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <ScrollView style={styles.container}>
        <Text style={styles.title}>{profile.host}</Text>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Connection Settings</Text>
        <View style={styles.row}>
          <Text>Auth Mode:</Text>
          <Switch 
            value={profile.authMode === 'premium'} 
            onValueChange={(val) => setProfile({...profile, authMode: val ? 'premium' : 'cracked'})} 
          />
          <Text>{profile.authMode}</Text>
        </View>
        <TextInput 
          style={styles.input} 
          placeholder="Username" 
          value={profile.username} 
          onChangeText={(t) => setProfile({...profile, username: t})} 
        />
        <TextInput 
          style={styles.input} 
          placeholder="Auto-Command" 
          value={profile.autoCommand} 
          onChangeText={(t) => setProfile({...profile, autoCommand: t})} 
        />
        {/* Button to import Fabric profile */}
        <TouchableOpacity style={styles.button} onPress={importFabricProfile}>
          <Text style={styles.buttonText}>Import Fabric Profile</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity 
          style={[styles.button, socketState === 'connected' && styles.buttonDisabled]} 
          onPress={connect}
        >
          <Text style={styles.buttonText}>Connect Bot</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.button, styles.buttonDanger, socketState === 'disconnected' && styles.buttonDisabled]} 
          onPress={disconnect}
        >
          <Text style={styles.buttonText}>Disconnect</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Anti-AFK Controls</Text>
        <View style={styles.afkGrid}>
          {(['swing', 'look', 'jump', 'fish', 'all'] as AfkMode[]).map(mode => (
            <TouchableOpacity key={mode} style={styles.afkButton} onPress={() => sendAfk(mode)}>
              <Text style={styles.afkButtonText}>{mode}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Chat</Text>
        <View style={styles.chatBox}>
          {events.map((e, i) => <Text key={i} style={styles.chatText}>{e}</Text>)}
        </View>
        <View style={styles.chatInputRow}>
          <TextInput 
            style={styles.chatInput} 
            value={chatText} 
            onChangeText={setChatText} 
            placeholder="Message..." 
          />
          <TouchableOpacity style={styles.sendButton} onPress={sendChat}>
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: 'white', borderRadius: 15, padding: 25, width: '80%', alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15, color: '#333' },
  modalText: { fontSize: 14, textAlign: 'center', marginBottom: 15, color: '#666' },
  codeBox: { backgroundColor: '#f0f0f0', borderRadius: 8, padding: 15, marginBottom: 20, width: '100%', alignItems: 'center', borderWidth: 2, borderColor: '#007AFF' },
  codeText: { fontSize: 32, fontWeight: 'bold', color: '#007AFF', letterSpacing: 2 },
  modalButton: { backgroundColor: '#007AFF', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 8, marginBottom: 10, width: '100%', alignItems: 'center' },
  modalButtonSecondary: { backgroundColor: '#ccc' },
  modalButtonText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  container: { flex: 1, padding: 20, backgroundColor: '#f5f5f5' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, marginTop: 40, textAlign: 'center' },
  section: { backgroundColor: 'white', padding: 15, borderRadius: 10, marginBottom: 20, elevation: 2 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  input: { borderBottomWidth: 1, borderColor: '#ddd', padding: 8, marginBottom: 10 },
  controls: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  button: { flex: 1, backgroundColor: '#007AFF', padding: 15, borderRadius: 10, alignItems: 'center' },
  buttonDanger: { backgroundColor: '#FF3B30' },
  buttonDisabled: { backgroundColor: '#ccc' },
  buttonText: { color: 'white', fontWeight: 'bold' },
  afkGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  afkButton: { backgroundColor: '#eee', padding: 10, borderRadius: 5, minWidth: '30%', alignItems: 'center' },
  afkButtonText: { fontSize: 12, fontWeight: '600' },
  chatBox: { backgroundColor: '#000', padding: 10, borderRadius: 5, height: 200, marginBottom: 10 },
  chatText: { color: '#0f0', fontSize: 12, fontFamily: 'monospace' },
  chatInputRow: { flexDirection: 'row', gap: 10 },
  chatInput: { flex: 1, backgroundColor: 'white', padding: 10, borderRadius: 5, borderWidth: 1, borderColor: '#ddd' },
  sendButton: { backgroundColor: '#007AFF', padding: 10, borderRadius: 5, justifyContent: 'center' },
  sendButtonText: { color: 'white', fontWeight: 'bold' },
});
