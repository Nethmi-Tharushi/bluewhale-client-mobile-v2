import React from 'react';
import { StyleSheet, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
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
  Payment: { invoiceId: string; hasProof?: boolean; existingReference?: string; existingNotes?: string };
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

function TabIcon({ focused, icon }: { focused: boolean; icon: keyof typeof Feather.glyphMap }) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Feather name={icon} size={20} color={focused ? '#1B3890' : '#7384B2'} />
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
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="home" />,
        }}
      />
      <Tab.Screen
        name="Jobs"
        component={MyApplicationsScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="briefcase" />,
        }}
      />
      <Tab.Screen
        name="Bills"
        component={InvoicesNavigator}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="file-text" />,
        }}
      />
      <Tab.Screen
        name="Chat"
        component={ChatNavigator}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="message-circle" />,
        }}
      />
      <Tab.Screen
        name="Me"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="user" />,
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
    height: 66,
    paddingTop: 6,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  tabItem: {
    borderRadius: 10,
    marginHorizontal: 1,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
    marginBottom: 0,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  iconWrapActive: {
    backgroundColor: '#EEF2FF',
  },
});
