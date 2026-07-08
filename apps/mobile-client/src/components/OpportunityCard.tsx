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
  onPress: (id: string) => void;
}

function formatBRL(value: number | null | undefined): string {
  if (value == null || value === 0) return 'Não informado';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  }) + ' às ' + d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
}

function getRiskLevel(capagRating: string | null | undefined): { label: string; color: string; bgColor: string } {
  switch (capagRating) {
    case 'A':
      return { label: 'Baixo', color: '#2D9B51', bgColor: '#E8F5E9' };
    case 'B':
      return { label: 'Médio', color: '#F5A623', bgColor: '#FFF3E0' };
    case 'C':
      return { label: 'Alto', color: '#DC3545', bgColor: '#FFEBEE' };
    default:
      return { label: 'N/A', color: '#94A3B8', bgColor: '#F1F5F9' };
  }
}

function truncateText(text: string | null | undefined, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
}

export function OpportunityCard({ opportunity, onPress }: Props) {
  const { bidding } = opportunity;
  const risk = getRiskLevel(opportunity.capagRatingSnapshot);
  const isAnalysisComplete = !!opportunity.analysisCompletedAt;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(opportunity.id)}
      activeOpacity={0.95}
    >
      {/* Header: Órgão e Badge de Risco */}
      <View style={styles.headerRow}>
        <Text style={styles.agencyName} numberOfLines={1}>
          {bidding?.agencyName ?? 'Órgão não informado'}
        </Text>
        <View style={[styles.riskBadge, { backgroundColor: risk.bgColor }]}>
          <View style={[styles.riskDot, { backgroundColor: risk.color }]} />
          <Text style={[styles.riskText, { color: risk.color }]}>
            Risco: {risk.label}
          </Text>
        </View>
      </View>

      {/* Objeto - Texto principal truncado */}
      <Text style={styles.objectText} numberOfLines={2}>
        {truncateText(bidding?.objectText, 120)}
      </Text>

      {/* Info Grid: Data e Local */}
      <View style={styles.infoGrid}>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>📅 Data de Abertura</Text>
          <Text style={styles.infoValue}>
            {formatDateTime(bidding?.openingDate ?? bidding?.proposalDueDate)}
          </Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>📍 Local de Entrega</Text>
          <Text style={styles.infoValue} numberOfLines={1}>
            {bidding?.municipalityName && bidding?.uf
              ? `${bidding.municipalityName} / ${bidding.uf}`
              : bidding?.municipalityName || bidding?.uf || 'Não informado'}
          </Text>
        </View>
      </View>

      {/* Valor Estimado */}
      <View style={styles.valueContainer}>
        <Text style={styles.valueLabel}>💰 Valor Estimado</Text>
        <Text style={styles.valueAmount}>
          {formatBRL(bidding?.estimatedValue)}
        </Text>
      </View>

      {/* Footer: Status e Botão Participar */}
      <View style={styles.footer}>
        {isAnalysisComplete && (
          <View style={styles.analysisBadge}>
            <Text style={styles.analysisBadgeText}>✓ Análise Completa</Text>
          </View>
        )}
        <TouchableOpacity
          style={styles.detailButton}
          onPress={() => onPress(opportunity.id)}
          activeOpacity={0.9}
        >
          <Text style={styles.detailButtonText}>VER DETALHES</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.8)',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  agencyName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: -0.3,
  },
  riskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 6,
  },
  riskDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  riskText: {
    fontSize: 12,
    fontWeight: '700',
  },
  objectText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  infoGrid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  infoItem: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  valueContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  valueLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  valueAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.success,
    letterSpacing: -0.5,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  analysisBadge: {
    backgroundColor: 'rgba(45, 155, 81, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  analysisBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.success,
  },
  detailButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  detailButtonText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.5,
  },
});
