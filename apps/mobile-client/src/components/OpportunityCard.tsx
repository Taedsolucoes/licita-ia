import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../theme/colors';

interface OpportunityItem {
  id: string;
  description: string;
}

interface Bidding {
  agencyName: string;
  objectText: string;
  proposalDueDate?: string | null;
  openingDate?: string | null;
  estimatedValue?: number | null;
  municipalityName?: string | null;
  uf?: string | null;
  items?: OpportunityItem[];
}

export interface OpportunityCardData {
  id: string;
  status: string;
  analysisCompletedAt?: string | null;
  capagRatingSnapshot?: string | null;
  bidding?: Bidding;
}

interface Props {
  opportunity: OpportunityCardData;
  onParticipate: (id: string) => void;
  onDecline: (id: string) => void;
  onPress: (id: string) => void;
}

function formatBRL(value: number | null | undefined) {
  if (value == null) return 'Não informado';
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function capagColor(rating: string | null | undefined) {
  switch (rating) {
    case 'A': return Colors.capagA;
    case 'B': return Colors.capagB;
    case 'C': return Colors.capagC;
    default: return Colors.capagND;
  }
}

function capagShortLabel(rating: string | null | undefined): string {
  switch (rating) {
    case 'A': return 'Boa saúde financeira';
    case 'B': return 'Saúde financeira mediana';
    case 'C': return 'Saúde financeira ruim';
    default: return 'Dados não disponíveis';
  }
}

export function OpportunityCard({ opportunity, onParticipate, onDecline, onPress }: Props) {
  const { bidding } = opportunity;
  const isAnalysisComplete = !!opportunity.analysisCompletedAt;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(opportunity.id)}
      activeOpacity={0.9}
    >
      {/* Header row */}
      <View style={styles.headerRow}>
        {isAnalysisComplete && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Análise Completa</Text>
          </View>
        )}
        {opportunity.capagRatingSnapshot ? (
          <View style={[styles.capagBadge, { backgroundColor: capagColor(opportunity.capagRatingSnapshot) }]}>
            <Text style={styles.capagText}>CAPAG {opportunity.capagRatingSnapshot}</Text>
          </View>
        ) : null}
      </View>

      {opportunity.capagRatingSnapshot ? (
        <Text style={styles.capagExplanation}>
          {capagShortLabel(opportunity.capagRatingSnapshot)}
        </Text>
      ) : null}

      {/* Agency name */}
      <Text style={styles.agencyName} numberOfLines={1}>
        {bidding?.agencyName ?? 'Órgão não informado'}
      </Text>

      {/* Object */}
      <Text style={styles.objectText} numberOfLines={2}>
        {bidding?.objectText ?? ''}
      </Text>

      {/* Meta info */}
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Abertura: </Text>
        <Text style={styles.metaValue}>
          {formatDate(bidding?.openingDate ?? bidding?.proposalDueDate)}
        </Text>
      </View>

      {bidding?.municipalityName ? (
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Local: </Text>
          <Text style={styles.metaValue}>
            {bidding.municipalityName}{bidding.uf ? ` / ${bidding.uf}` : ''}
          </Text>
        </View>
      ) : null}

      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Valor estimado: </Text>
        <Text style={[styles.metaValue, styles.valueText]}>
          {formatBRL(bidding?.estimatedValue)}
        </Text>
      </View>

      {/* Action buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.btnParticipate}
          onPress={() => onParticipate(opportunity.id)}
          activeOpacity={0.85}
        >
          <Text style={styles.btnParticipateText}>Participar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.btnDecline}
          onPress={() => onDecline(opportunity.id)}
          activeOpacity={0.85}
        >
          <Text style={styles.btnDeclineText}>Declinar</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
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
  headerRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  badge: {
    backgroundColor: Colors.success,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  capagBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  capagText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  capagExplanation: {
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  agencyName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 4,
  },
  objectText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  metaLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  metaValue: {
    fontSize: 12,
    color: Colors.textSecondary,
    flex: 1,
  },
  valueText: {
    color: Colors.primary,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  btnParticipate: {
    flex: 1,
    backgroundColor: Colors.success,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnParticipateText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 14,
  },
  btnDecline: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.danger,
  },
  btnDeclineText: {
    color: Colors.danger,
    fontWeight: '700',
    fontSize: 14,
  },
});
