import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { preferencesApi, profileApi } from '../services/api';
import { registerPushDevice } from '../services/push-registration';
import { Colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { MunicipalityAutocomplete, MunicipalityOption } from '../components/MunicipalityAutocomplete';

interface Preferences {
  allowPush: boolean;
  allowWhatsapp: boolean;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
}
interface Cnae { code: string; description: string; isPrimary: boolean }
interface Keyword { keyword: string; matchType: 'include' | 'exclude'; weight?: number }
interface CompanyRegion {
  uf: string;
  scopeType: 'uf' | 'municipio' | 'nacional';
  municipalityName?: string | null;
  municipalityIbgeCode?: string | null;
}
interface CompanyProfile {
  cnpj: string;
  corporateName: string;
  tradeName: string;
  cnaes: Cnae[];
  keywords: Keyword[];
  regions: CompanyRegion[];
  cnpjCard?: { url?: string; fileUrl?: string | null; status?: string };
}

const GREAT_REGIONS: Record<string, string[]> = {
  Norte: ['AC', 'AP', 'AM', 'PA', 'RO', 'RR', 'TO'],
  Nordeste: ['AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE'],
  'Centro-Oeste': ['DF', 'GO', 'MT', 'MS'],
  Sudeste: ['ES', 'MG', 'RJ', 'SP'],
  Sul: ['PR', 'RS', 'SC'],
};
const UF_NAMES: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal',
  ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul',
  MG: 'Minas Gerais', PA: 'Pará', PB: 'Paraíba', PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí',
  RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima',
  SC: 'Santa Catarina', SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins',
};
const EMPTY_PREFERENCES: Preferences = { allowPush: true, allowWhatsapp: true };

function messageFromError(error: unknown): string {
  const candidate = error as { response?: { data?: { message?: string | string[] } }; message?: string };
  const message = candidate.response?.data?.message;
  return Array.isArray(message) ? message.join(' ') : message || candidate.message || 'Ocorreu um erro inesperado.';
}
function cleanCnpj(value: string) {
  return value.replace(/[^0-9a-z]/gi, '').toUpperCase().slice(0, 14);
}
interface BrasilApiCompany {
  razao_social?: string;
  nome_fantasia?: string;
  cnae_fiscal?: number | string;
  cnae_fiscal_descricao?: string;
  cnaes_secundarios?: Array<{ codigo?: number | string; descricao?: string }>;
}
async function lookupPublicCnpj(cnpj: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${encodeURIComponent(cnpj)}`, { signal: controller.signal });
    if (!response.ok) throw new Error(`BrasilAPI HTTP ${response.status}`);
    const company = await response.json() as BrasilApiCompany;
    const cnaes: Cnae[] = [
      ...(company.cnae_fiscal && company.cnae_fiscal_descricao ? [{
        code: String(company.cnae_fiscal).replace(/\D/g, '').padStart(7, '0'),
        description: company.cnae_fiscal_descricao,
        isPrimary: true,
      }] : []),
      ...(company.cnaes_secundarios ?? []).map((item) => ({
        code: String(item.codigo ?? '').replace(/\D/g, '').padStart(7, '0'),
        description: String(item.descricao ?? ''),
        isPrimary: false,
      })).filter((item) => item.description.length > 0),
    ];
    return {
      corporateName: company.razao_social ?? '',
      tradeName: company.nome_fantasia || company.razao_social || '',
      cnaes,
      source: 'BrasilAPI / Minha Receita',
    };
  } finally {
    clearTimeout(timeout);
  }
}
function unique<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const value = key(item);
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

export function ProfileScreen() {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [cnpj, setCnpj] = useState('');
  const [corporateName, setCorporateName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [cnaes, setCnaes] = useState<Cnae[]>([]);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [regions, setRegions] = useState<CompanyRegion[]>([]);
  const [keywordDraft, setKeywordDraft] = useState('');
  const [keywordMode, setKeywordMode] = useState<'include' | 'exclude'>('include');
  const [cityUf, setCityUf] = useState('');
  const [cityQuery, setCityQuery] = useState('');
  const [expandedRegion, setExpandedRegion] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Preferences>(EMPTY_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [lookingUp, setLookingUp] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [profileResponse, preferenceResponse] = await Promise.all([
          profileApi.get(),
          preferencesApi.get().catch(() => ({ data: EMPTY_PREFERENCES })),
        ]);
        if (!active) return;
        const data = profileResponse.data as CompanyProfile;
        setProfile(data);
        setCnpj(cleanCnpj(data.cnpj ?? ''));
        setCorporateName(data.corporateName ?? '');
        setTradeName(data.tradeName ?? '');
        setCnaes(data.cnaes ?? []);
        setKeywords((data.keywords ?? []).map((item) => ({
          keyword: item.keyword,
          matchType: item.matchType ?? 'include',
          weight: item.weight,
        })));
        setRegions(data.regions ?? []);
        setPrefs({ ...EMPTY_PREFERENCES, ...(preferenceResponse.data ?? {}) });
      } catch (error) {
        if (active) setFeedback({ kind: 'error', text: `Não foi possível carregar o perfil da empresa. ${messageFromError(error)}` });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const selectedUfRegions = useMemo(
    () => new Set(regions.filter((region) => region.scopeType === 'uf').map((region) => region.uf)),
    [regions],
  );
  const nationwide = regions.some((region) => region.scopeType === 'nacional');

  async function lookupCnpj() {
    if (cnpj.length !== 14) {
      setFeedback({ kind: 'error', text: 'Informe os 14 caracteres do CNPJ.' });
      return;
    }
    setLookingUp(true);
    setFeedback(null);
    try {
      let data;
      try {
        data = await lookupPublicCnpj(cnpj);
      } catch {
        const response = await profileApi.lookupCnpj(cnpj);
        data = response.data;
      }
      setCorporateName(data.corporateName ?? '');
      setTradeName(data.tradeName || data.corporateName || '');
      setCnaes((data.cnaes ?? []) as Cnae[]);
      setFeedback({ kind: 'success', text: `Dados recebidos de ${data.source ?? 'consulta cadastral'}. Revise e salve para vincular ao perfil.` });
    } catch (error) {
      setFeedback({ kind: 'error', text: messageFromError(error) });
    } finally {
      setLookingUp(false);
    }
  }

  function toggleUf(uf: string) {
    if (nationwide) return;
    setRegions((current) => {
      const exists = current.some((region) => region.scopeType === 'uf' && region.uf === uf);
      return exists
        ? current.filter((region) => !(region.scopeType === 'uf' && region.uf === uf))
        : [...current.filter((region) => region.scopeType !== 'nacional'), { scopeType: 'uf', uf }];
    });
  }

  function toggleRegionStates(ufs: string[]) {
    if (nationwide) return;
    const allSelected = ufs.every((uf) => selectedUfRegions.has(uf));
    setRegions((current) => {
      const withoutRegionUfs = current.filter((region) => !(region.scopeType === 'uf' && ufs.includes(region.uf)));
      return allSelected
        ? withoutRegionUfs
        : [...withoutRegionUfs, ...ufs.map((uf) => ({ scopeType: 'uf' as const, uf }))];
    });
  }

  function toggleNationwide(enabled: boolean) {
    setRegions((current) => enabled
      ? [{ scopeType: 'nacional', uf: 'BR' }]
      : current.filter((region) => region.scopeType !== 'nacional'));
  }

  function addMunicipality(municipality: MunicipalityOption) {
    setRegions((current) => unique([
      ...current.filter((region) => region.scopeType !== 'nacional'),
      {
        scopeType: 'municipio',
        uf: municipality.uf,
        municipalityName: municipality.name,
        municipalityIbgeCode: municipality.code,
      },
    ], (region) => `${region.scopeType}:${region.uf}:${region.municipalityIbgeCode ?? ''}`));
    setCityQuery('');
  }

  function addKeyword() {
    const value = keywordDraft.trim();
    if (!value) return;
    setKeywords((current) => unique(
      [...current, { keyword: value, matchType: keywordMode, weight: 1 }],
      (item) => `${item.matchType}:${item.keyword.toLocaleLowerCase('pt-BR')}`,
    ));
    setKeywordDraft('');
  }

  async function saveProfile() {
    if (!corporateName.trim() || !tradeName.trim() || cnpj.length !== 14) {
      setFeedback({ kind: 'error', text: 'Preencha CNPJ, razão social e nome fantasia antes de salvar.' });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      const payload = {
        cnpj,
        corporateName: corporateName.trim(),
        tradeName: tradeName.trim(),
        cnaes,
        keywords,
        regions,
      };
      await profileApi.update(payload);
      try {
        await preferencesApi.update(prefs);
      } catch {
        setFeedback({ kind: 'error', text: 'Perfil salvo, mas não foi possível atualizar as preferências de notificação.' });
        return;
      }
      if (prefs.allowPush && Platform.OS !== 'web') {
        await registerPushDevice().catch((error) => {
          console.warn('[ProfileScreen] Push device registration unavailable:', error);
        });
      }
      setFeedback({ kind: 'success', text: 'Perfil da empresa e preferências salvos com sucesso.' });
    } catch (error) {
      setFeedback({ kind: 'error', text: `Não foi possível salvar o perfil. ${messageFromError(error)}` });
    } finally {
      setSaving(false);
    }
  }

  async function openOfficialCard() {
    const url = profile?.cnpjCard?.fileUrl || profile?.cnpjCard?.url || 'https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/cnpjreva_solicitacao.asp';
    try {
      await Linking.openURL(url);
    } catch {
      setFeedback({ kind: 'error', text: 'Não foi possível abrir o portal da Receita Federal.' });
    }
  }

  function handleLogout() {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm('Deseja encerrar a sessão?')) void logout();
      return;
    }
    Alert.alert('Sair', 'Deseja encerrar a sessão?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: () => { void logout(); } },
    ]);
  }

  const roleLabel: Record<string, string> = {
    tenant_owner: 'Proprietário', tenant_user: 'Usuário', taed_admin: 'Admin TAED', taed_operator: 'Operador TAED',
  };

  if (loading) {
    return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{user?.fullName?.charAt(0)?.toUpperCase() ?? 'U'}</Text></View>
        <Text style={styles.name}>{user?.fullName ?? '—'}</Text>
        <Text style={styles.email}>{user?.email ?? '—'}</Text>
        <View style={styles.roleBadge}><Text style={styles.roleText}>{roleLabel[user?.role ?? ''] ?? user?.role ?? '—'}</Text></View>
      </View>

      {feedback ? (
        <View style={[styles.feedback, feedback.kind === 'success' ? styles.feedbackSuccess : feedback.kind === 'error' ? styles.feedbackError : styles.feedbackInfo]}>
          <Text style={styles.feedbackText}>{feedback.text}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Minha Empresa</Text>
        <Text style={styles.helpText}>Consulte os dados cadastrais e revise os CNAEs antes de salvar.</Text>
        <View style={styles.lookupRow}>
          <TextInput
            value={cnpj}
            onChangeText={(value) => setCnpj(cleanCnpj(value))}
            placeholder="CNPJ (14 caracteres)"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="characters"
            maxLength={14}
            style={[styles.input, styles.cnpjInput]}
          />
          <TouchableOpacity style={[styles.button, styles.lookupButton]} onPress={lookupCnpj} disabled={lookingUp}>
            {lookingUp ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.buttonText}>Consultar</Text>}
          </TouchableOpacity>
        </View>
        <Field label="Razão social" value={corporateName} onChangeText={setCorporateName} placeholder="Razão social da empresa" />
        <Field label="Nome fantasia" value={tradeName} onChangeText={setTradeName} placeholder="Nome fantasia" />

        <View style={styles.cardInset}>
          <Text style={styles.subTitle}>Cartão CNPJ oficial</Text>
          <Text style={styles.helpText}>O documento oficial é gerado no portal da Receita Federal; a consulta cadastral não substitui o comprovante.</Text>
          <TouchableOpacity style={styles.linkButton} onPress={openOfficialCard} activeOpacity={0.8}>
            <Text style={styles.linkButtonText}>{profile?.cnpjCard?.fileUrl ? 'Abrir comprovante enviado' : 'Abrir portal da Receita Federal'}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.subTitle}>CNAEs da empresa</Text>
        {cnaes.length === 0 ? <Text style={styles.emptyNote}>Consulte o CNPJ para carregar os CNAEs principal e secundários.</Text> : null}
        <View style={styles.tagsWrap}>
          {cnaes.map((cnae) => (
            <View style={styles.cnaeTag} key={cnae.code}>
              <View style={styles.cnaeTextWrap}>
                <Text style={styles.cnaeCode}>{cnae.code}{cnae.isPrimary ? ' · Principal' : ''}</Text>
                <Text style={styles.cnaeDescription}>{cnae.description}</Text>
              </View>
              <TouchableOpacity onPress={() => setCnaes((current) => current.filter((item) => item.code !== cnae.code))} hitSlop={8}>
                <Text style={styles.removeTag}>×</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Objetos / Serviços de Fornecimento</Text>
        <Text style={styles.helpText}>Adicione termos livres. Termos excluídos impedem que um edital compatível apareça no radar.</Text>
        <View style={styles.modeRow}>
          <TouchableOpacity style={[styles.modeButton, keywordMode === 'include' && styles.modeButtonActive]} onPress={() => setKeywordMode('include')}>
            <Text style={[styles.modeText, keywordMode === 'include' && styles.modeTextActive]}>Incluir</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.modeButton, keywordMode === 'exclude' && styles.modeButtonExclude]} onPress={() => setKeywordMode('exclude')}>
            <Text style={[styles.modeText, keywordMode === 'exclude' && styles.modeTextActive]}>Excluir</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.lookupRow}>
          <TextInput
            value={keywordDraft}
            onChangeText={setKeywordDraft}
            placeholder={keywordMode === 'include' ? 'Ex.: dedetização, material de limpeza' : 'Ex.: produto usado'}
            placeholderTextColor={Colors.textMuted}
            style={[styles.input, styles.keywordInput]}
            onSubmitEditing={addKeyword}
            returnKeyType="done"
          />
          <TouchableOpacity style={styles.addButton} onPress={addKeyword}><Text style={styles.buttonText}>Adicionar</Text></TouchableOpacity>
        </View>
        <View style={styles.tagsWrap}>
          {keywords.map((item, index) => (
            <View key={`${item.matchType}-${item.keyword}-${index}`} style={[styles.keywordTag, item.matchType === 'exclude' && styles.keywordTagExclude]}>
              <Text style={[styles.keywordText, item.matchType === 'exclude' && styles.keywordTextExclude]}>{item.keyword}</Text>
              <TouchableOpacity onPress={() => setKeywords((current) => current.filter((_, currentIndex) => currentIndex !== index))} hitSlop={8}>
                <Text style={styles.removeTag}>×</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Área de Abrangência</Text>
        <Text style={styles.helpText}>Escolha o Brasil inteiro ou expanda uma Grande Região para selecionar estados individualmente.</Text>
        <TouchableOpacity style={styles.nationRow} onPress={() => toggleNationwide(!nationwide)}>
          <View style={[styles.checkbox, nationwide && styles.checkboxSelected]}>{nationwide ? <Text style={styles.checkboxMark}>✓</Text> : null}</View>
          <Text style={styles.nationLabel}>Brasil — todas as UFs</Text>
        </TouchableOpacity>
        {Object.entries(GREAT_REGIONS).map(([regionName, ufs]) => {
          const expanded = expandedRegion === regionName;
          const selectedCount = ufs.filter((uf) => selectedUfRegions.has(uf)).length;
          return (
            <View key={regionName} style={styles.regionBlock}>
              <TouchableOpacity style={styles.regionHeader} onPress={() => setExpandedRegion(expanded ? null : regionName)}>
                <Text style={styles.expandIcon}>{expanded ? '−' : '+'}</Text>
                <Text style={styles.regionTitle}>{regionName}</Text>
                <Text style={styles.regionCount}>{selectedCount}/{ufs.length} UFs</Text>
              </TouchableOpacity>
              {expanded ? (
                <View style={styles.regionContent}>
                  <TouchableOpacity style={styles.selectAllRow} onPress={() => toggleRegionStates(ufs)}>
                    <Text style={styles.selectAllText}>{ufs.every((uf) => selectedUfRegions.has(uf)) ? 'Desmarcar todos os estados' : 'Selecionar todos os estados da região'}</Text>
                  </TouchableOpacity>
                  <View style={styles.tagsWrap}>
                    {ufs.map((uf) => {
                      const selected = selectedUfRegions.has(uf);
                      return (
                        <TouchableOpacity key={uf} onPress={() => toggleUf(uf)} style={[styles.ufChip, selected && styles.ufChipActive, nationwide && styles.ufChipDisabled]}>
                          <Text style={[styles.ufChipText, selected && styles.ufChipTextActive]}>{uf} · {UF_NAMES[uf]}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ) : null}
            </View>
          );
        })}

        <Text style={[styles.subTitle, { marginTop: 18 }]}>Cidades de preferência</Text>
        <Text style={styles.helpText}>Digite a UF e escolha uma sugestão oficial do IBGE no formato Cidade - UF.</Text>
        <TextInput
          value={cityUf}
          onChangeText={(value) => { setCityUf(value.replace(/[^a-z]/gi, '').toUpperCase().slice(0, 2)); setCityQuery(''); }}
          placeholder="UF (ex.: RJ)"
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="characters"
          maxLength={2}
          style={[styles.input, styles.ufInput]}
        />
        <View style={{ marginTop: 9 }}>
          <MunicipalityAutocomplete
            uf={cityUf}
            value={cityQuery}
            onChangeText={setCityQuery}
            onSelect={addMunicipality}
            placeholder={cityUf.length === 2 ? 'Buscar cidade pelo nome' : 'Informe a UF primeiro'}
          />
        </View>
        <View style={[styles.tagsWrap, { marginTop: 10 }]}>
          {regions.map((region, index) => {
            const label = region.scopeType === 'nacional'
              ? 'Brasil · Todas as UFs'
              : region.scopeType === 'municipio'
                ? `${region.municipalityName} - ${region.uf}`
                : `${UF_NAMES[region.uf] ?? region.uf} (${region.uf})`;
            return (
              <View style={styles.selectedRegionTag} key={`${region.scopeType}-${region.uf}-${region.municipalityIbgeCode ?? index}`}>
                <Text style={styles.selectedRegionText}>{label}</Text>
                <TouchableOpacity onPress={() => setRegions((current) => current.filter((_, currentIndex) => currentIndex !== index))} hitSlop={8}>
                  <Text style={styles.removeTag}>×</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Preferências de Notificação</Text>
        <PreferenceRow label="Notificações Push" description="Receber alertas no aplicativo" value={prefs.allowPush} onChange={(value) => setPrefs((current) => ({ ...current, allowPush: value }))} />
        <View style={styles.separator} />
        <PreferenceRow label="Notificações WhatsApp" description="Receber alertas pelo WhatsApp" value={prefs.allowWhatsapp} onChange={(value) => setPrefs((current) => ({ ...current, allowWhatsapp: value }))} />
        <Text style={styles.helpText}>As notificações in-app aparecem na central do LICITA IA. Push requer um build nativo com token Expo/FCM; no Web, use a central de notificações.</Text>
      </View>

      <TouchableOpacity style={[styles.button, styles.saveButton]} onPress={saveProfile} disabled={saving} activeOpacity={0.85}>
        {saving ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.buttonText}>Salvar perfil da empresa</Text>}
      </TouchableOpacity>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Conta</Text>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.85}>
          <Text style={styles.logoutText}>Sair da conta</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.version}>LICITA IA v1.0.0 — TAED Soluções</Text>
      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

function Field({ label, value, onChangeText, placeholder }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={Colors.textMuted} style={styles.input} />
    </View>
  );
}
function PreferenceRow({ label, description, value, onChange }: { label: string; description: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <View style={styles.prefRow}>
      <View style={styles.prefInfo}>
        <Text style={styles.prefLabel}>{label}</Text>
        <Text style={styles.prefDesc}>{description}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: Colors.success, false: Colors.border }} thumbColor={Colors.white} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 24 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  header: { backgroundColor: Colors.primary, alignItems: 'center', paddingTop: 34, paddingBottom: 28, paddingHorizontal: 24 },
  avatar: { width: 70, height: 70, borderRadius: 35, backgroundColor: Colors.success, alignItems: 'center', justifyContent: 'center', marginBottom: 10, borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)' },
  avatarText: { fontSize: 30, fontWeight: '900', color: Colors.white },
  name: { fontSize: 20, fontWeight: '800', color: Colors.white, marginBottom: 3 },
  email: { fontSize: 13, color: 'rgba(255,255,255,0.72)', marginBottom: 9 },
  roleBadge: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  roleText: { color: Colors.white, fontSize: 12, fontWeight: '600' },
  feedback: { marginHorizontal: 16, marginTop: 14, borderRadius: 10, padding: 12 },
  feedbackSuccess: { backgroundColor: '#E8F5E9', borderColor: '#B7E1BE', borderWidth: 1 },
  feedbackError: { backgroundColor: '#FDECEC', borderColor: '#F4C3C3', borderWidth: 1 },
  feedbackInfo: { backgroundColor: '#EAF2FF', borderColor: '#BDD4FF', borderWidth: 1 },
  feedbackText: { fontSize: 13, color: Colors.textPrimary, lineHeight: 19 },
  card: { backgroundColor: Colors.white, marginHorizontal: 16, marginTop: 16, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary, marginBottom: 7 },
  subTitle: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary, marginTop: 12, marginBottom: 7 },
  helpText: { fontSize: 12, color: Colors.textMuted, lineHeight: 17, marginBottom: 9 },
  field: { marginTop: 10 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, marginBottom: 5 },
  input: { minHeight: 44, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, color: Colors.textPrimary, backgroundColor: Colors.white, fontSize: 14 },
  lookupRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cnpjInput: { flex: 1 },
  keywordInput: { flex: 1 },
  ufInput: { width: 92, textAlign: 'center', fontWeight: '700' },
  button: { alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 16, minHeight: 44 },
  lookupButton: { minWidth: 105 },
  buttonText: { color: Colors.white, fontWeight: '700', fontSize: 13 },
  addButton: { alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.success, borderRadius: 10, paddingHorizontal: 14, minHeight: 44 },
  linkButton: { alignSelf: 'flex-start', borderWidth: 1, borderColor: Colors.primary, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9 },
  linkButtonText: { color: Colors.primary, fontWeight: '700', fontSize: 12 },
  cardInset: { marginTop: 12, padding: 12, borderRadius: 11, backgroundColor: Colors.background },
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cnaeTag: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F1F5F9', borderRadius: 9, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 10, paddingVertical: 8, maxWidth: '100%' },
  cnaeTextWrap: { flexShrink: 1 },
  cnaeCode: { fontSize: 11, fontWeight: '800', color: Colors.primary },
  cnaeDescription: { fontSize: 11, color: Colors.textSecondary, marginTop: 2, maxWidth: 440 },
  removeTag: { fontSize: 19, lineHeight: 20, fontWeight: '700', color: Colors.textMuted, paddingHorizontal: 2 },
  emptyNote: { color: Colors.textMuted, fontSize: 12, marginBottom: 8 },
  modeRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  modeButton: { borderRadius: 18, paddingHorizontal: 13, paddingVertical: 7, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border },
  modeButtonActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  modeButtonExclude: { backgroundColor: Colors.danger, borderColor: Colors.danger },
  modeText: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  modeTextActive: { color: Colors.white },
  keywordTag: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 18, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#E8F5E9' },
  keywordTagExclude: { backgroundColor: '#FDECEC' },
  keywordText: { color: '#216E39', fontSize: 12, fontWeight: '700' },
  keywordTextExclude: { color: Colors.danger },
  nationRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  checkbox: { width: 19, height: 19, borderRadius: 5, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkboxMark: { fontSize: 12, fontWeight: '900', color: Colors.white, lineHeight: 15 },
  nationLabel: { fontSize: 14, color: Colors.textPrimary, fontWeight: '700' },
  regionBlock: { borderTopWidth: 1, borderTopColor: Colors.background },
  regionHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 10 },
  expandIcon: { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.background, color: Colors.primary, textAlign: 'center', lineHeight: 22, fontWeight: '800' },
  regionTitle: { flex: 1, fontSize: 13, color: Colors.textPrimary, fontWeight: '700' },
  regionCount: { color: Colors.textMuted, fontSize: 11, fontWeight: '600' },
  regionContent: { paddingBottom: 12, paddingLeft: 30 },
  selectAllRow: { paddingVertical: 6 },
  selectAllText: { color: Colors.primary, fontWeight: '700', fontSize: 12 },
  ufChip: { borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.white, borderRadius: 18, paddingHorizontal: 10, paddingVertical: 7 },
  ufChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  ufChipDisabled: { opacity: 0.45 },
  ufChipText: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600' },
  ufChipTextActive: { color: Colors.white },
  selectedRegionTag: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 18, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#EAF2FF' },
  selectedRegionText: { color: Colors.primary, fontSize: 11, fontWeight: '700' },
  prefRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 7 },
  prefInfo: { flex: 1, paddingRight: 12 },
  prefLabel: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  prefDesc: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  separator: { height: 1, backgroundColor: Colors.background, marginVertical: 8 },
  saveButton: { marginHorizontal: 16, marginTop: 18, minHeight: 50 },
  logoutButton: { backgroundColor: Colors.danger, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  logoutText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
  version: { textAlign: 'center', color: Colors.textMuted, fontSize: 12, marginTop: 22 },
});
