import 'react-native-url-polyfill/auto';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { appName, initialTaskFields } from '@todo-list/shared';
import { createMobileSupabaseClient } from './src/supabase';

const supabaseConfigured = Boolean(createMobileSupabaseClient());

export default function App() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.container}>
        <Text style={styles.eyebrow}>Todo List</Text>
        <Text style={styles.title}>{appName}</Text>
        <Text style={styles.status}>
          {supabaseConfigured ? 'Supabase connected' : 'Supabase env pending'}
        </Text>
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Mobile foundation is ready</Text>
          <Text style={styles.body}>
            Expo, shared TypeScript, and Supabase wiring are prepared for account-backed tasks.
          </Text>
          <View style={styles.chips}>
            {initialTaskFields.map((field) => (
              <Text key={field} style={styles.chip}>
                {field}
              </Text>
            ))}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f7f2',
  },
  container: {
    flex: 1,
    padding: 24,
  },
  eyebrow: {
    color: '#2f6f4e',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  title: {
    color: '#17211b',
    fontSize: 34,
    fontWeight: '700',
    marginTop: 8,
  },
  status: {
    color: '#536258',
    marginTop: 8,
  },
  panel: {
    backgroundColor: '#fff',
    borderColor: '#dfe7db',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 28,
    padding: 20,
  },
  panelTitle: {
    color: '#17211b',
    fontSize: 22,
    fontWeight: '700',
  },
  body: {
    color: '#536258',
    lineHeight: 22,
    marginTop: 12,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 18,
  },
  chip: {
    backgroundColor: '#e9f3ec',
    borderRadius: 999,
    color: '#24563a',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
});
