import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { preferencesApi } from '../services/api';
import { Colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';

interface Preferences {
  allowPush: boolean;
  allowWhatsapp: boolean;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
}

export function ProfileScreen() {
  const { user, logout } = useAuth();
  const [prefs, setPrefs] = useState<Preferences>({
    allowPush: true,
    allowWhatsapp: true,
  });
  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await preferencesApi.get();
        setPrefs(data ?? prefs);
      } catch {
        // use defaults
      } finally {
        setLoadingPrefs(false);
      }
    })();
  }, []);

  async function savePrefs(updated: Preferences) {
    setSaving(true);
    try {
      await preferencesApi.update(updated);
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar preferências.');
    } finally {
      setSaving(false);
    }
  }

  function togglePush(val: boolean) {
    const updated = { ...prefs, allowPush: val };
    setPrefs(updated);
    savePrefs(updated);
  }

  function toggleWhatsapp(val: boolean) {
    const updated = { ...prefs, allowWhatsapp: val };
    setPrefs(updated);
    savePrefs(updated);
  }

  async function handleLogout() {
    Alert.alert('Sair', 'Deseja encerrar a sessão?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          await logout();
        },
      },
    ]);
  }

  const roleLabel: Record<string, string> = {
    tenant_owner: 'Proprietário',
    tenant_user: 'Usuário',
    taed_admin: 'Admin TAED',
    taed_operator: 'Operador TAED',
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Avatar / user info */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.fullName?.charAt(0)?.toUpperCase() ?? 'U'}
          </Text>
        </View>
        <Text style={styles.name}>{user?.fullName ?? '—'}</Text>
        <Text style={styles.email}>{user?.email ?? '—'}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>
            {roleLabel[user?.role ?? ''] ?? user?.role ?? '—'}
          </Text>
        </View>
      </View>

      {/* Notification preferences */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Preferências de Notificação</Text>

        {loadingPrefs ? (
          <ActivityIndicator color={Colors.primary} />
        ) : (
          <>
            <View style={styles.prefRow}>
              <View style={styles.prefInfo}>
                <Text style={styles.prefLabel}>Notificações Push</Text>
                <Text style={styles.prefDesc}>Receber alertas no aplicativo</Text>
              </View>
              <Switch
                value={prefs.allowPush}
                onValueChange={togglePush}
                trackColor={{ true: Colors.success, false: Colors.border }}
                thumbColor={Colors.white}
              />
            </View>

            <View style={styles.separator} />

            <View style={styles.prefRow}>
              <View style={styles.prefInfo}>
                <Text style={styles.prefLabel}>Notificações WhatsApp</Text>
                <Text style={styles.prefDesc}>Receber alertas pelo WhatsApp</Text>
              </View>
              <Switch
                value={prefs.allowWhatsapp}
                onValueChange={toggleWhatsapp}
                trackColor={{ true: Colors.success, false: Colors.border }}
                thumbColor={Colors.white}
              />
            </View>
          </>
        )}
      </View>

      {/* Account actions */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Conta</Text>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.85}>
          <Text style={styles.logoutText}>Sair da conta</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.version}>LICITA IA v1.0.0 — TAED Soluções</Text>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    backgroundColor: Colors.primary,
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 36,
    paddingHorizontal: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarText: { fontSize: 34, fontWeight: '900', color: Colors.white },
  name: { fontSize: 20, fontWeight: '800', color: Colors.white, marginBottom: 4 },
  email: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 10 },
  roleBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  roleText: { color: Colors.white, fontSize: 12, fontWeight: '600' },
  card: {
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  prefInfo: { flex: 1, paddingRight: 12 },
  prefLabel: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  prefDesc: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  separator: {
    height: 1,
    backgroundColor: Colors.background,
    marginVertical: 12,
  },
  logoutButton: {
    backgroundColor: Colors.danger,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  logoutText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
  version: {
    textAlign: 'center',
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 24,
  },
});
