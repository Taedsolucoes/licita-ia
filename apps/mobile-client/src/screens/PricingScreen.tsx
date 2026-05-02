import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { biddingsApi, participationsApi } from '../services/api';
import { Colors } from '../theme/colors';
import type { PricingScreenProps } from '../types/navigation';

interface BiddingItem {
  id: string;
  itemNumber: number;
  description: string;
  quantity: number;
  unit: string;
  unitValueEstimated?: number | null;
}

interface PricingEntry {
  biddingItemId: string;
  brand: string;
  finalUnitPrice: string;
}

function formatBRL(value: number | null | undefined) {
  if (value == null) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function parsePriceBRL(raw: string): number {
  return parseFloat(raw.replace(/\./g, '').replace(',', '.')) || 0;
}

export function PricingScreen({ route, navigation }: PricingScreenProps) {
  const { participationId, biddingId } = route.params;

  const [items, setItems] = useState<BiddingItem[]>([]);
  const [pricing, setPricing] = useState<Record<string, PricingEntry>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await biddingsApi.getItems(biddingId);
        const biddingItems: BiddingItem[] = res.data?.data ?? res.data ?? [];
        setItems(biddingItems);

        const initial: Record<string, PricingEntry> = {};
        biddingItems.forEach((item) => {
          initial[item.id] = { biddingItemId: item.id, brand: '', finalUnitPrice: '' };
        });
        setPricing(initial);
      } catch {
        Alert.alert('Erro', 'Não foi possível carregar os itens.');
      } finally {
        setLoading(false);
      }
    })();
  }, [biddingId]);

  function updateField(itemId: string, field: 'brand' | 'finalUnitPrice', value: string) {
    setPricing((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], [field]: value },
    }));
  }

  function calcTotal(): number {
    return items.reduce((acc, item) => {
      const entry = pricing[item.id];
      if (!entry?.finalUnitPrice.trim()) return acc;
      const price = parsePriceBRL(entry.finalUnitPrice);
      return acc + price * Number(item.quantity);
    }, 0);
  }

  async function handleSubmit() {
    const filledItems = Object.values(pricing).filter(
      (e) => e.brand.trim() && e.finalUnitPrice.trim() && parsePriceBRL(e.finalUnitPrice) > 0,
    );

    if (filledItems.length === 0) {
      Alert.alert('Atenção', 'Preencha ao menos um item com marca e valor maior que zero.');
      return;
    }

    setSubmitting(true);
    try {
      await participationsApi.updateItems(
        participationId,
        filledItems.map((e) => ({
          biddingItemId: e.biddingItemId,
          brand: e.brand.trim(),
          finalUnitPrice: parsePriceBRL(e.finalUnitPrice),
        })),
      );
      await participationsApi.submit(participationId);
      Alert.alert(
        'Proposta enviada!',
        'Sua proposta consolidada foi enviada à TAED com sucesso.',
        [{ text: 'OK', onPress: () => navigation.navigate('MainTabs') }],
      );
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Não foi possível enviar a proposta.';
      Alert.alert('Erro', msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Carregando itens...</Text>
      </View>
    );
  }

  const total = calcTotal();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.headerCard}>
          <Text style={styles.headerTitle}>Proposta Consolidada</Text>
          <Text style={styles.headerSubtitle}>
            Informe a marca e o valor com lucro para cada item
          </Text>
        </View>

        {items.map((item, idx) => {
          const entry = pricing[item.id];
          const itemTotal =
            entry?.finalUnitPrice.trim()
              ? parsePriceBRL(entry.finalUnitPrice) * Number(item.quantity)
              : null;

          return (
            <View key={item.id} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <View style={styles.itemIndexBadge}>
                  <Text style={styles.itemIndexText}>{idx + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemDesc} numberOfLines={3}>{item.description}</Text>
                  <Text style={styles.itemMeta}>
                    Qtd: {Number(item.quantity)} {item.unit}
                    {item.unitValueEstimated != null
                      ? `  •  Ref: ${formatBRL(item.unitValueEstimated)}`
                      : ''}
                  </Text>
                </View>
              </View>

              <View style={styles.inputRow}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Marca *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ex: Samsung, Philips…"
                    placeholderTextColor={Colors.textMuted}
                    value={entry?.brand ?? ''}
                    onChangeText={(v) => updateField(item.id, 'brand', v)}
                    returnKeyType="next"
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Valor unitário (R$) *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0,00"
                    placeholderTextColor={Colors.textMuted}
                    value={entry?.finalUnitPrice ?? ''}
                    onChangeText={(v) => updateField(item.id, 'finalUnitPrice', v)}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              {itemTotal != null && itemTotal > 0 && (
                <Text style={styles.itemTotal}>
                  Total do item: {formatBRL(itemTotal)}
                </Text>
              )}
            </View>
          );
        })}

        {/* Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Valor total da proposta</Text>
          <Text style={styles.summaryValue}>{formatBRL(total)}</Text>
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.btnSubmit, submitting && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.btnSubmitText}>Enviar Proposta Consolidada</Text>
          )}
        </TouchableOpacity>

        <View style={styles.bottomPad} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background,
  },
  loadingText: { marginTop: 12, color: Colors.textSecondary },
  headerCard: {
    backgroundColor: Colors.primary,
    margin: 16,
    borderRadius: 16,
    padding: 20,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: Colors.white, marginBottom: 4 },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 18 },
  itemCard: {
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  itemHeader: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  itemIndexBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  itemIndexText: { color: Colors.white, fontWeight: '700', fontSize: 14 },
  itemDesc: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary, lineHeight: 18 },
  itemMeta: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  inputRow: { flexDirection: 'row', gap: 10 },
  inputGroup: { flex: 1.2 },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.textPrimary,
    backgroundColor: Colors.background,
  },
  itemTotal: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.success,
    textAlign: 'right',
  },
  summaryCard: {
    backgroundColor: Colors.primary,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: { fontSize: 15, fontWeight: '600', color: 'rgba(255,255,255,0.8)' },
  summaryValue: { fontSize: 22, fontWeight: '900', color: Colors.white },
  btnSubmit: {
    backgroundColor: Colors.success,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
    shadowColor: Colors.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  btnDisabled: { opacity: 0.65 },
  btnSubmitText: { color: Colors.white, fontWeight: '800', fontSize: 16, letterSpacing: 0.5 },
  bottomPad: { height: 40 },
});
