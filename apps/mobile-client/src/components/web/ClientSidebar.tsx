import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Web-only component

interface MenuItem {
  key: string;
  label: string;
  icon: string;
}

const MENU_ITEMS: MenuItem[] = [
  { key: 'Dashboard',     label: 'Visão Geral',  icon: '⊞' },
  { key: 'Opportunities', label: 'Oportunidades', icon: '◎' },
  { key: 'Biddings',      label: 'Licitações',    icon: '☰' },
  { key: 'Documents',     label: 'Documentos',    icon: '📁' },
  { key: 'Certificates',  label: 'Certidões',     icon: '🛡' },
  { key: 'Results',       label: 'Resultados',    icon: '🏆' },
  { key: 'Notifications', label: 'Alertas',       icon: '🔔' },
  { key: 'Profile',       label: 'Meu Perfil',    icon: '👤' },
];

interface ClientSidebarProps {
  activeRoute: string;
  onNavigate: (routeKey: string) => void;
}

export function ClientSidebar({ activeRoute, onNavigate }: ClientSidebarProps) {
  return (
    <View style={styles.sidebar}>
      {/* Logo */}
      <View style={styles.logoContainer}>
        <View style={styles.logoIcon}>
          <Text style={styles.logoIconText}>📊</Text>
        </View>
        <Text style={styles.logoText}>
          <Text style={styles.logoLicita}>Licita</Text>
          <Text style={styles.logoIA}>IA</Text>
        </Text>
      </View>

      {/* Menu */}
      <View style={styles.menu}>
        {MENU_ITEMS.map((item) => {
          const isActive = activeRoute === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              style={[styles.menuItem, isActive && styles.menuItemActive]}
              onPress={() => onNavigate(item.key)}
              activeOpacity={0.75}
            >
              <Text style={[styles.menuIcon, isActive && styles.menuIconActive]}>
                {item.icon}
              </Text>
              <Text style={[styles.menuLabel, isActive && styles.menuLabelActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Footer help card */}
      <View style={styles.footer}>
        <View style={styles.helpCard}>
          <View style={styles.helpTextBlock}>
            <Text style={styles.helpTitle}>Precisa de ajuda?</Text>
            <Text style={styles.helpSub}>Fale com seu assessor</Text>
          </View>
          <View style={styles.whatsappBtn}>
            <Text style={styles.whatsappIcon}>💬</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const BLUE = '#2563EB';
const BLUE_BG = '#EFF6FF';

const styles = StyleSheet.create({
  sidebar: {
    width: 240,
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    flexDirection: 'column',
  },

  // Logo
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 28,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  logoIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: BLUE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoIconText: { fontSize: 18 },
  logoText: { fontSize: 20, fontWeight: '800' },
  logoLicita: { color: '#1E293B' },
  logoIA: { color: BLUE },

  // Menu
  menu: {
    flex: 1,
    paddingTop: 12,
    paddingHorizontal: 12,
    gap: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  menuItemActive: {
    backgroundColor: BLUE_BG,
  },
  menuIcon: {
    fontSize: 18,
    width: 22,
    textAlign: 'center',
    opacity: 0.55,
  },
  menuIconActive: {
    opacity: 1,
  },
  menuLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
  },
  menuLabelActive: {
    color: BLUE,
    fontWeight: '700',
  },

  // Footer
  footer: {
    padding: 16,
  },
  helpCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  helpTextBlock: { gap: 2 },
  helpTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  helpSub: {
    fontSize: 11,
    color: '#94A3B8',
  },
  whatsappBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  whatsappIcon: { fontSize: 18 },
});
