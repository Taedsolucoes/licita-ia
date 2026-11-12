import React, { useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { createNavigationContainerRef, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import { LoginScreen } from '../screens/LoginScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { WebClientDashboardScreen } from '../screens/WebClientDashboardScreen';
import { OpportunityDetailScreen } from '../screens/OpportunityDetailScreen';
import { ImpugnationScreen } from '../screens/ImpugnationScreen';
import { PricingScreen } from '../screens/PricingScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { AdminDashboardScreen } from '../screens/AdminDashboardScreen';
import { AdminTenantsScreen } from '../screens/AdminTenantsScreen';
import { AdminTenantDetailScreen } from '../screens/AdminTenantDetailScreen';
import { AdminOpportunitiesScreen } from '../screens/web/AdminOpportunitiesScreen';
import { AdminBiddingsScreen } from '../screens/web/AdminBiddingsScreen';
import { AdminReportsScreen } from '../screens/web/AdminReportsScreen';
import {
  BiddingsScreen,
  DocumentsScreen,
  CertificatesScreen,
  ResultsScreen,
  ReportsScreen,
  SettingsScreen,
} from '../screens/StubScreens';
import { Colors } from '../theme/colors';
import type { RootStackParamList, AuthStackParamList, MainTabParamList } from '../types/navigation';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

const ADMIN_ROLES = ['taed_admin', 'taed_operator'];

// ─── Web-only lazy import for WebLayout + sidebars ──────────────────────────
let WebLayout: typeof import('../components/web/WebLayout').WebLayout | null = null;
if (Platform.OS === 'web') {
  // Dynamic require so the module is not bundled on native
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  WebLayout = require('../components/web/WebLayout').WebLayout;
}

// ─── Tab icon (mobile only) ──────────────────────────────────────────────────
function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Dashboard: '📋',
    Notifications: '🔔',
    Profile: '👤',
    AdminDashboard: '🏛️',
    AdminTenants: '🏢',
  };
  return (
    <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>
      {icons[name] ?? '•'}
    </Text>
  );
}

// ─── Web main navigator ──────────────────────────────────────────────────────
type WebScreenKey = keyof MainTabParamList;

const ROUTE_DEFAULT_CLIENT: WebScreenKey = 'Dashboard';
const ROUTE_DEFAULT_ADMIN: WebScreenKey = 'AdminDashboard';

function WebMainNavigator() {
  const { user } = useAuth();
  const isAdmin = ADMIN_ROLES.includes(user?.role ?? '');
  const [activeRoute, setActiveRoute] = useState<WebScreenKey>(
    isAdmin ? ROUTE_DEFAULT_ADMIN : ROUTE_DEFAULT_CLIENT
  );
  const [highlightedOpportunityId, setHighlightedOpportunityId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const fromUrl = () => {
      const id = new URLSearchParams(window.location.search).get('highlightOpportunityId');
      if (id) {
        setHighlightedOpportunityId(id);
        setActiveRoute('Dashboard');
      }
    };
    const fromNotification = (event: Event) => {
      const id = (event as CustomEvent<string>).detail;
      if (id) {
        setHighlightedOpportunityId(id);
        setActiveRoute('Dashboard');
      }
    };
    fromUrl();
    window.addEventListener('popstate', fromUrl);
    window.addEventListener('licita:open-opportunity', fromNotification);
    return () => {
      window.removeEventListener('popstate', fromUrl);
      window.removeEventListener('licita:open-opportunity', fromNotification);
    };
  }, []);

  function openOpportunity(id: string) {
    setHighlightedOpportunityId(id);
    setActiveRoute('Dashboard');
  }

  function renderScreen() {
    switch (activeRoute) {
      case 'Dashboard':       return isAdmin
        ? <DashboardScreen highlightedOpportunityId={highlightedOpportunityId} />
        : <WebClientDashboardScreen highlightedOpportunityId={highlightedOpportunityId} onNavigateRoute={(route) => setActiveRoute(route)} />;
      case 'Notifications':   return <NotificationsScreen onOpenOpportunity={openOpportunity} />;
      case 'Profile':         return <ProfileScreen />;
      case 'AdminDashboard':  return <AdminDashboardScreen />;
      case 'AdminTenants':    return <AdminTenantsScreen />;
      case 'Opportunities':   return isAdmin
        ? <AdminOpportunitiesScreen />
        : <WebClientDashboardScreen highlightedOpportunityId={highlightedOpportunityId} onNavigateRoute={(route) => setActiveRoute(route)} />;
      case 'Biddings':        return isAdmin ? <AdminBiddingsScreen /> : <BiddingsScreen />;
      case 'Documents':       return <DocumentsScreen />;
      case 'Certificates':    return <CertificatesScreen />;
      case 'Results':         return <ResultsScreen />;
      case 'Reports':         return isAdmin ? <AdminReportsScreen /> : <ReportsScreen />;
      case 'Settings':        return <SettingsScreen />;
      default:                return <DashboardScreen />;
    }
  }

  if (!WebLayout) return null;

  return (
    <WebLayout
      activeRoute={activeRoute}
      onNavigate={(key) => setActiveRoute(key as WebScreenKey)}
    >
      {renderScreen()}
    </WebLayout>
  );
}

// ─── Mobile main navigator (Bottom Tabs) ────────────────────────────────────
function MainTabs() {
  const { user } = useAuth();
  const isAdmin = ADMIN_ROLES.includes(user?.role ?? '');

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: Colors.primary },
        headerTintColor: Colors.white,
        headerTitleStyle: { fontWeight: '800', fontSize: 18, letterSpacing: 1.5 },
        tabBarStyle: {
          backgroundColor: Colors.white,
          borderTopColor: Colors.border,
          paddingBottom: 6,
          height: 62,
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          headerShown: false,
          tabBarLabel: 'Oportunidades',
        }}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: 'Notificações', tabBarLabel: 'Notificações' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'Meu Perfil', tabBarLabel: 'Perfil' }}
      />
      {isAdmin ? (
        <>
          <Tab.Screen
            name="AdminDashboard"
            component={AdminDashboardScreen}
            options={{
              headerShown: false,
              tabBarLabel: 'Admin',
            }}
          />
          <Tab.Screen
            name="AdminTenants"
            component={AdminTenantsScreen}
            options={{
              headerShown: false,
              tabBarLabel: 'Empresas',
            }}
          />
        </>
      ) : null}
    </Tab.Navigator>
  );
}

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
    </AuthStack.Navigator>
  );
}

export function AppNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (Platform.OS === 'web' || !isAuthenticated) return;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Notifications = require('expo-notifications') as typeof import('expo-notifications');
    const openOpportunity = (response: import('expo-notifications').NotificationResponse) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      const id = String(data.highlightOpportunityId ?? data.opportunityId ?? '');
      if (!id) return;
      if (navigationRef.isReady()) {
        navigationRef.navigate('MainTabs', {
          screen: 'Dashboard',
          params: { highlightOpportunityId: id },
        });
      }
    };
    const subscription = Notifications.addNotificationResponseReceivedListener(openOpportunity);
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) openOpportunity(response);
    }).catch(() => undefined);
    return () => subscription.remove();
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: Colors.white, fontSize: 32, fontWeight: '900', letterSpacing: 3 }}>
          LICITA IA
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.6)', marginTop: 8 }}>
          Carregando...
        </Text>
      </View>
    );
  }

  // ── Web: use custom sidebar layout, no NavigationContainer bottom tabs ──
  if (Platform.OS === 'web') {
    if (!isAuthenticated) {
      return (
        <NavigationContainer ref={navigationRef}>
          <RootStack.Navigator screenOptions={{ headerShown: false }}>
            <RootStack.Screen name="AuthStack" component={AuthNavigator} />
          </RootStack.Navigator>
        </NavigationContainer>
      );
    }

    // Authenticated web: full sidebar layout (no NavigationContainer needed for main screens)
    // Wrap in NavigationContainer so deep-link screens (OpportunityDetail etc.) still work
    return (
      <NavigationContainer ref={navigationRef}>
        <RootStack.Navigator screenOptions={{ headerShown: false }}>
          <RootStack.Screen name="MainTabs" component={WebMainNavigator} />
          <RootStack.Screen
            name="OpportunityDetail"
            component={OpportunityDetailScreen}
            options={{
              headerShown: true,
              title: 'Detalhes',
              headerStyle: { backgroundColor: Colors.primary },
              headerTintColor: Colors.white,
              headerTitleStyle: { fontWeight: '700' },
            }}
          />
          <RootStack.Screen
            name="Impugnation"
            component={ImpugnationScreen}
            options={{
              headerShown: true,
              title: 'Impugnação',
              headerStyle: { backgroundColor: Colors.primary },
              headerTintColor: Colors.white,
              headerTitleStyle: { fontWeight: '700' },
            }}
          />
          <RootStack.Screen
            name="Pricing"
            component={PricingScreen}
            options={{
              headerShown: true,
              title: 'Precificação',
              headerStyle: { backgroundColor: Colors.primary },
              headerTintColor: Colors.white,
              headerTitleStyle: { fontWeight: '700' },
            }}
          />
          <RootStack.Screen
            name="AdminTenantDetail"
            component={AdminTenantDetailScreen}
            options={{
              headerShown: true,
              title: 'Detalhes da Empresa',
              headerStyle: { backgroundColor: Colors.primary },
              headerTintColor: Colors.white,
              headerTitleStyle: { fontWeight: '700' },
            }}
          />
        </RootStack.Navigator>
      </NavigationContainer>
    );
  }

  // ── Mobile: standard navigation ─────────────────────────────────────────
  return (
    <NavigationContainer ref={navigationRef}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <>
            <RootStack.Screen name="MainTabs" component={MainTabs} />
            <RootStack.Screen
              name="OpportunityDetail"
              component={OpportunityDetailScreen}
              options={{
                headerShown: true,
                title: 'Detalhes',
                headerStyle: { backgroundColor: Colors.primary },
                headerTintColor: Colors.white,
                headerTitleStyle: { fontWeight: '700' },
              }}
            />
            <RootStack.Screen
              name="Impugnation"
              component={ImpugnationScreen}
              options={{
                headerShown: true,
                title: 'Impugnação',
                headerStyle: { backgroundColor: Colors.primary },
                headerTintColor: Colors.white,
                headerTitleStyle: { fontWeight: '700' },
              }}
            />
            <RootStack.Screen
              name="Pricing"
              component={PricingScreen}
              options={{
                headerShown: true,
                title: 'Precificação',
                headerStyle: { backgroundColor: Colors.primary },
                headerTintColor: Colors.white,
                headerTitleStyle: { fontWeight: '700' },
              }}
            />
            <RootStack.Screen
              name="AdminTenantDetail"
              component={AdminTenantDetailScreen}
              options={{
                headerShown: true,
                title: 'Detalhes da Empresa',
                headerStyle: { backgroundColor: Colors.primary },
                headerTintColor: Colors.white,
                headerTitleStyle: { fontWeight: '700' },
              }}
            />
          </>
        ) : (
          <RootStack.Screen name="AuthStack" component={AuthNavigator} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
