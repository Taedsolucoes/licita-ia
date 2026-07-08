import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { ClientSidebar } from './ClientSidebar';
import { AdminSidebar } from './AdminSidebar';

const ADMIN_ROLES = ['taed_admin', 'taed_operator'];

export interface WebLayoutProps {
  activeRoute: string;
  onNavigate: (routeKey: string) => void;
  children: React.ReactNode;
}

export function WebLayout({ activeRoute, onNavigate, children }: WebLayoutProps) {
  const { user } = useAuth();
  const isAdmin = ADMIN_ROLES.includes(user?.role ?? '');

  return (
    <View style={styles.root}>
      {isAdmin ? (
        <AdminSidebar
          activeRoute={activeRoute}
          onNavigate={onNavigate}
          adminName={user?.fullName}
          adminRole="Administrador"
        />
      ) : (
        <ClientSidebar
          activeRoute={activeRoute}
          onNavigate={onNavigate}
        />
      )}
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
  },
  content: {
    flex: 1,
  },
});
