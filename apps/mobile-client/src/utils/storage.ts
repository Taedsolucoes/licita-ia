import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Storage utility that works on both web and native platforms.
 * Uses localStorage on web and SecureStore on native mobile.
 */

const isWeb = Platform.OS === 'web';

export async function getItem(key: string): Promise<string | null> {
  if (isWeb) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  try {
    const result = await SecureStore.getItemAsync(key);
    return result;
  } catch (error) {
    console.warn(`[storage] Error getting '${key}':`, error);
    // Se houver erro de leitura, tenta deletar a chave corrompida
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // ignore cleanup error
    }
    return null;
  }
}

export async function setItem(key: string, value: string): Promise<void> {
  if (typeof value !== 'string') {
    console.warn(`[storage] Value for '${key}' is not a string, converting...`);
    value = String(value);
  }
  
  if (isWeb) {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.warn(`[storage] Error setting '${key}':`, error);
      throw error;
    }
    return;
  }
  
  try {
    await SecureStore.setItemAsync(key, value);
  } catch (error) {
    console.warn(`[storage] Error setting '${key}':`, error);
    throw error;
  }
}

export async function deleteItem(key: string): Promise<void> {
  if (isWeb) {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
    return;
  }
  
  try {
    await SecureStore.deleteItemAsync(key);
  } catch (error) {
    console.warn(`[storage] Error deleting '${key}':`, error);
  }
}
