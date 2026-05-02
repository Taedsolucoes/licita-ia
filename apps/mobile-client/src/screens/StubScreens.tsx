import React from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../theme/colors';

interface StubScreenProps {
  title: string;
  icon: string;
  description?: string;
}

function StubScreen({ title, icon, description }: StubScreenProps) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.center}>
        <Text style={styles.icon}>{icon}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.desc}>{description ?? 'Em breve disponível.'}</Text>
      </View>
    </SafeAreaView>
  );
}

export function BiddingsScreen() {
  return <StubScreen title="Licitações" icon="📄" description="Gerencie suas licitações aqui." />;
}

export function DocumentsScreen() {
  return <StubScreen title="Documentos" icon="📁" description="Gerencie seus documentos aqui." />;
}

export function CertificatesScreen() {
  return <StubScreen title="Certidões" icon="🛡" description="Acompanhe suas certidões e validades." />;
}

export function ResultsScreen() {
  return <StubScreen title="Resultados" icon="🏆" description="Veja os resultados das licitações." />;
}

export function ReportsScreen() {
  return <StubScreen title="Relatórios" icon="📊" description="Relatórios gerenciais." />;
}

export function SettingsScreen() {
  return <StubScreen title="Configurações" icon="⚙️" description="Configurações do sistema." />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  icon: { fontSize: 56, marginBottom: 20 },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  desc: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
