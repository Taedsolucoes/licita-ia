import React from 'react';
import { Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import { LoginScreen } from '../screens/LoginScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { OpportunityDetailScreen } from '../screens/OpportunityDetailScreen';
import { ImpugnationScreen } from '../screens/ImpugnationScreen';
import { PricingScreen } from '../screens/PricingScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { AdminDashboardScreen } from '../screens/AdminDashboardScreen';
import { AdminTenantsScreen } from '../screens/AdminTenantsScreen';
import { AdminTenantDetailScreen } from '../screens/AdminTenantDetailScreen';
import { Colors } from '../theme/colors';
import type { RootStackParamList, AuthStackParamList, MainTabParamList } from '../types/navigation';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const ADMIN_ROLES = ['taed_admin', 'taed_operator'];

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

  return (
    <NavigationContainer>
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
