import { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { ThemeProvider, useTheme } from '../lib/themeContext';
import { setAuthExpiredHandler } from '../lib/api';
import '../lib/webAlert'; // makes Alert.alert show browser dialogs on the web
import '../lib/firebaseSession'; // registers the Firebase sign-out that runs when the session is cleared
import { restoreSession } from '../lib/sessionStore';

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootStack() {
  const { isDark } = useTheme();
  const router = useRouter();

  // When a token can no longer be refreshed the user is sent back to the login screen
  useEffect(() => {
    setAuthExpiredHandler(() => router.replace('/login'));
  }, [router]);

  return (
    <>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </>
  );
}

export default function RootLayout() {
  // A remembered session is restored before any screen runs, so reloading the app keeps the user signed in
  const [ready, setReady] = useState(false);
  useEffect(() => { restoreSession().finally(() => setReady(true)); }, []);

  return (
    <ThemeProvider>
      {ready ? <RootStack /> : null}
    </ThemeProvider>
  );
}
