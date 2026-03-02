import * as SecureStore from 'expo-secure-store';

const KEY = 'bw_token_v1';
const USER_KEY = 'bw_user_v1';

export async function setToken(token: string) {
  await SecureStore.setItemAsync(KEY, token);
}

export async function getToken() {
  return SecureStore.getItemAsync(KEY);
}

export async function clearToken() {
  await SecureStore.deleteItemAsync(KEY);
}

export async function setUser(userJson: string) {
  await SecureStore.setItemAsync(USER_KEY, userJson);
}

export async function getUser() {
  return SecureStore.getItemAsync(USER_KEY);
}

export async function clearUser() {
  await SecureStore.deleteItemAsync(USER_KEY);
}

export async function clearAuth() {
  await Promise.all([clearToken(), clearUser()]);
}
