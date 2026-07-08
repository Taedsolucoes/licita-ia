import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Web-only component

interface MenuItem {
  key: string;
  label: string;
  icon: string;
}

const MENU_ITEMS: MenuItem[] = [
  { key: 'AdminDashboard',  label: 'Dashboard',      icon: '⊞' },
  { key: 'AdminTenants',    label: 'Empresas',        icon: '🏢' },
  { key: 'Opportunities',   label: 'Oportunidades',   icon: '◎' },
  { key: 'Biddings',        label: 'Licitações',      icon: '☰' },
  { key: 'Documents',       label: 'Documentos',      icon: '📁' },
  { key: 'Results',         label: 'Resultados',      icon: '🏆' },
  { key: 'Notifications',   label: 'Notificações',    icon: '🔔' },
  { key: 'Reports',         label: 'Relatórios',      icon: '📊' },
  { key: 'Settings',        label: 'Configurações',   icon: '⚙️' },
];

interface AdminSidebarProps {
  activeRoute: string;
  onNavigate: (routeKey: string) => void;
  adminName?: string;
  adminRole?: string;
}

export function AdminSidebar({ activeRoute, onNavigate, adminName, adminRole }: AdminSidebarProps) {
  const initials = adminName
    ? adminName
        .split(' ')
        .slice(0, 2)
        .map((w) => w[0])
        .join('')
        .toUpperCase()
    : 'GA';

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

      {/* Footer: admin avatar */}
      <View style={styles.footer}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.adminInfo}>
          <Text style={styles.adminName}>{adminName ?? 'Gabriel Admin'}</Text>
          <Text style={styles.adminRole}>{adminRole ?? 'Administrador'}</Text>
        </View>
      </View>
    </View>
  );
}

const ACTIVE_BG = 'rgba(37,99,235,0.18)';
const ACTIVE_COLOR = '#93C5FD';

const styles = StyleSheet.create({
  sidebar: {
    width: 240,
    backgroundColor: '#1a2332',
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
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  logoIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoIconText: { fontSize: 18 },
  logoText: { fontSize: 20, fontWeight: '800' },
  logoLicita: { color: '#FFFFFF' },
  logoIA: { color: '#60A5FA' },

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
    backgroundColor: ACTIVE_BG,
  },
  menuIcon: {
    fontSize: 16,
    width: 22,
    textAlign: 'center',
    opacity: 0.45,
  },
  menuIconActive: {
    opacity: 1,
  },
  menuLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.55)',
  },
  menuLabelActive: {
    color: ACTIVE_COLOR,
    fontWeight: '700',
  },

  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  adminInfo: { gap: 2 },
  adminName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  adminRole: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
  },
});
