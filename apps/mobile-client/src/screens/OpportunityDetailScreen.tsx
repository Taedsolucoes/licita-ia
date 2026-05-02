import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { opportunitiesApi, biddingsApi, reportsApi, analysisApi } from '../services/api';
import { Colors } from '../theme/colors';
import type { OpportunityDetailScreenProps } from '../types/navigation';
import { getItem } from '../utils/storage';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BiddingItem {
  id: string;
  itemNumber: number;
  description: string;
  specification?: string;
  quantity: number;
  unit: string;
  unitValueEstimated?: number | null;
  totalValueEstimated?: number | null;
}

interface ImpugnationPoint {
  title?: string;
  laypersonExplanation?: string;
  legalArticle?: string;
  courtDecision?: string;
}

interface Analysis {
  riskLevel?: string;
  recommendation?: string;
  executiveSummary?: string;
  requiresGuarantee?: boolean;
  contractualGuarantee?: {
    required?: boolean;
    percentage?: string;
    type?: string;
    description?: string;
  };
  objectGuarantee?: {
    description?: string;
    period?: string;
  };
  paymentConditions?: {
    deadline?: string;
    form?: string;
    additionalDetails?: string;
  };
  impugnationPoints?: ImpugnationPoint[];
  impugnationEmail?: string;
  impugnationEmailSubject?: string;
}

type ItemAction = 'none' | 'participate' | 'decline';

interface ItemState {
  action: ItemAction;
  brand: string;
  price: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBRL(value: number | null | undefined): string {
  if (value == null) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  });
}

function capagColor(rating: string | null | undefined): string {
  switch (rating) {
    case 'A': return Colors.success;
    case 'B': return Colors.capagB;
    case 'C': return Colors.danger;
    default: return Colors.capagND;
  }
}

function capagExplanation(rating: string | null | undefined): string {
  switch (rating) {
    case 'A': return 'Boa saúde financeira — baixo risco de inadimplência';
    case 'B': return 'Saúde financeira mediana — possibilidade de atrasos nos pagamentos';
    case 'C': return 'Saúde financeira ruim — alto risco de atrasos e inadimplência';
    default: return 'Dados não disponíveis — impossível avaliar risco financeiro';
  }
}

function riskColor(level: string | null | undefined): string {
  switch (level) {
    case 'Baixo': return Colors.success;
    case 'Médio': return Colors.capagB;
    case 'Alto': return Colors.danger;
    default: return Colors.capagND;
  }
}

const DOCUMENT_KEYWORDS = ['anvisa', 'registro', 'certificado', 'licença sanitária', 'inmetro', 'habilitação técnica'];

function itemNeedsDocument(desc: string): boolean {
  const lower = (desc ?? '').toLowerCase();
  return DOCUMENT_KEYWORDS.some((kw) => lower.includes(kw));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function HeaderBadge({ text }: { text: string }) {
  return (
    <View style={styles.headerBadge}>
      <Text style={styles.headerBadgeText}>{text}</Text>
    </View>
  );
}

function InfoCard({
  icon,
  title,
  value,
  valueColor,
  badgeCount,
}: {
  icon: string;
  title: string;
  value: string;
  valueColor?: string;
  badgeCount?: number;
}) {
  return (
    <View style={styles.infoCard}>
      <Text style={styles.infoCardIcon}>{icon}</Text>
      <Text style={styles.infoCardTitle}>{title}</Text>
      <View style={styles.infoCardValueRow}>
        <Text
          style={[styles.infoCardValue, valueColor ? { color: valueColor } : {}]}
          numberOfLines={2}
        >
          {value}
        </Text>
        {badgeCount != null && badgeCount > 0 ? (
          <View style={styles.redBadge}>
            <Text style={styles.redBadgeText}>{badgeCount}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function OpportunityDetailScreen({ route, navigation }: OpportunityDetailScreenProps) {
  const { opportunityId } = route.params;

  const [opportunity, setOpportunity] = useState<Record<string, unknown> | null>(null);
  const [bidding, setBidding] = useState<Record<string, unknown> | null>(null);
  const [items, setItems] = useState<BiddingItem[]>([]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  const [itemStates, setItemStates] = useState<Record<string, ItemState>>({});

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

        try {
          const analysisRes = await analysisApi.getByBidding(biddingId);
          setAnalysis(analysisRes.data);
        } catch {
          setAnalysis(null);
        }
      } catch {
        Alert.alert('Erro', 'Não foi possível carregar os detalhes.');
      } finally {
        setLoading(false);
      }
    })();
  }, [opportunityId]);

  function setItemAction(itemId: string, action: ItemAction) {
    setItemStates((prev) => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] ?? { brand: '', price: '' }),
        action,
      },
    }));
  }

  function setItemField(itemId: string, field: 'brand' | 'price', value: string) {
    setItemStates((prev) => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] ?? { action: 'none', brand: '', price: '' }),
        [field]: value,
      },
    }));
  }

  async function handleDownloadReport() {
    setReportLoading(true);
    try {
      const { data } = await reportsApi.getByOpportunity(opportunityId);
      const reportId: string = data.id ?? data.reportId;
      const url = reportsApi.getDownloadUrl(reportId);
      const token = await getItem('accessToken');

      if (Platform.OS === 'web') {
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token ?? ''}` },
        });
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = `relatorio-${reportId}.pdf`;
        anchor.click();
        URL.revokeObjectURL(objectUrl);
      } else {
        // Native: use api.get (auth header via interceptor), fallback to Linking with token param
        try {
          await reportsApi.download(reportId);
          Alert.alert('Relatório', 'Download concluído com sucesso.');
        } catch {
          // Fallback: append token as query param so Linking carries auth
          const authenticatedUrl = token ? `${url}?token=${token}` : url;
          const canOpen = await Linking.canOpenURL(authenticatedUrl);
          if (canOpen) {
            await Linking.openURL(authenticatedUrl);
          } else {
            Alert.alert('Erro', 'Não foi possível abrir o relatório.');
          }
        }
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Relatório ainda não disponível para esta oportunidade.';
      Alert.alert('Relatório indisponível', msg);
    } finally {
      setReportLoading(false);
    }
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
  const biddingId = (opp?.biddingId as string) ?? '';
  const impPoints = analysis?.impugnationPoints ?? [];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      {/* ── SEÇÃO 1: HEADER ────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle} numberOfLines={4}>
          {(b?.agencyName as string) ?? (b?.objectText as string) ?? '—'}
        </Text>
        <Text style={styles.headerSubtitle}>
          Pregão nº {(b?.biddingNumber as string) ?? '—'}
        </Text>
        <View style={styles.headerBadges}>
          {b?.modality ? <HeaderBadge text={b.modality as string} /> : null}
          {b?.sphere ? <HeaderBadge text={b.sphere as string} /> : null}
          {b?.uasg ? <HeaderBadge text={`UASG ${b.uasg as string}`} /> : null}
        </View>
      </View>

      {/* ── SEÇÃO 2: GRID 2×2 ───────────────────────────────────────────── */}
      <View style={styles.grid}>
        <View style={styles.gridRow}>
          <InfoCard
            icon="🏛️"
            title="Órgão"
            value={(b?.agencyName as string) ?? '—'}
          />
          <InfoCard
            icon="📅"
            title="Vigência"
            value={
              (b?.openingDate || b?.proposalDueDate)
                ? `${formatDate(b?.openingDate as string)}\n${formatDate(b?.proposalDueDate as string)}`
                : 'Consultar edital'
            }
          />
        </View>
        <View style={styles.gridRow}>
          <InfoCard
            icon="🔒"
            title="Garantia"
            value={
              analysis
                ? analysis.requiresGuarantee
                  ? 'Exige garantia'
                  : 'Não exigida'
                : 'Não exigida'
            }
            valueColor={
              analysis?.requiresGuarantee ? Colors.danger : Colors.success
            }
          />
          <InfoCard
            icon="⚠️"
            title="Impugnação"
            value={impPoints.length > 0 ? `${impPoints.length} pontos` : 'Nenhum ponto'}
            valueColor={impPoints.length > 0 ? Colors.danger : Colors.success}
            badgeCount={impPoints.length > 0 ? impPoints.length : undefined}
          />
        </View>
      </View>

      {/* ── SEÇÃO 3: CAPAG ──────────────────────────────────────────────── */}
      {opp?.capagRatingSnapshot ? (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardIcon}>🏦</Text>
            <Text style={styles.cardTitle}>Saúde Financeira do Município</Text>
          </View>
          <View style={styles.capagRow}>
            <View
              style={[
                styles.capagBadge,
                { backgroundColor: capagColor(opp.capagRatingSnapshot as string) },
              ]}
            >
              <Text style={styles.capagBadgeText}>
                {opp.capagRatingSnapshot as string}
              </Text>
            </View>
            <View style={styles.capagInfo}>
              <Text style={styles.capagLabel}>CAPAG · Tesouro Nacional</Text>
              <Text style={styles.capagDesc}>
                {capagExplanation(opp.capagRatingSnapshot as string)}
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      {/* ── SEÇÃO 4: VALOR TOTAL ESTIMADO ───────────────────────────────── */}
      {b?.estimatedValue != null ? (
        <View style={styles.valueCard}>
          <Text style={styles.valueCardLabel}>💰 Valor Total Estimado</Text>
          <Text style={styles.valueCardAmount}>
            {formatBRL(b.estimatedValue as number)}
          </Text>
        </View>
      ) : null}

      {/* ── SEÇÃO 5: RISCO E RECOMENDAÇÃO ───────────────────────────────── */}
      {analysis?.riskLevel ? (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardIcon}>📊</Text>
            <Text style={styles.cardTitle}>Risco e Recomendação</Text>
          </View>
          <View style={styles.riskRow}>
            <View
              style={[
                styles.riskBadge,
                { backgroundColor: riskColor(analysis.riskLevel) },
              ]}
            >
              <Text style={styles.riskBadgeText}>{analysis.riskLevel}</Text>
            </View>
            <Text style={styles.recommendationText}>
              {analysis.recommendation ?? '—'}
            </Text>
          </View>
        </View>
      ) : null}

      {/* ── SEÇÃO 6: RESUMO EXECUTIVO ────────────────────────────────────── */}
      {analysis?.executiveSummary ? (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardIcon}>📋</Text>
            <Text style={styles.cardTitle}>Resumo Executivo</Text>
          </View>
          <Text style={styles.bodyText}>{analysis.executiveSummary}</Text>
        </View>
      ) : null}

      {/* ── SEÇÃO 7: GARANTIAS (2 cards) ────────────────────────────────── */}
      {(analysis?.contractualGuarantee != null || analysis?.objectGuarantee != null) ? (
        <View style={styles.twoColRow}>
          <View style={[styles.card, styles.halfCard]}>
            <Text style={styles.cardIcon}>🔐</Text>
            <Text style={[styles.cardTitle, { marginTop: 4, marginBottom: 6 }]}>
              Garantia Contratual
            </Text>
            <Text style={styles.bodyText}>
              {analysis?.contractualGuarantee?.description ??
                (analysis?.contractualGuarantee?.required
                  ? `${analysis.contractualGuarantee.percentage ?? ''} ${analysis.contractualGuarantee.type ?? ''}`.trim() || 'Exigida'
                  : 'Não exigida')}
            </Text>
          </View>
          <View style={[styles.card, styles.halfCard]}>
            <Text style={styles.cardIcon}>📦</Text>
            <Text style={[styles.cardTitle, { marginTop: 4, marginBottom: 6 }]}>
              Garantia do Objeto
            </Text>
            <Text style={styles.bodyText}>
              {analysis?.objectGuarantee?.description ?? 'Não exigida'}
              {analysis?.objectGuarantee?.period
                ? `\n${analysis.objectGuarantee.period}`
                : ''}
            </Text>
          </View>
        </View>
      ) : null}

      {/* ── SEÇÃO 8: OBJETO DA LICITAÇÃO ─────────────────────────────────── */}
      {b?.objectText ? (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardIcon}>📄</Text>
            <Text style={styles.cardTitle}>Objeto da Licitação</Text>
          </View>
          <Text style={styles.bodyText}>{b.objectText as string}</Text>
        </View>
      ) : null}

      {/* ── SEÇÃO 9: CONDIÇÕES DE PAGAMENTO ──────────────────────────────── */}
      {analysis?.paymentConditions ? (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardIcon}>💳</Text>
            <Text style={styles.cardTitle}>Condições de Pagamento</Text>
          </View>
          {analysis.paymentConditions.deadline ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Prazo</Text>
              <Text style={styles.detailValue}>
                {analysis.paymentConditions.deadline}
              </Text>
            </View>
          ) : null}
          {analysis.paymentConditions.form ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Forma</Text>
              <Text style={styles.detailValue}>
                {analysis.paymentConditions.form}
              </Text>
            </View>
          ) : null}
          {analysis.paymentConditions.additionalDetails ? (
            <Text style={[styles.bodyText, { marginTop: 8 }]}>
              {analysis.paymentConditions.additionalDetails}
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* ── SEÇÃO 10: CARD IMPUGNAÇÃO ─────────────────────────────────────── */}
      {impPoints.length > 0 ? (
        <TouchableOpacity
          style={styles.impugnationCard}
          onPress={() =>
            navigation.navigate('Impugnation', { biddingId, opportunityId })
          }
          activeOpacity={0.85}
        >
          <View style={styles.impugnationCardHeader}>
            <Text style={styles.impugnationCardIcon}>⚠️</Text>
            <Text style={styles.impugnationCardTitle}>Pontos de Impugnação</Text>
            <View style={styles.impugnationCountBadge}>
              <Text style={styles.impugnationCountText}>{impPoints.length}</Text>
            </View>
          </View>
          <Text style={styles.impugnationCardDesc}>
            {impPoints.length === 1
              ? 'Identificamos 1 ponto passível de impugnação no edital.'
              : `Identificamos ${impPoints.length} pontos passíveis de impugnação no edital.`}
          </Text>
          <Text style={styles.impugnationCardCta}>Ver detalhes e minutas →</Text>
        </TouchableOpacity>
      ) : null}

      {/* ── SEÇÃO 11: LISTA DE ITENS ──────────────────────────────────────── */}
      {items.length > 0 ? (
        <View style={styles.itemsSection}>
          <View style={styles.itemsSectionHeader}>
            <Text style={styles.itemsSectionIcon}>🗂️</Text>
            <Text style={styles.itemsSectionTitle}>
              Itens da Licitação ({items.length})
            </Text>
          </View>
          {items.map((item) => {
            const st: ItemState = itemStates[item.id] ?? {
              action: 'none',
              brand: '',
              price: '',
            };
            const needsDoc = itemNeedsDocument(item.description);
            return (
              <View
                key={item.id}
                style={[
                  styles.itemCard,
                  st.action === 'participate' && styles.itemCardParticipate,
                  st.action === 'decline' && styles.itemCardDecline,
                ]}
              >
                {/* Item header */}
                <View style={styles.itemHeader}>
                  <View style={styles.itemNumberBadge}>
                    <Text style={styles.itemNumberText}>{item.itemNumber}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemDesc}>{item.description}</Text>
                    {item.specification ? (
                      <Text style={styles.itemSpec}>{item.specification}</Text>
                    ) : null}
                  </View>
                </View>

                {/* Item meta row */}
                <View style={styles.itemMetaRow}>
                  <Text style={styles.itemMetaText}>
                    Qtd: {Number(item.quantity)} {item.unit}
                  </Text>
                  {item.unitValueEstimated != null ? (
                    <Text style={styles.itemMetaText}>
                      Unit: {formatBRL(item.unitValueEstimated)}
                    </Text>
                  ) : null}
                  {item.totalValueEstimated != null ? (
                    <Text style={styles.itemMetaText}>
                      Total: {formatBRL(item.totalValueEstimated)}
                    </Text>
                  ) : null}
                </View>

                {/* Document alert */}
                {needsDoc ? (
                  <View style={styles.docAlert}>
                    <Text style={styles.docAlertText}>
                      ⚠️ Este item pode exigir documentação especial (ex: Anvisa, Inmetro)
                    </Text>
                  </View>
                ) : null}

                {/* Action buttons */}
                <View style={styles.itemActions}>
                  <TouchableOpacity
                    style={[
                      styles.itemBtnParticipate,
                      st.action === 'participate' && styles.itemBtnParticipateActive,
                    ]}
                    onPress={() =>
                      setItemAction(
                        item.id,
                        st.action === 'participate' ? 'none' : 'participate',
                      )
                    }
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.itemBtnParticipateText,
                        st.action === 'participate' && { color: Colors.white },
                      ]}
                    >
                      {st.action === 'participate' ? '✓ Participando' : 'Participar'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.itemBtnDecline,
                      st.action === 'decline' && styles.itemBtnDeclineActive,
                    ]}
                    onPress={() =>
                      setItemAction(
                        item.id,
                        st.action === 'decline' ? 'none' : 'decline',
                      )
                    }
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.itemBtnDeclineText,
                        st.action === 'decline' && { color: Colors.white },
                      ]}
                    >
                      {st.action === 'decline' ? '✗ Declinado' : 'Declinar'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Expanded inputs when participating */}
                {st.action === 'participate' ? (
                  <View style={styles.participateInputs}>
                    <TextInput
                      style={styles.participateInput}
                      placeholder="Marca / Fabricante"
                      placeholderTextColor={Colors.textMuted}
                      value={st.brand}
                      onChangeText={(v) => setItemField(item.id, 'brand', v)}
                    />
                    <TextInput
                      style={styles.participateInput}
                      placeholder="Valor com Lucro (R$)"
                      placeholderTextColor={Colors.textMuted}
                      keyboardType="numeric"
                      value={st.price}
                      onChangeText={(v) => setItemField(item.id, 'price', v)}
                    />
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}

      {/* ── SEÇÃO 12: BOTÃO BAIXAR RELATÓRIO ────────────────────────────── */}
      <TouchableOpacity
        style={[styles.btnReport, reportLoading && styles.btnDisabled]}
        onPress={handleDownloadReport}
        disabled={reportLoading}
        activeOpacity={0.85}
      >
        {reportLoading ? (
          <ActivityIndicator color={Colors.white} />
        ) : (
          <Text style={styles.btnReportText}>📄  Baixar Relatório de Análise</Text>
        )}
      </TouchableOpacity>

      <View style={styles.bottomPad} />
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.screenBackground,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.screenBackground,
  },
  loadingText: {
    marginTop: 12,
    color: Colors.textSecondary,
    fontSize: 14,
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: Colors.white,
    lineHeight: 26,
    marginBottom: 6,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 14,
    fontWeight: '500',
  },
  headerBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  headerBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  headerBadgeText: {
    fontSize: 11,
    color: Colors.white,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  // ── Grid 2×2 ──────────────────────────────────────────────────────────────
  grid: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
    gap: 8,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  infoCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoCardIcon: {
    fontSize: 22,
    marginBottom: 6,
  },
  infoCardTitle: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  infoCardValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoCardValue: {
    fontSize: 13,
    color: Colors.textPrimary,
    fontWeight: '700',
    flex: 1,
  },
  redBadge: {
    backgroundColor: Colors.danger,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  redBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.white,
  },

  // ── Common Card ───────────────────────────────────────────────────────────
  card: {
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  cardIcon: {
    fontSize: 20,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    flex: 1,
  },
  bodyText: {
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 21,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: Colors.screenBackground,
  },
  detailLabel: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '600',
    flex: 1,
  },
  detailValue: {
    fontSize: 13,
    color: Colors.textPrimary,
    flex: 1.5,
    textAlign: 'right',
  },

  // ── CAPAG ─────────────────────────────────────────────────────────────────
  capagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 4,
  },
  capagBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  capagBadgeText: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.white,
  },
  capagInfo: {
    flex: 1,
  },
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

  // ── Value Card ────────────────────────────────────────────────────────────
  valueCard: {
    backgroundColor: Colors.successBg,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#B7E4C7',
  },
  valueCardLabel: {
    fontSize: 13,
    color: Colors.success,
    fontWeight: '600',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  valueCardAmount: {
    fontSize: 30,
    fontWeight: '900',
    color: Colors.success,
    letterSpacing: -0.5,
  },

  // ── Risk ──────────────────────────────────────────────────────────────────
  riskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  riskBadge: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
  },
  riskBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.white,
  },
  recommendationText: {
    fontSize: 15,
    color: Colors.textPrimary,
    fontWeight: '600',
    flex: 1,
  },

  // ── Two column ────────────────────────────────────────────────────────────
  twoColRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    gap: 10,
  },
  halfCard: {
    flex: 1,
    marginHorizontal: 0,
    marginBottom: 0,
  },

  // ── Impugnation alert card ────────────────────────────────────────────────
  impugnationCard: {
    backgroundColor: Colors.warningBg,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1.5,
    borderColor: Colors.orange,
  },
  impugnationCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  impugnationCardIcon: {
    fontSize: 20,
  },
  impugnationCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#92400E',
    flex: 1,
  },
  impugnationCountBadge: {
    backgroundColor: Colors.danger,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  impugnationCountText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.white,
  },
  impugnationCardDesc: {
    fontSize: 13,
    color: '#78350F',
    lineHeight: 19,
    marginBottom: 8,
  },
  impugnationCardCta: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.orange,
  },

  // ── Items Section ─────────────────────────────────────────────────────────
  itemsSection: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  itemsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  itemsSectionIcon: {
    fontSize: 20,
  },
  itemsSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  itemCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  itemCardParticipate: {
    borderColor: Colors.success,
    borderWidth: 1.5,
  },
  itemCardDecline: {
    borderColor: Colors.danger,
    borderWidth: 1.5,
    opacity: 0.75,
  },
  itemHeader: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  itemNumberBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  itemNumberText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.white,
  },
  itemDesc: {
    fontSize: 13,
    color: Colors.textPrimary,
    lineHeight: 18,
    fontWeight: '500',
  },
  itemSpec: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 3,
    lineHeight: 16,
  },
  itemMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 10,
  },
  itemMetaText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  docAlert: {
    backgroundColor: '#FFFBEB',
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  docAlertText: {
    fontSize: 12,
    color: '#92400E',
    lineHeight: 17,
  },
  itemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  itemBtnParticipate: {
    flex: 1,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.success,
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
  },
  itemBtnParticipateActive: {
    backgroundColor: Colors.success,
  },
  itemBtnParticipateText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.success,
  },
  itemBtnDecline: {
    flex: 1,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.danger,
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
  },
  itemBtnDeclineActive: {
    backgroundColor: Colors.danger,
  },
  itemBtnDeclineText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.danger,
  },
  participateInputs: {
    marginTop: 10,
    gap: 8,
  },
  participateInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: Colors.textPrimary,
    backgroundColor: Colors.white,
  },

  // ── Download Report Button ────────────────────────────────────────────────
  btnReport: {
    backgroundColor: Colors.primary,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  btnReportText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.3,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  bottomPad: {
    height: 48,
  },
});
