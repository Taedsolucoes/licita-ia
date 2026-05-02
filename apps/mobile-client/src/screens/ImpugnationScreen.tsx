import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { analysisApi } from '../services/api';
import { Colors } from '../theme/colors';
import type { ImpugnationScreenProps } from '../types/navigation';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ImpugnationPoint {
  title?: string;
  laypersonExplanation?: string;
  legalArticle?: string;
  courtDecision?: string;
}

interface AnalysisData {
  impugnationPoints?: ImpugnationPoint[];
  impugnationEmail?: string;
  impugnationEmailSubject?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ImpugnationScreen({ route }: ImpugnationScreenProps) {
  const { biddingId } = route.params;

  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await analysisApi.getByBidding(biddingId);
        setAnalysis(res.data);
      } catch {
        Alert.alert('Erro', 'Não foi possível carregar os pontos de impugnação.');
      } finally {
        setLoading(false);
      }
    })();
  }, [biddingId]);

  async function handleDownloadPdf() {
    setPdfLoading(true);
    try {
      Alert.alert(
        'PDF de Impugnação',
        'Funcionalidade de geração de PDF em desenvolvimento.',
      );
    } finally {
      setPdfLoading(false);
    }
  }

  function handleOpenEmail() {
    if (!analysis?.impugnationEmail) return;
    const subject = encodeURIComponent(analysis.impugnationEmailSubject ?? '');
    Linking.openURL(`mailto:${analysis.impugnationEmail}?subject=${subject}`).catch(() => {
      Alert.alert('Erro', 'Não foi possível abrir o aplicativo de e-mail.');
    });
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Carregando análise...</Text>
      </View>
    );
  }

  const points = analysis?.impugnationPoints ?? [];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>⚖️ Pontos de Impugnação</Text>
        <Text style={styles.headerSubtitle}>
          {points.length === 0
            ? 'Nenhum ponto identificado'
            : `${points.length} ponto(s) identificado(s) no edital`}
        </Text>
      </View>

      {/* Empty state */}
      {points.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>✅</Text>
          <Text style={styles.emptyTitle}>Edital sem pontos de impugnação</Text>
          <Text style={styles.emptyDesc}>
            A análise não identificou cláusulas passíveis de impugnação neste edital.
          </Text>
        </View>
      ) : null}

      {/* Impugnation point cards */}
      {points.map((point, idx) => (
        <View key={idx} style={styles.pointCard}>
          <View style={styles.pointCardHeader}>
            <View style={styles.pointNumber}>
              <Text style={styles.pointNumberText}>{idx + 1}</Text>
            </View>
            <Text style={styles.pointTitle} numberOfLines={3}>
              {point.title ?? `Ponto de Impugnação ${idx + 1}`}
            </Text>
          </View>

          {point.laypersonExplanation ? (
            <View style={styles.pointSection}>
              <Text style={styles.pointSectionLabel}>Em linguagem simples</Text>
              <Text style={styles.pointSectionText}>
                {point.laypersonExplanation}
              </Text>
            </View>
          ) : null}

          {point.legalArticle ? (
            <View style={[styles.pointSection, styles.legalSection]}>
              <Text style={styles.legalSectionLabel}>⚖️ Base Legal</Text>
              <Text style={styles.legalSectionText}>{point.legalArticle}</Text>
            </View>
          ) : null}

          {point.courtDecision ? (
            <View style={[styles.pointSection, styles.courtSection]}>
              <Text style={styles.courtSectionLabel}>🏛️ Acórdão / Jurisprudência</Text>
              <Text style={styles.courtSectionText}>{point.courtDecision}</Text>
            </View>
          ) : null}
        </View>
      ))}

      {/* Email card */}
      {analysis?.impugnationEmail ? (
        <View style={styles.emailCard}>
          <Text style={styles.emailCardTitle}>📧 Envio da Impugnação</Text>
          <View style={styles.emailRow}>
            <Text style={styles.emailLabel}>Para:</Text>
            <Text style={styles.emailValue} numberOfLines={2}>
              {analysis.impugnationEmail}
            </Text>
          </View>
          {analysis.impugnationEmailSubject ? (
            <View style={styles.emailRow}>
              <Text style={styles.emailLabel}>Assunto:</Text>
              <Text style={styles.emailValue} numberOfLines={2}>
                {analysis.impugnationEmailSubject}
              </Text>
            </View>
          ) : null}
          <TouchableOpacity
            style={styles.emailBtn}
            onPress={handleOpenEmail}
            activeOpacity={0.85}
          >
            <Text style={styles.emailBtnText}>Abrir no E-mail</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Digital certificate warning */}
      <View style={styles.certAlert}>
        <Text style={styles.certAlertIcon}>🔐</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.certAlertTitle}>Certificado Digital Necessário</Text>
          <Text style={styles.certAlertText}>
            Para protocolizar a impugnação no portal COMPRASNET, é necessário
            certificado digital (e-CPF ou e-CNPJ) válido tipo A1 ou A3.
          </Text>
        </View>
      </View>

      {/* Download PDF button */}
      <TouchableOpacity
        style={[styles.btnDownload, pdfLoading && styles.btnDisabled]}
        onPress={handleDownloadPdf}
        disabled={pdfLoading}
        activeOpacity={0.85}
      >
        {pdfLoading ? (
          <ActivityIndicator color={Colors.white} />
        ) : (
          <Text style={styles.btnDownloadText}>📥  Baixar PDF de Impugnação</Text>
        )}
      </TouchableOpacity>

      <View style={{ height: 48 }} />
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
    fontSize: 20,
    fontWeight: '800',
    color: Colors.white,
    marginBottom: 6,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '500',
  },

  // ── Empty State ───────────────────────────────────────────────────────────
  emptyCard: {
    backgroundColor: Colors.white,
    margin: 16,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  // ── Point Card ────────────────────────────────────────────────────────────
  pointCard: {
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pointCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  pointNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  pointNumberText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.white,
  },
  pointTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    flex: 1,
    lineHeight: 20,
  },
  pointSection: {
    marginBottom: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.screenBackground,
  },
  pointSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  pointSectionText: {
    fontSize: 13,
    color: Colors.textPrimary,
    lineHeight: 19,
  },
  legalSection: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    padding: 10,
    borderTopWidth: 0,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  legalSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  legalSectionText: {
    fontSize: 13,
    color: '#1E3A8A',
    lineHeight: 19,
  },
  courtSection: {
    backgroundColor: '#F5F3FF',
    borderRadius: 8,
    padding: 10,
    borderTopWidth: 0,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  courtSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#5B21B6',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  courtSectionText: {
    fontSize: 13,
    color: '#3B0764',
    lineHeight: 19,
  },

  // ── Email Card ────────────────────────────────────────────────────────────
  emailCard: {
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emailCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  emailRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.screenBackground,
    gap: 8,
  },
  emailLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMuted,
    width: 60,
  },
  emailValue: {
    fontSize: 13,
    color: Colors.textPrimary,
    flex: 1,
    lineHeight: 18,
  },
  emailBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  emailBtnText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 14,
  },

  // ── Certificate Alert ─────────────────────────────────────────────────────
  certAlert: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFBEB',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  certAlertIcon: {
    fontSize: 22,
    flexShrink: 0,
  },
  certAlertTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 4,
  },
  certAlertText: {
    fontSize: 13,
    color: '#78350F',
    lineHeight: 18,
  },

  // ── Download Button ───────────────────────────────────────────────────────
  btnDownload: {
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
  btnDownloadText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.3,
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
