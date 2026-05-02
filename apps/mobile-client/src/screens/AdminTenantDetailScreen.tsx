import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { adminApi } from '../services/api';
import { Colors } from '../theme/colors';
import type { AdminTenantDetailScreenProps } from '../types/navigation';

interface TenantDetail {
  id: string;
  name: string;
  cnpj?: string;
  email?: string;
  phone?: string;
  status?: string;
  createdAt?: string;
}

interface TenantUser {
  id: string;
  fullName: string;
  email: string;
  role?: string;
}

interface TenantKeyword {
  id: string;
  keyword: string;
}

interface TenantRegion {
  id: string;
  uf: string;
  municipalityName?: string;
  municipalityIbgeCode?: string;
}

function formatCNPJ(cnpj: string | undefined): string {
  if (!cnpj) return '—';
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return cnpj;
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

function tenantStatusStyle(status: string | undefined): { text: string; color: string; bg: string } {
  switch (status) {
    case 'active':    return { text: 'Ativo',    color: Colors.success, bg: Colors.successBg };
    case 'inactive':  return { text: 'Inativo',  color: Colors.danger,  bg: '#FFEBEE' };
    case 'suspended': return { text: 'Suspenso', color: Colors.orange,  bg: Colors.warningBg };
    default:          return { text: status ?? '—', color: Colors.textMuted, bg: Colors.background };
  }
}

function roleLabel(role: string | undefined): string {
  const map: Record<string, string> = {
    tenant_owner: 'Proprietário',
    tenant_user: 'Usuário',
    taed_admin: 'Admin TAED',
    taed_operator: 'Operador TAED',
  };
  return map[role ?? ''] ?? role ?? '—';
}

export function AdminTenantDetailScreen() {
  const route = useRoute<AdminTenantDetailScreenProps['route']>();
  const { tenantId } = route.params;

  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [keywords, setKeywords] = useState<TenantKeyword[]>([]);
  const [regions, setRegions] = useState<TenantRegion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Add keyword state
  const [newKeyword, setNewKeyword] = useState('');
  const [addingKeyword, setAddingKeyword] = useState(false);

  // Add region state
  const [newRegionUF, setNewRegionUF] = useState('');
  const [addingRegion, setAddingRegion] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const [tenantRes, usersRes, keywordsRes, regionsRes] = await Promise.allSettled([
        adminApi.getTenant(tenantId),
        adminApi.getTenantUsers(tenantId),
        adminApi.getTenantKeywords(tenantId),
        adminApi.getTenantRegions(tenantId),
      ]);

      if (tenantRes.status === 'fulfilled') {
        setTenant(tenantRes.value.data as TenantDetail);
      }
      if (usersRes.status === 'fulfilled') {
        const d = usersRes.value.data as Record<string, unknown>;
        const items = d.data as TenantUser[] ?? usersRes.value.data ?? [];
        setUsers(Array.isArray(items) ? items : []);
      }
      if (keywordsRes.status === 'fulfilled') {
        const d = keywordsRes.value.data as Record<string, unknown>;
        const items = d.data as TenantKeyword[] ?? keywordsRes.value.data ?? [];
        setKeywords(Array.isArray(items) ? items : []);
      }
      if (regionsRes.status === 'fulfilled') {
        const d = regionsRes.value.data as Record<string, unknown>;
        const items = d.data as TenantRegion[] ?? regionsRes.value.data ?? [];
        setRegions(Array.isArray(items) ? items : []);
      }
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setLoading(true);
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);

  async function handleAddKeyword() {
    const kw = newKeyword.trim();
    if (!kw) return;
    setAddingKeyword(true);
    try {
      await adminApi.addTenantKeyword(tenantId, kw);
      setNewKeyword('');
      const { data } = await adminApi.getTenantKeywords(tenantId);
      const d = data as Record<string, unknown>;
      const items = d.data as TenantKeyword[] ?? data ?? [];
      setKeywords(Array.isArray(items) ? items : []);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erro ao adicionar keyword.';
      Alert.alert('Erro', msg);
    } finally {
      setAddingKeyword(false);
    }
  }

  async function handleAddRegion() {
    const uf = newRegionUF.trim().toUpperCase().slice(0, 2);
    if (!uf || uf.length !== 2) {
      Alert.alert('Atenção', 'Informe uma UF válida com 2 letras.');
      return;
    }
    setAddingRegion(true);
    try {
      await adminApi.addTenantRegion(tenantId, { uf });
      setNewRegionUF('');
      const { data } = await adminApi.getTenantRegions(tenantId);
      const d = data as Record<string, unknown>;
      const items = d.data as TenantRegion[] ?? data ?? [];
      setRegions(Array.isArray(items) ? items : []);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erro ao adicionar região.';
      Alert.alert('Erro', msg);
    } finally {
      setAddingRegion(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={Colors.primary} size="large" />
          <Text style={styles.loadingText}>Carregando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const statusStyle = tenantStatusStyle(tenant?.status);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Company Hero */}
        <View style={styles.heroSection}>
          <View style={styles.heroAvatar}>
            <Text style={styles.heroAvatarText}>
              {tenant?.name?.charAt(0)?.toUpperCase() ?? '?'}
            </Text>
          </View>
          <Text style={styles.heroName}>{tenant?.name ?? '—'}</Text>
          <Text style={styles.heroCNPJ}>{formatCNPJ(tenant?.cnpj)}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.statusBadgeText, { color: statusStyle.color }]}>
              {statusStyle.text}
            </Text>
          </View>
        </View>

        {/* Contact info */}
        {(tenant?.email || tenant?.phone) ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Contato</Text>
            {tenant?.email ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoIcon}>✉</Text>
                <Text style={styles.infoValue}>{tenant.email}</Text>
              </View>
            ) : null}
            {tenant?.phone ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoIcon}>📞</Text>
                <Text style={styles.infoValue}>{tenant.phone}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Users */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Usuários ({users.length})</Text>
          {users.length === 0 ? (
            <Text style={styles.emptyText}>Nenhum usuário cadastrado.</Text>
          ) : (
            users.map((u) => (
              <View key={u.id} style={styles.userRow}>
                <View style={styles.userAvatar}>
                  <Text style={styles.userAvatarText}>
                    {u.fullName?.charAt(0)?.toUpperCase() ?? 'U'}
                  </Text>
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{u.fullName}</Text>
                  <Text style={styles.userEmail}>{u.email}</Text>
                </View>
                <View style={styles.roleBadge}>
                  <Text style={styles.roleText}>{roleLabel(u.role)}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Keywords */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Keywords ({keywords.length})</Text>
          <View style={styles.tagsWrap}>
            {keywords.map((kw) => (
              <View key={kw.id} style={styles.tag}>
                <Text style={styles.tagText}>{kw.keyword}</Text>
              </View>
            ))}
            {keywords.length === 0 && (
              <Text style={styles.emptyText}>Nenhuma keyword configurada.</Text>
            )}
          </View>

          <View style={styles.addRow}>
            <TextInput
              style={styles.addInput}
              placeholder="Nova keyword..."
              placeholderTextColor={Colors.textMuted}
              value={newKeyword}
              onChangeText={setNewKeyword}
              onSubmitEditing={handleAddKeyword}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={styles.addBtn}
              onPress={handleAddKeyword}
              activeOpacity={0.85}
              disabled={addingKeyword}
            >
              {addingKeyword ? (
                <ActivityIndicator color={Colors.white} size="small" />
              ) : (
                <Text style={styles.addBtnText}>+</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Regions */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Regiões de Interesse ({regions.length})</Text>
          <View style={styles.tagsWrap}>
            {regions.map((r) => (
              <View key={r.id} style={[styles.tag, styles.tagRegion]}>
                <Text style={[styles.tagText, styles.tagRegionText]}>
                  {r.municipalityName ? `${r.municipalityName} / ${r.uf}` : r.uf}
                </Text>
              </View>
            ))}
            {regions.length === 0 && (
              <Text style={styles.emptyText}>Nenhuma região configurada.</Text>
            )}
          </View>

          <View style={styles.addRow}>
            <TextInput
              style={styles.addInput}
              placeholder="UF (ex: SP)"
              placeholderTextColor={Colors.textMuted}
              value={newRegionUF}
              onChangeText={(v) => setNewRegionUF(v.replace(/[^a-zA-Z]/g, '').slice(0, 2))}
              autoCapitalize="characters"
              maxLength={2}
              onSubmitEditing={handleAddRegion}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={styles.addBtn}
              onPress={handleAddRegion}
              activeOpacity={0.85}
              disabled={addingRegion}
            >
              {addingRegion ? (
                <ActivityIndicator color={Colors.white} size="small" />
              ) : (
                <Text style={styles.addBtnText}>+</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.screenBackground },

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textMuted,
  },

  scroll: {
    paddingBottom: 32,
  },

  heroSection: {
    backgroundColor: Colors.primary,
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 32,
    paddingHorizontal: 24,
  },
  heroAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  heroAvatarText: { fontSize: 30, fontWeight: '900', color: Colors.white },
  heroName: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.white,
    textAlign: 'center',
    marginBottom: 4,
  },
  heroCNPJ: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
    fontWeight: '500',
    marginBottom: 12,
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },

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
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 14,
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  infoIcon: { fontSize: 14, width: 20, textAlign: 'center' },
  infoValue: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '500',
  },

  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.background,
  },
  userAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: { fontSize: 16, fontWeight: '800', color: Colors.white },
  userInfo: { flex: 1 },
  userName: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  userEmail: { fontSize: 12, color: Colors.textMuted },
  roleBadge: {
    backgroundColor: Colors.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  roleText: { fontSize: 10, fontWeight: '600', color: Colors.textSecondary },

  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  tag: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  tagText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.white,
  },
  tagRegion: {
    backgroundColor: Colors.successBg,
    borderWidth: 1,
    borderColor: Colors.success,
  },
  tagRegionText: {
    color: Colors.success,
  },

  addRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  addInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.textPrimary,
    backgroundColor: Colors.background,
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    fontSize: 24,
    color: Colors.white,
    fontWeight: '600',
    lineHeight: 28,
  },

  emptyText: {
    fontSize: 13,
    color: Colors.textMuted,
    fontStyle: 'italic',
    marginBottom: 10,
  },
});
