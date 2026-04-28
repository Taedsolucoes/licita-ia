import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { opportunitiesApi, biddingsApi } from '../services/api';
import { Colors } from '../theme/colors';
import type { OpportunityDetailScreenProps } from '../types/navigation';

interface BiddingItem {
  id: string;
  itemNumber: number;
  description: string;
  quantity: number;
  unit: string;
  unitValueEstimated?: number | null;
  totalValueEstimated?: number | null;
}

function formatBRL(value: number | null | undefined) {
  if (value == null) return '—';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function capagColor(rating: string | null | undefined): string {
  switch (rating) {
    case 'A': return Colors.capagA;
    case 'B': return Colors.capagB;
    case 'C': return Colors.capagC;
    default: return Colors.capagND;
  }
}

function capagExplanation(rating: string | null | undefined): string {
  switch (rating) {
    case 'A': return 'Boa saúde financeira - baixo risco de inadimplência';
    case 'B': return 'Saúde financeira mediana - possibilidade de atrasos nos pagamentos';
    case 'C': return 'Saúde financeira ruim - alto risco de atrasos e inadimplência';
    default: return 'Dados não disponíveis - impossível avaliar risco financeiro';
  }
}

export function OpportunityDetailScreen({ route, navigation }: OpportunityDetailScreenProps) {
  const { opportunityId } = route.params;
  const [opportunity, setOpportunity] = useState<Record<string, unknown> | null>(null);
  const [bidding, setBidding] = useState<Record<string, unknown> | null>(null);
  const [items, setItems] = useState<BiddingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const oppRes = await opportunitiesApi.getById(opportunityId);
        const opp = oppRes.data;
        setOpportunity(opp);

        const biddingId = opp.biddingId as string;
        const [biddingRes, itemsRes] = await Promise.all([
          biddingsApi.getById(biddingId),
          biddingsApi.getItems(biddingId),
        ]);
        setBidding(biddingRes.data);
        const biddingItems: BiddingItem[] = itemsRes.data?.data ?? itemsRes.data ?? [];
        setItems(biddingItems);
      } catch {
        Alert.alert('Erro', 'Não foi possível carregar os detalhes.');
      } finally {
        setLoading(false);
      }
    })();
  }, [opportunityId]);

  async function handleParticipate() {
    setActionLoading(true);
    try {
      const { data } = await opportunitiesApi.participate(opportunityId);
      const participationId: string = data.id ?? data.participationId;
      const biddingId = (opportunity?.biddingId as string) ?? '';
      navigation.navigate('Pricing', { participationId, biddingId, opportunityId });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Não foi possível registrar participação.';
      Alert.alert('Erro', msg);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDecline() {
    Alert.alert(
      'Declinar oportunidade',
      'Tem certeza que deseja declinar esta oportunidade?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Declinar',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await opportunitiesApi.decline(opportunityId);
              Alert.alert('Oportunidade declinada', '', [
                { text: 'OK', onPress: () => navigation.goBack() },
              ]);
            } catch {
              Alert.alert('Erro', 'Não foi possível declinar a oportunidade.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Carregando detalhes...</Text>
      </View>
    );
  }

  const b = bidding as Record<string, unknown> | null;
  const opp = opportunity as Record<string, unknown> | null;
  const isDecided = opp?.status === 'accepted' || opp?.status === 'declined';

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header info card */}
      <View style={styles.infoCard}>
        <Text style={styles.agencyName}>{(b?.agencyName as string) ?? '—'}</Text>
        <Text style={styles.biddingNumber}>Pregão nº {(b?.biddingNumber as string) ?? '—'}</Text>
        <Text style={styles.objectText}>{(b?.objectText as string) ?? ''}</Text>
      </View>

      {/* Details grid */}
      <View style={styles.detailsCard}>
        <Text style={styles.sectionTitle}>Informações da Licitação</Text>
        <Detail label="Modalidade" value={b?.modality as string} />
        <Detail label="Esfera" value={b?.sphere as string} />
        <Detail label="Município" value={`${b?.municipalityName ?? '—'}${b?.uf ? ` / ${b.uf}` : ''}`} />
        <Detail label="Abertura" value={formatDate(b?.openingDate as string)} />
        <Detail label="Prazo proposta" value={formatDate(b?.proposalDueDate as string)} />
        <Detail label="Valor estimado" value={formatBRL(b?.estimatedValue as number)} />
        {b?.uasg ? <Detail label="UASG" value={b.uasg as string} /> : null}
      </View>

      {/* SAÚDE FINANCEIRA DO MUNICÍPIO */}
      {opp?.capagRatingSnapshot ? (
        <View style={styles.detailsCard}>
          <Text style={styles.sectionTitle}>Saúde Financeira do Município</Text>
          <View style={styles.capagSection}>
            <View style={[styles.capagRatingBadge, { backgroundColor: capagColor(opp.capagRatingSnapshot as string) }]}>
              <Text style={styles.capagRatingText}>{opp.capagRatingSnapshot as string}</Text>
            </View>
            <View style={styles.capagInfo}>
              <Text style={styles.capagLabel}>CAPAG · Tesouro Nacional</Text>
              <Text style={styles.capagDesc}>{capagExplanation(opp.capagRatingSnapshot as string)}</Text>
            </View>
          </View>
        </View>
      ) : null}

      {/* Items summary */}
      {items.length > 0 && (
        <View style={styles.detailsCard}>
          <Text style={styles.sectionTitle}>Itens ({items.length})</Text>
          {items.slice(0, 3).map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <Text style={styles.itemNumber}>{item.itemNumber}.</Text>
              <Text style={styles.itemDesc} numberOfLines={2}>{item.description}</Text>
              <Text style={styles.itemQty}>{Number(item.quantity)} {item.unit}</Text>
            </View>
          ))}
          {items.length > 3 && (
            <Text style={styles.moreItems}>+ {items.length - 3} itens</Text>
          )}
        </View>
      )}

      {/* Action buttons */}
      {!isDecided && (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.btnDecline, actionLoading && styles.btnDisabled]}
            onPress={handleDecline}
            disabled={actionLoading}
            activeOpacity={0.85}
          >
            <Text style={styles.btnDeclineText}>Declinar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btnParticipate, actionLoading && styles.btnDisabled]}
            onPress={handleParticipate}
            disabled={actionLoading}
            activeOpacity={0.85}
          >
            {actionLoading ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.btnParticipateText}>Participar</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {isDecided && (
        <View style={styles.statusBadge}>
          <Text style={styles.statusBadgeText}>
            {opp?.status === 'accepted' ? 'Você participou desta licitação' : 'Oportunidade declinada'}
          </Text>
        </View>
      )}

      <View style={styles.bottomPad} />
    </ScrollView>
  );
}

function Detail({ label, value }: { label: string; value: string | undefined }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value ?? '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background,
  },
  loadingText: { marginTop: 12, color: Colors.textSecondary },
  infoCard: {
    backgroundColor: Colors.primary,
    margin: 16,
    borderRadius: 16,
    padding: 20,
  },
  agencyName: { fontSize: 18, fontWeight: '800', color: Colors.white, marginBottom: 4 },
  biddingNumber: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 10 },
  objectText: { fontSize: 14, color: 'rgba(255,255,255,0.9)', lineHeight: 20 },
  detailsCard: {
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.background,
  },
  detailLabel: { fontSize: 13, color: Colors.textMuted, fontWeight: '600', flex: 1 },
  detailValue: { fontSize: 13, color: Colors.textPrimary, flex: 1.5, textAlign: 'right' },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8, gap: 6 },
  itemNumber: { fontSize: 13, fontWeight: '700', color: Colors.primary, minWidth: 24 },
  itemDesc: { fontSize: 12, color: Colors.textPrimary, flex: 1 },
  itemQty: { fontSize: 12, color: Colors.textMuted, minWidth: 60, textAlign: 'right' },
  moreItems: { fontSize: 12, color: Colors.textMuted, marginTop: 4, fontStyle: 'italic' },
  actionsRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  btnDecline: {
    flex: 1,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.danger,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnDeclineText: { color: Colors.danger, fontWeight: '700', fontSize: 15 },
  btnParticipate: {
    flex: 2,
    backgroundColor: Colors.success,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: Colors.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  btnParticipateText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
  btnDisabled: { opacity: 0.6 },
  statusBadge: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statusBadgeText: { fontSize: 14, color: Colors.textSecondary, fontWeight: '600' },
  bottomPad: { height: 40 },
  capagSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 4,
  },
  capagRatingBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  capagRatingText: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.white,
  },
  capagInfo: { flex: 1 },
  capagLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  capagDesc: {
    fontSize: 13,
    color: Colors.textPrimary,
    lineHeight: 18,
  },
});
