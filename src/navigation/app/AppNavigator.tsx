import React from 'react';
import { StyleSheet, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../theme/ThemeProvider';

import JobsListScreen from '../../screens/jobs/JobsListScreen';
import JobDetailsScreen from '../../screens/jobs/JobDetailsScreen';
import ApplyJobScreen from '../../screens/jobs/ApplyJobScreen';
import MyApplicationsScreen from '../../screens/applications/MyApplicationsScreen';
import InvoicesListScreen from '../../screens/invoices/InvoicesListScreen';
import InvoiceDetailsScreen from '../../screens/invoices/InvoiceDetailsScreen';
import PaymentScreen from '../../screens/payments/PaymentScreen';
import ChatListScreen from '../../screens/chat/ChatListScreen';
import ChatRoomScreen from '../../screens/chat/ChatRoomScreen';
import InquiryListScreen from '../../screens/inquiries/InquiryListScreen';
import CreateInquiryScreen from '../../screens/inquiries/CreateInquiryScreen';
import InquiryDetailsScreen from '../../screens/inquiries/InquiryDetailsScreen';
import ProfileScreen from '../../screens/profile/ProfileScreen';
import type { Invoice } from '../../types/models';

export type JobsStackParamList = {
  JobsList: undefined;
  JobDetails: { jobId: string };
  ApplyJob: { jobId: string };
};

export type ChatStackParamList = {
  ChatList: undefined;
  ChatRoom: { adminId: string; title?: string };
};

export type InvoicesStackParamList = {
  InvoicesList: undefined;
  InvoiceDetails: { invoiceId: string; invoice?: Invoice };
  Payment: { invoiceId: string };
};

export type InquiryStackParamList = {
  InquiryList: undefined;
  CreateInquiry: { jobId?: string };
  InquiryDetails: { inquiryId: string };
};

const Tab = createBottomTabNavigator();
const JobsStack = createNativeStackNavigator<JobsStackParamList>();
const InvoicesStack = createNativeStackNavigator<InvoicesStackParamList>();
const ChatStack = createNativeStackNavigator<ChatStackParamList>();
const InquiryStack = createNativeStackNavigator<InquiryStackParamList>();

function JobsNavigator() {
  const t = useTheme();
  return (
    <JobsStack.Navigator
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: t.colors.primary },
        headerTintColor: t.colors.textOnPrimary,
        headerTitleStyle: { fontWeight: '800' },
      }}
    >
      <JobsStack.Screen name="JobsList" component={JobsListScreen} options={{ title: 'Jobs' }} />
      <JobsStack.Screen name="JobDetails" component={JobDetailsScreen} options={{ title: 'Job Details' }} />
      <JobsStack.Screen name="ApplyJob" component={ApplyJobScreen} options={{ title: 'Apply' }} />
    </JobsStack.Navigator>
  );
}

function ChatNavigator() {
  const t = useTheme();
  return (
    <ChatStack.Navigator
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: t.colors.primary },
        headerTintColor: t.colors.textOnPrimary,
        headerTitleStyle: { fontWeight: '800' },
      }}
    >
      <ChatStack.Screen name="ChatList" component={ChatListScreen} options={{ title: 'Chat' }} />
      <ChatStack.Screen name="ChatRoom" component={ChatRoomScreen} options={({ route }) => ({ title: route.params.title || 'Chat' })} />
    </ChatStack.Navigator>
  );
}

function InvoicesNavigator() {
  const t = useTheme();
  return (
    <InvoicesStack.Navigator
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: t.colors.primary },
        headerTintColor: t.colors.textOnPrimary,
        headerTitleStyle: { fontWeight: '800' },
      }}
    >
      <InvoicesStack.Screen name="InvoicesList" component={InvoicesListScreen} options={{ title: 'Bills' }} />
      <InvoicesStack.Screen name="InvoiceDetails" component={InvoiceDetailsScreen} options={{ title: 'Invoice' }} />
      <InvoicesStack.Screen name="Payment" component={PaymentScreen} options={{ title: 'Payment' }} />
    </InvoicesStack.Navigator>
  );
}

function InquiryNavigator() {
  const t = useTheme();
  return (
    <InquiryStack.Navigator
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: t.colors.primary },
        headerTintColor: t.colors.textOnPrimary,
        headerTitleStyle: { fontWeight: '800' },
      }}
    >
      <InquiryStack.Screen name="InquiryList" component={InquiryListScreen} options={{ title: 'Inquiries' }} />
      <InquiryStack.Screen name="CreateInquiry" component={CreateInquiryScreen} options={{ title: 'New Inquiry' }} />
      <InquiryStack.Screen name="InquiryDetails" component={InquiryDetailsScreen} options={{ title: 'Inquiry' }} />
    </InquiryStack.Navigator>
  );
}

function TabIcon({ focused, active, inactive }: { focused: boolean; active: keyof typeof Feather.glyphMap; inactive: keyof typeof Feather.glyphMap }) {
  if (focused) {
    return (
      <LinearGradient colors={['#1B3890', '#0F79C5']} start={{ x: 0, y: 0.4 }} end={{ x: 1, y: 1 }} style={styles.iconWrapActiveGradient}>
        <Feather name={active} size={21} color="#FFFFFF" />
      </LinearGradient>
    );
  }
  return (
    <View style={styles.iconWrap}>
      <Feather name={inactive} size={21} color="#7384B2" />
    </View>
  );
}

export default function AppNavigator() {
  const t = useTheme();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: t.colors.primary,
        tabBarInactiveTintColor: '#7384B2',
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
        tabBarStyle: styles.tabBar,
      }}
    >
      <Tab.Screen
        name="Home"
        component={JobsNavigator}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} active="home" inactive="home" />,
        }}
      />
      <Tab.Screen
        name="Jobs"
        component={MyApplicationsScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} active="briefcase" inactive="briefcase" />,
        }}
      />
      <Tab.Screen
        name="Bills"
        component={InvoicesNavigator}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} active="file-text" inactive="file-text" />,
        }}
      />
      <Tab.Screen
        name="Chat"
        component={ChatNavigator}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} active="message-circle" inactive="message-circle" />,
        }}
      />
      <Tab.Screen
        name="Me"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} active="user" inactive="user" />,
        }}
      />
      <Tab.Screen
        name="Inquiries"
        component={InquiryNavigator}
        options={{
          tabBarButton: () => null,
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 10,
    height: 88,
    paddingTop: 10,
    paddingBottom: 14,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: '#E5EBF8',
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.97)',
    shadowColor: '#4B5E8C',
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 16,
  },
  tabItem: {
    borderRadius: 16,
    marginHorizontal: 2,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
    marginBottom: 2,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  iconWrapActiveGradient: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1B3890',
    shadowOpacity: 0.26,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
