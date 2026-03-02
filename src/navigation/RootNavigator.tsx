import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../context/authStore';
import SplashScreen from '../screens/SplashScreen';
import AuthNavigator from './auth/AuthNavigator';
import AppNavigator from './app/AppNavigator';

export type RootStackParamList = {
  Splash: undefined;
  Auth: undefined;
  App: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { bootstrapped, token } = useAuthStore();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!bootstrapped ? (
        <Stack.Screen name="Splash" component={SplashScreen} />
      ) : token ? (
        <Stack.Screen name="App" component={AppNavigator} />
      ) : (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      )}
    </Stack.Navigator>
  );
}
