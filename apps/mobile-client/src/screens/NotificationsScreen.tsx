import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { notificationsApi } from '../services/api';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { Colors } from '../theme/colors';

interface NotificationItem {
  id: string;
  templateCode: string;
  status: string;
  channel: string;
  sentAt?: string | null;
  createdAt: string;
  opportunity?: {
    id: string;
    bidding?: {
      biddingNumber?: string | null;
      agencyName?: string | null;
      objectSummary?: string | null;
    } | null;
  } | null;
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function channelLabel(channel: string) {
  const map: Record<string, string> = { push: 'Push', whatsapp: 'WhatsApp', email: 'E-mail' };
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

export function NotificationsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await notificationsApi.list();
        setNotifications(data?.data ?? data ?? []);
      } catch {
        Alert.alert('Erro', 'Não foi possível carregar as notificações.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function openNotification(item: NotificationItem) {
    await markRead(item.id);
    if (item.opportunity?.id) {
      navigation.navigate('OpportunityDetail', { opportunityId: item.opportunity.id });
    }
  }

  async function markRead(id: string) {
    try {
      await notificationsApi.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, status: 'read' } : n))
      );
    } catch {
      // silent
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyTitle}>Nenhuma notificação</Text>
            <Text style={styles.emptyText}>
              Você não possui notificações no momento.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, item.status === 'read' && styles.cardRead]}
            onPress={() => void openNotification(item)}
            activeOpacity={0.85}
          >
            <View style={styles.cardRow}>
              <View style={[styles.dot, { backgroundColor: statusColor(item.status) }]} />
              <View style={styles.cardContent}>
                <Text style={styles.templateCode} numberOfLines={2}>
                  {item.opportunity?.bidding?.objectSummary ?? item.opportunity?.bidding?.biddingNumber ?? 'Nova oportunidade compatível'}
                </Text>
                <Text style={styles.channel} numberOfLines={1}>
                  {item.opportunity?.bidding?.agencyName ?? 'Alerta de licitação'} · {channelLabel(item.channel)}
                </Text>
              </View>
              <Text style={styles.date}>{formatDate(item.sentAt ?? item.createdAt)}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24, flexGrow: 1 },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardRead: { opacity: 0.65 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  cardContent: { flex: 1 },
  templateCode: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  channel: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  date: { fontSize: 11, color: Colors.textMuted, flexShrink: 0 },
  emptyContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80,
  },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  emptyText: {
    fontSize: 14, color: Colors.textSecondary, textAlign: 'center',
    paddingHorizontal: 32, lineHeight: 20,
  },
});
