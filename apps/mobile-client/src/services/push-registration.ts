import { Platform } from 'react-native';
import { notificationsApi, preferencesApi } from './api';
import { deleteItem, getItem, setItem } from '../utils/storage';

const PUSH_TOKEN_STORAGE_KEY = 'pushDeviceToken';

export async function registerPushDevice(): Promise<void> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;

  const { data: preferences } = await preferencesApi.get();
  if (preferences?.allowPush === false) return;

  // Load notifications only on native platforms; expo-notifications is not supported on web.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Notifications = require('expo-notifications') as typeof import('expo-notifications');

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'LICITA IA',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1B365D',
    });
  }

  let permission = await Notifications.getPermissionsAsync();
  if (permission.status !== 'granted') {
    permission = await Notifications.requestPermissionsAsync();
  }
  if (permission.status !== 'granted') return;

  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim();
  let token: string;
  if (projectId) {
    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } else if (Platform.OS === 'android') {
    // Android native device tokens are FCM tokens and can be delivered by Firebase.
    const deviceToken = await Notifications.getDevicePushTokenAsync();
    token = String(deviceToken.data);
  } else {
    // iOS getDevicePushTokenAsync() returns an APNs token, not an FCM token.
    // Never register it as FCM; iOS must use an Expo Push Token with an EAS project ID.
    console.warn('Push iOS não registrado: configure EXPO_PUBLIC_EAS_PROJECT_ID para obter um Expo Push Token.');
    return;
  }

  const platform = Platform.OS;
  if (platform !== 'android' && platform !== 'ios') return;
  await notificationsApi.registerDevice(token, platform);
  await setItem(PUSH_TOKEN_STORAGE_KEY, token);
}

export async function unregisterPushDevice(): Promise<void> {
  const token = await getItem(PUSH_TOKEN_STORAGE_KEY);
  if (!token) return;

  await notificationsApi.unregisterDevice(token);
  await deleteItem(PUSH_TOKEN_STORAGE_KEY);
}
