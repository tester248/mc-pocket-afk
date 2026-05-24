import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import ServerListScreen from '../screens/ServerListScreen';
import DashboardScreen from '../screens/DashboardScreen';

export const Stack = createStackNavigator();

export default function AppNavigator() {
  return (
    <Stack.Navigator initialRouteName="ServerList">
      <Stack.Screen 
        name="ServerList" 
        component={ServerListScreen} 
        options={{ title: 'MCPocketAFK Servers' }} 
      />
      <Stack.Screen 
        name="Dashboard" 
        component={DashboardScreen} 
        options={{ title: 'Bot Dashboard' }} 
      />
    </Stack.Navigator>
  );
}
