import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
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

interface CnaeItem {
  code: string;
  description: string;
  isPrimary: boolean;
}

interface CnpjData {
  razao_social?: string;
  nome_fantasia?: string;
  email?: string;
  telefone1?: string;
  ddd_telefone_1?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  cnae_fiscal?: number | string;
  cnae_fiscal_descricao?: string;
  cnaes_secundarios?: Array<{ codigo: number | string; descricao: string }>;
  error?: boolean;
  status?: number;
  message?: string;
  descricao?: string;
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

function buildAddress(data: CnpjData): string {
  const parts = [
    data.logradouro,
    data.numero,
    data.complemento,
    data.bairro,
    data.municipio && data.uf ? `${data.municipio}/${data.uf}` : (data.municipio ?? data.uf),
    data.cep ? `CEP ${data.cep}` : null,
  ].filter(Boolean);
  return parts.join(', ');
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
  const [newFantasia, setNewFantasia] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [cnaes, setCnaes] = useState<CnaeItem[]>([]);
  const [lookingUp, setLookingUp] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lookupDone, setLookupDone] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const lookupDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  function resetModal() {
    setNewCNPJ('');
    setNewName('');
    setNewFantasia('');
    setNewEmail('');
    setNewPhone('');
    setNewAddress('');
    setCnaes([]);
    setLookupDone(false);
    setLookupError('');
  }

  function openAddModal() {
    resetModal();
    setModalVisible(true);
  }

  function handleCNPJChange(text: string) {
    const masked = maskCNPJ(text);
    setNewCNPJ(masked);
    setLookupDone(false);
    setLookupError('');

    if (lookupDebounce.current) clearTimeout(lookupDebounce.current);

    const digits = masked.replace(/\D/g, '');
    if (digits.length === 14) {
      lookupDebounce.current = setTimeout(() => {
        void performCNPJLookup(digits);
      }, 300);
    } else {
      // Clear autofilled data if user edits back
      setNewName('');
      setNewFantasia('');
      setNewEmail('');
      setNewPhone('');
      setNewAddress('');
      setCnaes([]);
    }
  }

  async function performCNPJLookup(cnpj: string) {
    setLookingUp(true);
    setLookupError('');
    try {
      const { data } = await adminApi.cnpjLookup(cnpj);
      const body = data as CnpjData;

      if (body.error || (body.status && body.status >= 400)) {
        const msg = body.message ?? body.descricao ?? 'CNPJ não encontrado na base da Receita Federal.';
        setLookupError(String(msg));
        setLookupDone(false);
        return;
      }

      if (body.razao_social) setNewName(String(body.razao_social));
      if (body.nome_fantasia) setNewFantasia(String(body.nome_fantasia));
      if (body.email) setNewEmail(String(body.email));

      // Phone: prefer telefone1 field, fallback ddd_telefone_1
      const phone = body.telefone1 ?? body.ddd_telefone_1 ?? '';
      if (phone) setNewPhone(String(phone).trim());

      // Address
      const addr = buildAddress(body);
      if (addr) setNewAddress(addr);

      // CNAEs
      const cnaeList: CnaeItem[] = [];
      if (body.cnae_fiscal && body.cnae_fiscal_descricao) {
        cnaeList.push({
          code: String(body.cnae_fiscal),
          description: String(body.cnae_fiscal_descricao),
          isPrimary: true,
        });
      }
      const secondary = body.cnaes_secundarios ?? [];
      for (const s of secondary.slice(0, 20)) {
        cnaeList.push({
          code: String(s.codigo),
          description: s.descricao,
          isPrimary: false,
        });
      }
      setCnaes(cnaeList);
      setLookupDone(true);
    } catch {
      setLookupError('Falha ao consultar CNPJ. Verifique sua conexão e tente novamente.');
      setLookupDone(false);
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
      Alert.alert('Atenção', 'Razão Social é obrigatória. Verifique se o CNPJ foi consultado.');
      return;
    }
    setSaving(true);
    try {
      await adminApi.createTenant({
        corporateName: newName.trim(),
        tradeName: newFantasia.trim() || newName.trim(),
        cnpj: digits,
        contactName: newName.trim(),
        contactEmail: newEmail.trim() || undefined,
        contactPhone: newPhone.trim() || undefined,
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

  const primaryCnae = cnaes.find((c) => c.isPrimary);
  const secondaryCnaes = cnaes.filter((c) => !c.isPrimary);

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
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>Nova Empresa</Text>
              <Text style={styles.modalSubtitle}>
                Digite o CNPJ para preenchimento automático dos dados.
              </Text>

              {/* CNPJ Field */}
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
                  editable={!saving}
                />
                {lookingUp && (
                  <ActivityIndicator color={Colors.primary} size="small" style={styles.cnpjSpinner} />
                )}
                {lookupDone && !lookingUp && (
                  <Text style={styles.cnpjOk}>✓</Text>
                )}
              </View>

              {lookingUp && (
                <Text style={styles.cnpjHintLoading}>Buscando dados do CNPJ...</Text>
              )}
              {lookupDone && !lookingUp && (
                <Text style={styles.cnpjHintOk}>Dados preenchidos automaticamente pela Receita Federal</Text>
              )}
              {lookupError ? (
                <Text style={styles.cnpjHintError}>{lookupError}</Text>
              ) : null}

              {/* Auto-filled data preview — only show when lookup is done */}
              {lookupDone && (
                <View style={styles.previewCard}>
                  <Text style={styles.previewTitle}>Dados da Receita Federal</Text>

                  <Text style={styles.fieldLabel}>Razão Social</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Razão Social"
                    placeholderTextColor={Colors.textMuted}
                    value={newName}
                    onChangeText={setNewName}
                    autoCapitalize="characters"
                    editable={!saving}
                  />

                  <Text style={styles.fieldLabel}>Nome Fantasia</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Nome Fantasia (opcional)"
                    placeholderTextColor={Colors.textMuted}
                    value={newFantasia}
                    onChangeText={setNewFantasia}
                    autoCapitalize="words"
                    editable={!saving}
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
                    editable={!saving}
                  />

                  <Text style={styles.fieldLabel}>Telefone</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="(11) 99999-9999"
                    placeholderTextColor={Colors.textMuted}
                    value={newPhone}
                    onChangeText={setNewPhone}
                    keyboardType="phone-pad"
                    editable={!saving}
                  />

                  {newAddress ? (
                    <>
                      <Text style={styles.fieldLabel}>Endereço</Text>
                      <View style={styles.readonlyField}>
                        <Text style={styles.readonlyText}>{newAddress}</Text>
                      </View>
                    </>
                  ) : null}

                  {/* CNAEs */}
                  {cnaes.length > 0 && (
                    <View style={styles.cnaeSection}>
                      <Text style={styles.cnaeSectionTitle}>CNAEs ({cnaes.length})</Text>

                      {primaryCnae && (
                        <View style={styles.cnaePrimaryRow}>
                          <View style={styles.cnaePrimaryBadge}>
                            <Text style={styles.cnaePrimaryCode}>{primaryCnae.code}</Text>
                          </View>
                          <View style={styles.cnaeTextWrap}>
                            <Text style={styles.cnaePrimaryLabel}>Principal</Text>
                            <Text style={styles.cnaeDesc} numberOfLines={2}>{primaryCnae.description}</Text>
                          </View>
                        </View>
                      )}

                      {secondaryCnaes.length > 0 && (
                        <View style={styles.cnaeSecondaryList}>
                          <Text style={styles.cnaeSecondaryHeader}>
                            Secundários ({secondaryCnaes.length})
                          </Text>
                          {secondaryCnaes.map((cnae) => (
                            <View key={cnae.code} style={styles.cnaeSecondaryRow}>
                              <Text style={styles.cnaeSecondaryCode}>{cnae.code}</Text>
                              <Text style={styles.cnaeSecondaryDesc} numberOfLines={1}>{cnae.description}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  )}
                </View>
              )}

              {/* If lookup not done yet but CNPJ is invalid, show manual entry */}
              {!lookupDone && !lookingUp && newCNPJ.replace(/\D/g, '').length === 14 && lookupError && (
                <>
                  <Text style={styles.fieldLabel}>Razão Social *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Razão Social"
                    placeholderTextColor={Colors.textMuted}
                    value={newName}
                    onChangeText={setNewName}
                    autoCapitalize="characters"
                    editable={!saving}
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
                    editable={!saving}
                  />
                  <Text style={styles.fieldLabel}>Telefone</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="(11) 99999-9999"
                    placeholderTextColor={Colors.textMuted}
                    value={newPhone}
                    onChangeText={setNewPhone}
                    keyboardType="phone-pad"
                    editable={!saving}
                  />
                </>
              )}

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setModalVisible(false)}
                  activeOpacity={0.85}
                  disabled={saving}
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
            </ScrollView>
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
    maxHeight: '92%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    marginBottom: 20,
    lineHeight: 18,
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
  cnpjHintLoading: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: '500',
    marginTop: 4,
  },
  cnpjHintOk: {
    fontSize: 11,
    color: Colors.success,
    fontWeight: '500',
    marginTop: 4,
  },
  cnpjHintError: {
    fontSize: 12,
    color: Colors.danger,
    fontWeight: '500',
    marginTop: 4,
    lineHeight: 16,
  },

  // Preview card
  previewCard: {
    marginTop: 16,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 14,
    backgroundColor: '#F9FAFB',
  },
  previewTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },

  readonlyField: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#F0F2F5',
  },
  readonlyText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },

  // CNAEs
  cnaeSection: {
    marginTop: 16,
  },
  cnaeSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  cnaePrimaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  cnaePrimaryBadge: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    minWidth: 64,
    alignItems: 'center',
  },
  cnaePrimaryCode: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.white,
  },
  cnaeTextWrap: { flex: 1 },
  cnaePrimaryLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primaryLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  cnaeDesc: {
    fontSize: 12,
    color: Colors.textPrimary,
    lineHeight: 16,
  },
  cnaeSecondaryList: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    overflow: 'hidden',
  },
  cnaeSecondaryHeader: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
    backgroundColor: Colors.background,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  cnaeSecondaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.background,
  },
  cnaeSecondaryCode: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    minWidth: 64,
  },
  cnaeSecondaryDesc: {
    fontSize: 11,
    color: Colors.textPrimary,
    flex: 1,
  },

  // Buttons
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
    backgroundColor: Colors.danger,
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
