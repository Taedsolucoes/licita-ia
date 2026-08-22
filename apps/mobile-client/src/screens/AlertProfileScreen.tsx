import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { alertProfileApi } from '../services/api';
import type { AlertProfile } from '../services/api';
import { Colors } from '../theme/colors';

const DEFAULT_FILTER = {
  municipioBase: '',
  raioKm: 50,
  participaMunicipal: true,
  participaEstadual: true,
  participaFederal: true,
  participaAutarquias: false,
  modalidadePregao: true,
  modalidadeDispensa: true,
  modalidadeOutros: false,
  notificaEmail: true,
  notificaWhatsapp: false,
  notificaPush: true,
};

type FilterState = typeof DEFAULT_FILTER;

function profileToState(profile: AlertProfile): FilterState {
  return {
    municipioBase: profile.filter.municipioBase ?? '',
    raioKm: profile.filter.raioKm,
    participaMunicipal: profile.filter.participaMunicipal,
    participaEstadual: profile.filter.participaEstadual,
    participaFederal: profile.filter.participaFederal,
    participaAutarquias: profile.filter.participaAutarquias,
    modalidadePregao: profile.filter.modalidadePregao,
    modalidadeDispensa: profile.filter.modalidadeDispensa,
    modalidadeOutros: profile.filter.modalidadeOutros,
    notificaEmail: profile.filter.notificaEmail,
    notificaWhatsapp: profile.filter.notificaWhatsapp,
    notificaPush: profile.filter.notificaPush,
  };
}

export function AlertProfileScreen() {
  const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [regions, setRegions] = useState<AlertProfile['regions']>([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [ufInput, setUfInput] = useState('');
  const [ibgeInput, setIbgeInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    alertProfileApi.get()
      .then(({ data }) => {
        if (!active) return;
        setFilter(profileToState(data));
        setKeywords(data.keywords.map((item) => item.keyword));
        setRegions(data.regions);
      })
      .catch(() => { if (active) setError('Não foi possível carregar seu perfil de alertas.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const regionLabels = useMemo(
    () => regions.map((region) => [region.uf, region.municipalityName || region.municipalityIbgeCode].filter(Boolean).join(' / ')),
    [regions],
  );

  function addKeyword() {
    const next = keywordInput.trim();
    if (!next) return;
    if (!keywords.some((item) => item.toLowerCase() === next.toLowerCase())) setKeywords((current) => [...current, next]);
    setKeywordInput('');
  }

  function addRegion() {
    const uf = ufInput.trim().toUpperCase();
    const ibge = ibgeInput.trim();
    if (uf.length !== 2) {
      Alert.alert('UF inválida', 'Informe uma UF com duas letras.');
      return;
    }
    if (ibge && !/^\d{7}$/.test(ibge)) {
      Alert.alert('Código IBGE inválido', 'Informe sete dígitos ou deixe o campo vazio para acompanhar toda a UF.');
      return;
    }
    const exists = regions.some((region) => region.uf === uf && region.municipalityIbgeCode === (ibge || null));
    if (!exists) {
      setRegions((current) => [...current, {
        id: `new-${uf}-${ibge || 'uf'}`,
        uf,
        municipalityName: null,
        municipalityIbgeCode: ibge || null,
        scopeType: ibge ? 'municipio' : 'uf',
      }]);
    }
    setUfInput('');
    setIbgeInput('');
  }

  async function save() {
    if (keywords.length === 0 || regions.length === 0) {
      Alert.alert('Complete seu alerta', 'Adicione pelo menos uma palavra-chave e uma região.');
      return;
    }
    setSaving(true);
    try {
      await alertProfileApi.update({
        ...filter,
        keywords: keywords.map((keyword) => ({ keyword, matchType: 'include', weight: 1 })),
        regions: regions.map((region) => ({
          uf: region.uf,
          municipalityName: region.municipalityName ?? undefined,
          municipalityIbgeCode: region.municipalityIbgeCode ?? undefined,
          scopeType: region.scopeType,
        })),
      });
      Alert.alert('Alerta salvo', 'Seu perfil será usado nas próximas licitações ingeridas.');
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar o perfil de alertas.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <View style={styles.loading}><ActivityIndicator color={Colors.primary} size="large" /></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.eyebrow}>PERSONALIZE SEUS ALERTAS</Text>
      <Text style={styles.title}>O que sua empresa quer encontrar?</Text>
      <Text style={styles.subtitle}>Defina os critérios que serão usados para transformar novas publicações em oportunidades para sua empresa.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Palavras-chave</Text>
        <Text style={styles.cardDescription}>Use produtos, serviços ou expressões que aparecem nos editais.</Text>
        <View style={styles.addRow}>
          <TextInput value={keywordInput} onChangeText={setKeywordInput} onSubmitEditing={addKeyword} returnKeyType="done" placeholder="Ex.: material hospitalar" placeholderTextColor={Colors.textMuted} style={styles.input} />
          <TouchableOpacity style={styles.addButton} onPress={addKeyword}><Text style={styles.addButtonText}>Adicionar</Text></TouchableOpacity>
        </View>
        <View style={styles.tagWrap}>
          {keywords.map((keyword) => <TouchableOpacity key={keyword} style={styles.tag} onPress={() => setKeywords((current) => current.filter((item) => item !== keyword))}><Text style={styles.tagText}>{keyword}  ×</Text></TouchableOpacity>)}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Regiões de interesse</Text>
        <Text style={styles.cardDescription}>Informe uma UF inteira ou acrescente o código IBGE de um município específico.</Text>
        <View style={styles.addRow}>
          <TextInput value={ufInput} onChangeText={(value) => setUfInput(value.replace(/[^a-zA-Z]/g, '').slice(0, 2))} autoCapitalize="characters" maxLength={2} placeholder="UF" placeholderTextColor={Colors.textMuted} style={[styles.input, styles.ufInput]} />
          <TextInput value={ibgeInput} onChangeText={(value) => setIbgeInput(value.replace(/\D/g, '').slice(0, 7))} keyboardType="numeric" placeholder="Código IBGE (opcional)" placeholderTextColor={Colors.textMuted} style={[styles.input, styles.ibgeInput]} />
          <TouchableOpacity style={styles.addButton} onPress={addRegion}><Text style={styles.addButtonText}>Adicionar</Text></TouchableOpacity>
        </View>
        <View style={styles.tagWrap}>
          {regionLabels.map((label, index) => <TouchableOpacity key={`${label}-${index}`} style={styles.tag} onPress={() => setRegions((current) => current.filter((_, regionIndex) => regionIndex !== index))}><Text style={styles.tagText}>{label}  ×</Text></TouchableOpacity>)}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Abrangência</Text>
        <View style={styles.fieldRow}><View style={styles.fieldCopy}><Text style={styles.fieldLabel}>Município de referência</Text><Text style={styles.fieldHint}>Usado como referência de proximidade.</Text></View><TextInput value={filter.municipioBase} onChangeText={(value) => setFilter((current) => ({ ...current, municipioBase: value }))} placeholder="Ex.: Rio das Ostras" placeholderTextColor={Colors.textMuted} style={styles.baseInput} /></View>
        <View style={styles.fieldRow}><View style={styles.fieldCopy}><Text style={styles.fieldLabel}>Raio de busca</Text><Text style={styles.fieldHint}>Distância máxima em quilômetros.</Text></View><TextInput value={String(filter.raioKm)} onChangeText={(value) => setFilter((current) => ({ ...current, raioKm: Number(value.replace(/\D/g, '')) || 1 }))} keyboardType="numeric" style={styles.radiusInput} /></View>
        <SwitchRow label="Órgãos municipais" value={filter.participaMunicipal} onChange={(value) => setFilter((current) => ({ ...current, participaMunicipal: value }))} />
        <SwitchRow label="Órgãos estaduais" value={filter.participaEstadual} onChange={(value) => setFilter((current) => ({ ...current, participaEstadual: value }))} />
        <SwitchRow label="Órgãos federais" value={filter.participaFederal} onChange={(value) => setFilter((current) => ({ ...current, participaFederal: value }))} />
        <SwitchRow label="Autarquias e outros" value={filter.participaAutarquias} onChange={(value) => setFilter((current) => ({ ...current, participaAutarquias: value }))} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Modalidades e entrega</Text>
        <SwitchRow label="Pregão eletrônico" value={filter.modalidadePregao} onChange={(value) => setFilter((current) => ({ ...current, modalidadePregao: value }))} />
        <SwitchRow label="Dispensa" value={filter.modalidadeDispensa} onChange={(value) => setFilter((current) => ({ ...current, modalidadeDispensa: value }))} />
        <SwitchRow label="Outras modalidades" value={filter.modalidadeOutros} onChange={(value) => setFilter((current) => ({ ...current, modalidadeOutros: value }))} />
        <View style={styles.separator} />
        <SwitchRow label="Notificação push" value={filter.notificaPush} onChange={(value) => setFilter((current) => ({ ...current, notificaPush: value }))} />
        <SwitchRow label="Notificação por e-mail" value={filter.notificaEmail} onChange={(value) => setFilter((current) => ({ ...current, notificaEmail: value }))} />
        <SwitchRow label="Notificação por WhatsApp" value={filter.notificaWhatsapp} onChange={(value) => setFilter((current) => ({ ...current, notificaWhatsapp: value }))} />
      </View>

      <TouchableOpacity style={[styles.saveButton, saving && styles.disabledButton]} onPress={() => void save()} disabled={saving} activeOpacity={0.8}>
        {saving ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.saveText}>Salvar meu perfil de alertas</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

function SwitchRow({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return <View style={styles.switchRow}><Text style={styles.fieldLabel}>{label}</Text><Switch value={value} onValueChange={onChange} trackColor={{ true: Colors.success, false: Colors.border }} thumbColor={Colors.white} /></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 18, paddingBottom: 36 },
  loading: { flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: Colors.primaryLight, fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  title: { color: Colors.textPrimary, fontSize: 26, lineHeight: 32, fontWeight: '900', marginTop: 7 },
  subtitle: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 8 },
  error: { color: Colors.danger, marginTop: 12, fontSize: 13 },
  card: { backgroundColor: Colors.white, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 15, marginTop: 14 },
  cardTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '900' },
  cardDescription: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 5 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  input: { flex: 1, height: 42, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 11, color: Colors.textPrimary, fontSize: 13 },
  ufInput: { flex: 0, width: 56, textAlign: 'center' },
  ibgeInput: { flex: 1.2 },
  addButton: { backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 12, height: 42, alignItems: 'center', justifyContent: 'center' },
  addButtonText: { color: Colors.white, fontWeight: '800', fontSize: 12 },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12 },
  tag: { backgroundColor: Colors.successBg, borderRadius: 15, paddingHorizontal: 10, paddingVertical: 7 },
  tagText: { color: Colors.success, fontSize: 12, fontWeight: '700' },
  fieldRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 14 },
  fieldCopy: { flex: 1 },
  fieldLabel: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  fieldHint: { color: Colors.textMuted, fontSize: 11, marginTop: 3 },
  baseInput: { width: 145, height: 38, borderWidth: 1, borderColor: Colors.border, borderRadius: 9, paddingHorizontal: 9, color: Colors.textPrimary, fontSize: 12 },
  radiusInput: { width: 65, height: 38, borderWidth: 1, borderColor: Colors.border, borderRadius: 9, paddingHorizontal: 9, color: Colors.textPrimary, fontSize: 12, textAlign: 'center' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 7 },
  separator: { height: 1, backgroundColor: Colors.background, marginVertical: 8 },
  saveButton: { backgroundColor: Colors.primary, borderRadius: 12, minHeight: 49, alignItems: 'center', justifyContent: 'center', marginTop: 17 },
  disabledButton: { opacity: 0.7 },
  saveText: { color: Colors.white, fontSize: 14, fontWeight: '900' },
});
