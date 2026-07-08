import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';

export type AuthStackParamList = {
  Login: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Notifications: undefined;
  Profile: undefined;
  AdminDashboard: undefined;
  AdminTenants: undefined;
  // Web-only sidebar routes
  Opportunities: undefined;
  Biddings: undefined;
  Documents: undefined;
  Certificates: undefined;
  Results: undefined;
  Reports: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  AuthStack: undefined;
  MainTabs: undefined;
  OpportunityDetail: { opportunityId: string };
  Pricing: { participationId: string; biddingId: string; opportunityId: string };
  Impugnation: { biddingId: string; opportunityId: string };
  AdminTenantDetail: { tenantId: string };
};

export type LoginScreenProps = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export type DashboardScreenProps = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Dashboard'>,
  NativeStackScreenProps<RootStackParamList>
>;

export type NotificationsScreenProps = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Notifications'>,
  NativeStackScreenProps<RootStackParamList>
>;

export type ProfileScreenProps = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Profile'>,
  NativeStackScreenProps<RootStackParamList>
>;

export type AdminDashboardScreenProps = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'AdminDashboard'>,
  NativeStackScreenProps<RootStackParamList>
>;

export type AdminTenantsScreenProps = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'AdminTenants'>,
  NativeStackScreenProps<RootStackParamList>
>;

export type AdminTenantDetailScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'AdminTenantDetail'
>;

export type OpportunityDetailScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'OpportunityDetail'
>;

export type PricingScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'Pricing'
>;

export type ImpugnationScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'Impugnation'
>;
