import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Button,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'mcpocketafk.mobile.profiles.v1';

export default function ServerListScreen({ navigation }) {
  const [servers, setServers] = useState([]);
  const [newHost, setNewHost] = useState('');
  const [newPort, setNewPort] = useState('25565');

  useEffect(() => {
    loadServers();
  }, []);

  const loadServers = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        setServers(JSON.parse(stored));
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to load servers');
    }
  };

  const saveServer = async () => {
    if (!newHost) {
      Alert.alert('Error', 'Host is required');
      return;
    }

    const newServer = {
      id: Date.now().toString(),
      host: newHost,
      port: newPort,
      authMode: 'cracked',
      username: '',
      version: '',
      autoCommand: '',
    };

    const updated = [...servers, newServer];
    setServers(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setNewHost('');
    setNewPort('25565');
  };

  const deleteServer = async (id) => {
    const updated = servers.filter(s => s.id !== id);
    setServers(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Servers</Text>
      
      <View style={styles.addServerContainer}>
        <TextInput 
          style={styles.input} 
          placeholder="Server IP/Host" 
          value={newHost} 
          onChangeText={setNewHost} 
        />
        <TextInput 
          style={styles.input} 
          placeholder="Port" 
          value={newPort} 
          onChangeText={setNewPort} 
          keyboardType="numeric"
        />
        <Button title="Add" onPress={saveServer} />
      </View>

      <FlatList
        data={servers}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.serverItem} 
            onPress={() => navigation.navigate('Dashboard', { server: item })}
          >
            <View>
              <Text style={styles.serverHost}>{item.host}</Text>
              <Text style={styles.serverPort}>{item.port}</Text>
            </View>
            <TouchableOpacity onPress={() => deleteServer(item.id)}>
              <Text style={styles.deleteText}>Delete</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f5f5f5' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, marginTop: 40 },
  addServerContainer: { marginBottom: 20, gap: 10 },
  input: { backgroundColor: 'white', padding: 10, borderRadius: 5, borderWidth: 1, borderColor: '#ddd' },
  serverItem: { 
    backgroundColor: 'white', 
    padding: 15, 
    borderRadius: 10, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  serverHost: { fontSize: 16, fontWeight: '600' },
  serverPort: { fontSize: 12, color: '#666' },
  deleteText: { color: 'red', fontWeight: 'bold' },
});
