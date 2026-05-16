import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { adminApi } from '../services/api';
import { Colors } from '../theme/colors';
import type { RootStackParamList } from '../types/navigation';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

interface Tenant {
  id: string;
  corporateName: string;
  tradeName?: string;
  cnpj?: string;
  status?: string;
  contactEmail?: string;
  keywords?: string[];
  regions?: string[];
  _count?: { users?: number; companyKeywords?: number; companyRegions?: number };
}

function tenantStatusStyle(status: string | undefined): { text: string; color: string; bg: string } {
  switch (status) {
    case 'active':    return { text: 'Ativo',    color: Colors.success, bg: Colors.successBg };
    case 'inactive':  return { text: 'Inativo',  color: Colors.danger,  bg: '#FFEBEE' };
    case 'suspended': return { text: 'Suspenso', color: Colors.orange,  bg: Colors.warningBg };
    default:          return { text: status ?? '—', color: Colors.textMuted, bg: Colors.background };
  }
}

function formatCNPJ(cnpj: string | undefined): string {
  if (!cnpj) return '—';
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return cnpj;
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

function maskCNPJ(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

export function AdminTenantsScreen() {
  const navigation = useNavigation<NavProp>();

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [newCNPJ, setNewCNPJ] = useState('');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cnpjLookedUp, setCnpjLookedUp] = useState(false);

  const fetchTenants = useCallback(async () => {
    try {
      const { data } = await adminApi.listTenants();
      const items = (data as Record<string, unknown>).data as Tenant[] ?? data ?? [];
      setTenants(Array.isArray(items) ? items : []);
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setLoading(true);
    await fetchTenants();
    setRefreshing(false);
  }, [fetchTenants]);

  function openAddModal() {
    setNewCNPJ('');
    setNewName('');
    setNewEmail('');
    setNewPhone('');
    setCnpjLookedUp(false);
    setModalVisible(true);
  }

  function handleCNPJChange(text: string) {
    const masked = maskCNPJ(text);
    setNewCNPJ(masked);
    setCnpjLookedUp(false);
    // Auto-lookup when CNPJ is complete (14 digits)
    const digits = text.replace(/\D/g, '');
    if (digits.length === 14) {
      performCNPJLookup(digits);
    }
  }

  async function performCNPJLookup(cnpj: string) {
    setLookingUp(true);
    try {
      const { data } = await adminApi.cnpjLookup(cnpj);
      const body = data as Record<string, unknown>;
      if (body.razao_social) setNewName(String(body.razao_social));
      if (body.email) setNewEmail(String(body.email));
      if (body.ddd_telefone_1) {
        setNewPhone(String(body.ddd_telefone_1).trim());
      }
      setCnpjLookedUp(true);
    } catch {
      // lookup failed — user fills manually
    } finally {
      setLookingUp(false);
    }
  }

  async function handleCreate() {
    const digits = newCNPJ.replace(/\D/g, '');
    if (digits.length !== 14) {
      Alert.alert('Atenção', 'CNPJ deve ter 14 dígitos.');
      return;
    }
    if (!newName.trim()) {
      Alert.alert('Atenção', 'Nome da empresa é obrigatório.');
      return;
    }
    setSaving(true);
    try {
      await adminApi.createTenant({
        corporateName: newName.trim(),
        tradeName: newName.trim(),
        cnpj: digits,
        contactName: newName.trim(),
        contactEmail: newEmail.trim() || 'contato@empresa.com',
        contactPhone: newPhone.trim() || '(00) 00000-0000',
      });
      setModalVisible(false);
      setLoading(true);
      await fetchTenants();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erro ao criar empresa.';
      Alert.alert('Erro', msg);
    } finally {
      setSaving(false);
    }
  }

  function renderItem({ item }: { item: Tenant }) {
    const s = tenantStatusStyle(item.status);
    const keywordCount = item._count?.companyKeywords ?? (item.keywords?.length ?? 0);
    const regionCount = item._count?.companyRegions ?? (item.regions?.length ?? 0);
    const userCount = item._count?.users ?? 0;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('AdminTenantDetail', { tenantId: item.id })}
        activeOpacity={0.88}
      >
        <View style={styles.cardTop}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {item.corporateName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardName} numberOfLines={1}>{item.tradeName ?? item.corporateName}</Text>
            <Text style={styles.cardCnpj}>{formatCNPJ(item.cnpj)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: s.bg }]}>
            <Text style={[styles.statusText, { color: s.color }]}>{s.text}</Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Text style={styles.metaIcon}>👤</Text>
            <Text style={styles.metaLabel}>{userCount} usuário{userCount !== 1 ? 's' : ''}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaIcon}>🏷️</Text>
            <Text style={styles.metaLabel}>{keywordCount} keyword{keywordCount !== 1 ? 's' : ''}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaIcon}>📍</Text>
            <Text style={styles.metaLabel}>{regionCount} região{regionCount !== 1 ? 'ões' : ''}</Text>
          </View>
        </View>

        {item.contactEmail ? (
          <Text style={styles.cardEmail} numberOfLines={1}>✉ {item.contactEmail}</Text>
        ) : null}

        <View style={styles.cardFooter}>
          <Text style={styles.cardFooterLink}>Ver detalhes →</Text>
        </View>
      </TouchableOpacity>
    );
  }

  function renderEmpty() {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>🏢</Text>
        <Text style={styles.emptyTitle}>Nenhuma empresa cadastrada</Text>
        <Text style={styles.emptyText}>
          Toque no botão + Nova para adicionar a primeira empresa cliente.
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Empresas Clientes</Text>
          <Text style={styles.headerSub}>{tenants.length} empresa{tenants.length !== 1 ? 's' : ''} cadastrada{tenants.length !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={openAddModal} activeOpacity={0.85}>
          <Text style={styles.addButtonText}>+ Nova</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={tenants}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[Colors.primary]}
              tintColor={Colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Add Tenant Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Nova Empresa</Text>

            <Text style={styles.fieldLabel}>CNPJ *</Text>
            <View style={styles.cnpjRow}>
              <TextInput
                style={[styles.input, styles.cnpjInput]}
                placeholder="00.000.000/0000-00"
                placeholderTextColor={Colors.textMuted}
                value={newCNPJ}
                onChangeText={handleCNPJChange}
                keyboardType="numeric"
                maxLength={18}
              />
              {lookingUp && (
                <ActivityIndicator color={Colors.primary} size="small" style={styles.cnpjSpinner} />
              )}
              {cnpjLookedUp && !lookingUp && (
                <Text style={styles.cnpjOk}>✓</Text>
              )}
            </View>
            {cnpjLookedUp && (
              <Text style={styles.cnpjHint}>Dados preenchidos automaticamente pela Receita Federal</Text>
            )}

            <Text style={styles.fieldLabel}>Nome da Empresa *</Text>
            <TextInput
              style={styles.input}
              placeholder="Razão Social"
              placeholderTextColor={Colors.textMuted}
              value={newName}
              onChangeText={setNewName}
              autoCapitalize="words"
            />

            <Text style={styles.fieldLabel}>E-mail</Text>
            <TextInput
              style={styles.input}
              placeholder="contato@empresa.com"
              placeholderTextColor={Colors.textMuted}
              value={newEmail}
              onChangeText={setNewEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.fieldLabel}>Telefone</Text>
            <TextInput
              style={styles.input}
              placeholder="(11) 99999-9999"
              placeholderTextColor={Colors.textMuted}
              value={newPhone}
              onChangeText={setNewPhone}
              keyboardType="phone-pad"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setModalVisible(false)}
                activeOpacity={0.85}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, (saving || lookingUp) && styles.saveButtonDisabled]}
                onPress={handleCreate}
                activeOpacity={0.85}
                disabled={saving || lookingUp}
              >
                {saving ? (
                  <ActivityIndicator color={Colors.white} size="small" />
                ) : (
                  <Text style={styles.saveButtonText}>Criar Empresa</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.screenBackground },

  header: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.65)',
    fontWeight: '500',
    marginTop: 2,
  },
  addButton: {
    backgroundColor: Colors.danger,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 22,
  },
  addButtonText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.3,
  },

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  list: {
    padding: 16,
    paddingBottom: 32,
    flexGrow: 1,
  },

  card: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.white,
  },
  cardInfo: { flex: 1 },
  cardName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  cardCnpj: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 8,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: Colors.background,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaIcon: { fontSize: 12 },
  metaLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  cardEmail: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
  },
  cardFooter: {
    marginTop: 10,
    alignItems: 'flex-end',
  },
  cardFooterLink: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },

  emptyContainer: {
    paddingTop: 80,
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 20,
    letterSpacing: -0.3,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.textPrimary,
    backgroundColor: Colors.background,
  },
  cnpjRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cnpjInput: {
    flex: 1,
  },
  cnpjSpinner: {
    width: 24,
  },
  cnpjOk: {
    fontSize: 18,
    color: Colors.success,
    fontWeight: '700',
    width: 24,
    textAlign: 'center',
  },
  cnpjHint: {
    fontSize: 11,
    color: Colors.success,
    fontWeight: '500',
    marginTop: 4,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.background,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  saveButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.white,
  },
});
