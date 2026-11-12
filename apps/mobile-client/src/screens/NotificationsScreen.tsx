import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NotificationsScreenProps } from '../types/navigation';
import { notificationsApi } from '../services/api';
import { Colors } from '../theme/colors';

interface NotificationItem {
  id: string;
  templateCode: string;
  status: string;
  channel: string;
  opportunityId?: string | null;
  payload?: Record<string, unknown> | null;
  opportunity?: { id?: string; matchingScore?: number | string; bidding?: { source?: string; agencyName?: string; objectSummary?: string | null; municipalityName?: string; uf?: string; estimatedValue?: number | string | null } | null } | null;
  sentAt?: string | null;
  createdAt: string;
}
interface Props { onOpenOpportunity?: (id: string) => void }

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
function channelLabel(channel: string) {
  const map: Record<string, string> = { in_app: 'No aplicativo', push: 'Push', whatsapp: 'WhatsApp', email: 'E-mail' };
  return map[channel] ?? channel;
}
function statusColor(status: string) {
  const map: Record<string, string> = {
    read: Colors.success,
    delivered: Colors.primary,
    sent: Colors.primary,
    failed: Colors.danger,
    queued: Colors.textMuted,
  };
  return map[status] ?? Colors.textMuted;
}
function sourceLabel(source?: string) {
  const value = source?.toLowerCase() ?? '';
  if (value.includes('petronect')) return 'Petronect';
  if (value.includes('compras')) return 'Compras.gov.br';
  return source ? 'PNCP' : '';
}
function payloadString(payload: Record<string, unknown> | null | undefined, key: string): string {
  const value = payload?.[key];
  return typeof value === 'string' ? value : '';
}
function estimatedValueLabel(value: string | number | null | undefined) {
  if (value == null || value === '') return 'Valor não informado';
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount)
    : 'Valor não informado';
}

export function NotificationsScreen({ onOpenOpportunity }: Props) {
  const navigation = useNavigation<NotificationsScreenProps['navigation']>();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await notificationsApi.list();
        if (active) setNotifications(data?.data ?? data ?? []);
      } catch {
        if (active) setError('Não foi possível carregar as notificações. Verifique sua conexão e tente novamente.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  async function markRead(id: string) {
    try {
      await notificationsApi.markRead(id);
      setNotifications((previous) => previous.map((item) => item.id === id ? { ...item, status: 'read' } : item));
    } catch {
      // Navigation remains available even if marking read fails temporarily.
    }
  }

  function openNotification(item: NotificationItem) {
    void markRead(item.id);
    const id = payloadString(item.payload, 'highlightOpportunityId') ||
      payloadString(item.payload, 'opportunityId') || item.opportunityId || item.opportunity?.id;
    if (!id) return;
    if (onOpenOpportunity) {
      onOpenOpportunity(id);
    } else {
      navigation.navigate('Dashboard', { highlightOpportunityId: id });
    }
  }

  if (loading) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.heading}>
            <Text style={styles.headingTitle}>Central de Notificações</Text>
            <Text style={styles.headingSubtitle}>Toque em um alerta para abrir o edital correspondente no Dashboard.</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyTitle}>Nenhuma notificação</Text>
            <Text style={styles.emptyText}>Novas oportunidades compatíveis aparecerão aqui.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const payload = item.payload;
          const title = payloadString(payload, 'title') || item.templateCode.replaceAll('_', ' ');
          const agency = payloadString(payload, 'agencyName') || item.opportunity?.bidding?.agencyName || 'Órgão não informado';
          const summary = payloadString(payload, 'objectSummary') || item.opportunity?.bidding?.objectSummary || payloadString(payload, 'body') || 'Abra para consultar a oportunidade.';
          const city = payloadString(payload, 'city') || item.opportunity?.bidding?.municipalityName || '';
          const uf = payloadString(payload, 'uf') || item.opportunity?.bidding?.uf || '';
          const storedValue = payload?.estimatedValue;
          const value = typeof storedValue === 'string' || typeof storedValue === 'number'
            ? storedValue
            : item.opportunity?.bidding?.estimatedValue;
          const storedPercent = payload?.compatibilityPercent;
          const percent = typeof storedPercent === 'number'
            ? storedPercent
            : item.opportunity?.matchingScore != null
              ? Math.max(0, Math.min(100, Math.round(Number(item.opportunity.matchingScore) * 100)))
              : null;
          const meta = [city && uf ? `${city} - ${uf}` : city || uf, estimatedValueLabel(value), percent != null ? `${percent}% compatibilidade` : 'Compatibilidade não informada'].filter(Boolean).join(' · ');
          const source = sourceLabel(payloadString(payload, 'source') || item.opportunity?.bidding?.source);
          const hasOpportunity = Boolean(item.opportunityId || payloadString(payload, 'highlightOpportunityId') || payloadString(payload, 'opportunityId') || item.opportunity?.id);
          return (
            <TouchableOpacity
              style={[styles.card, item.status === 'read' && styles.cardRead]}
              onPress={() => openNotification(item)}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              <View style={styles.cardRow}>
                <View style={[styles.dot, { backgroundColor: statusColor(item.status) }]} />
                <View style={styles.cardContent}>
                  <View style={styles.titleRow}>
                    <Text style={styles.title} numberOfLines={1}>{title}</Text>
                    {source ? <View style={styles.sourceBadge}><Text style={styles.sourceText}>{source}</Text></View> : null}
                  </View>
                  <Text style={styles.agency} numberOfLines={1}>{agency}</Text>
                  <Text style={styles.meta} numberOfLines={1}>{meta}</Text>
                  <Text style={styles.body} numberOfLines={2}>{summary}</Text>
                  <Text style={styles.channel}>{channelLabel(item.channel)}{hasOpportunity ? ' · Abrir edital no Dashboard' : ''}</Text>
                </View>
                <Text style={styles.date}>{formatDate(item.sentAt ?? item.createdAt)}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24, flexGrow: 1 },
  heading: { marginBottom: 15 },
  headingTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  headingSubtitle: { fontSize: 12, color: Colors.textMuted, marginTop: 4 },
  card: { backgroundColor: Colors.white, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.border, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardRead: { opacity: 0.65 },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  cardContent: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7 },
  title: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, flexShrink: 1 },
  agency: { fontSize: 12, fontWeight: '700', color: Colors.textPrimary, marginTop: 5 },
  meta: { fontSize: 11, color: Colors.textMuted, marginTop: 3 },
  body: { fontSize: 12, color: Colors.textSecondary, lineHeight: 18, marginTop: 5 },
  sourceBadge: { backgroundColor: '#DBEAFE', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3 },
  sourceText: { color: '#1E3A8A', fontSize: 9, fontWeight: '800' },
  channel: { fontSize: 11, color: Colors.textMuted, marginTop: 6 },
  date: { fontSize: 10, color: Colors.textMuted, flexShrink: 0 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 70 },
  emptyIcon: { fontSize: 42, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary, marginBottom: 7 },
  emptyText: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', paddingHorizontal: 32, lineHeight: 19 },
  errorText: { color: Colors.danger, fontSize: 12, textAlign: 'center', marginBottom: 18 },
});
