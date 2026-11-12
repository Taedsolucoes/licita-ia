import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { profileApi } from '../services/api';
import { Colors } from '../theme/colors';

export interface MunicipalityOption {
  code: string;
  name: string;
  uf: string;
  label: string;
}

interface IbgeMunicipality { id: number; nome: string }
const municipalityCache = new Map<string, Promise<IbgeMunicipality[]>>();

function normalizeSearch(value: string) {
  return value.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

async function searchIbgeMunicipalities(uf: string, query: string): Promise<MunicipalityOption[]> {
  let municipalities = municipalityCache.get(uf);
  if (!municipalities) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const request = fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`IBGE HTTP ${response.status}`);
        return await response.json() as IbgeMunicipality[];
      })
      .finally(() => clearTimeout(timeout));
    municipalityCache.set(uf, request);
    municipalities = request;
  }
  try {
    const rows = await municipalities;
    return rows
      .filter((item) => normalizeSearch(item.nome).includes(normalizeSearch(query)))
      .slice(0, 20)
      .map((item) => ({ code: String(item.id).padStart(7, '0'), name: item.nome, uf, label: `${item.nome} - ${uf}` }));
  } catch (error) {
    municipalityCache.delete(uf);
    throw error;
  }
}

interface Props {
  uf: string;
  value: string;
  onChangeText: (value: string) => void;
  onSelect: (municipality: MunicipalityOption) => void;
  placeholder?: string;
}

export function MunicipalityAutocomplete({
  uf,
  value,
  onChangeText,
  onSelect,
  placeholder = 'Digite pelo menos 2 letras',
}: Props) {
  const [options, setOptions] = useState<MunicipalityOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const normalizedUf = uf.trim().toUpperCase();
    const query = value.trim();
    if (normalizedUf.length !== 2 || query.length < 2) {
      setOptions([]);
      setError('');
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        let data: unknown;
        try {
          const response = await profileApi.municipalities(normalizedUf, query);
          data = response.data;
        } catch {
          data = await searchIbgeMunicipalities(normalizedUf, query);
        }
        if (!cancelled) {
          setOptions(Array.isArray(data) ? data as MunicipalityOption[] : []);
          setError('');
        }
      } catch {
        if (!cancelled) {
          setOptions([]);
          setError('Não foi possível consultar os municípios do IBGE. Tente novamente.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [uf, value]);

  return (
    <View style={styles.wrapper}>
      <View style={styles.inputRow}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          style={styles.input}
          autoCorrect={false}
          returnKeyType="search"
        />
        {loading ? <ActivityIndicator size="small" color={Colors.primary} /> : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {options.length > 0 ? (
        <View style={styles.options}>
          {options.map((option) => (
            <TouchableOpacity
              key={option.code}
              style={styles.option}
              onPress={() => {
                onSelect(option);
                setOptions([]);
              }}
              activeOpacity={0.75}
            >
              <Text style={styles.optionText}>{option.label}</Text>
              <Text style={styles.optionCode}>IBGE {option.code}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'relative', zIndex: 20 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  input: { flex: 1, minHeight: 44, color: Colors.textPrimary, fontSize: 14, outlineStyle: 'none' } as object,
  options: {
    position: 'absolute',
    top: 46,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: Colors.white,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
    ...(typeof window !== 'undefined' ? { boxShadow: '0 8px 18px rgba(15,23,42,0.14)' } : {}),
  } as object,
  option: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.background },
  optionText: { fontSize: 14, color: Colors.textPrimary, fontWeight: '600' },
  optionCode: { fontSize: 10, color: Colors.textMuted, marginTop: 2 },
  error: { fontSize: 11, color: Colors.danger, marginTop: 5 },
});
