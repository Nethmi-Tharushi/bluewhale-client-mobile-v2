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
import AgentOverviewScreen from '../../screens/applications/AgentOverviewScreen';
import AnalyticsScreen from '../../screens/analytics/AnalyticsScreen';
import ManagedCandidateAnalyticsScreen from '../../screens/managed/ManagedCandidateAnalyticsScreen';
import InvoicesListScreen from '../../screens/invoices/InvoicesListScreen';
import InvoiceDetailsScreen from '../../screens/invoices/InvoiceDetailsScreen';
import PaymentScreen from '../../screens/payments/PaymentScreen';
import ChatListScreen from '../../screens/chat/ChatListScreen';
import ChatRoomScreen from '../../screens/chat/ChatRoomScreen';
import InquiryListScreen from '../../screens/inquiries/InquiryListScreen';
import CreateInquiryScreen from '../../screens/inquiries/CreateInquiryScreen';
import InquiryDetailsScreen from '../../screens/inquiries/InquiryDetailsScreen';
import TasksListScreen from '../../screens/tasks/TasksListScreen';
import TaskDetailsScreen from '../../screens/tasks/TaskDetailsScreen';
import MeetingsListScreen from '../../screens/meetings/MeetingsListScreen';
import MeetingDetailsScreen from '../../screens/meetings/MeetingDetailsScreen';
import DocumentsScreen from '../../screens/documents/DocumentsScreen';
import ManagedCandidatesScreen from '../../screens/agent/ManagedCandidatesScreen';
import ProfileScreen from '../../screens/profile/ProfileScreen';
import EditProfileScreen from '../../screens/profile/EditProfileScreen';
import ManagedCandidateChatScreen from '../../screens/managed/ManagedCandidateChatScreen';
import ManagedCandidateProfileScreen from '../../screens/managed/ManagedCandidateProfileScreen';
import type { Invoice, Meeting, Task } from '../../types/models';
import { useAuthStore } from '../../context/authStore';
import { isManagedViewActive } from '../../utils/managedView';

export type JobsStackParamList = {
  JobsList: undefined;
  JobDetails: { jobId: string };
  ApplyJob: { jobId: string };
};

export type ChatStackParamList = {
  ChatList: undefined;
  ChatRoom: { adminId: string; title?: string; adminEmail?: string; adminRole?: string };
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

export type TasksStackParamList = {
  TasksList: undefined;
  TaskDetails: { taskId: string; task?: Task };
};

export type MeetingsStackParamList = {
  MeetingsList: undefined;
  MeetingDetails: { meetingId: string; meeting?: Meeting };
};

export type DocumentsStackParamList = {
  DocumentsHome: undefined;
};

export type ProfileStackParamList = {
  ProfileHome: undefined;
  EditProfile: undefined;
};

const Tab = createBottomTabNavigator();
const JobsStack = createNativeStackNavigator<JobsStackParamList>();
const InvoicesStack = createNativeStackNavigator<InvoicesStackParamList>();
const ChatStack = createNativeStackNavigator<ChatStackParamList>();
const InquiryStack = createNativeStackNavigator<InquiryStackParamList>();
const TasksStack = createNativeStackNavigator<TasksStackParamList>();
const MeetingsStack = createNativeStackNavigator<MeetingsStackParamList>();
const DocumentsStack = createNativeStackNavigator<DocumentsStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();

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
  const user = useAuthStore((s) => s.user);
  const managedViewActive = isManagedViewActive(user);
  return (
    <ChatStack.Navigator
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: t.colors.primary },
        headerTintColor: t.colors.textOnPrimary,
        headerTitleStyle: { fontWeight: '800' },
      }}
    >
      <ChatStack.Screen name="ChatList" component={managedViewActive ? (ManagedCandidateChatScreen as any) : ChatListScreen} options={{ title: 'Chat' }} />
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

function TasksNavigator() {
  const t = useTheme();
  return (
    <TasksStack.Navigator
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: t.colors.primary },
        headerTintColor: t.colors.textOnPrimary,
        headerTitleStyle: { fontWeight: '800' },
      }}
    >
      <TasksStack.Screen name="TasksList" component={TasksListScreen} options={{ title: 'Tasks' }} />
      <TasksStack.Screen name="TaskDetails" component={TaskDetailsScreen} options={{ title: 'Task Details' }} />
    </TasksStack.Navigator>
  );
}

function MeetingsNavigator() {
  const t = useTheme();
  return (
    <MeetingsStack.Navigator
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: t.colors.primary },
        headerTintColor: t.colors.textOnPrimary,
        headerTitleStyle: { fontWeight: '800' },
      }}
    >
      <MeetingsStack.Screen name="MeetingsList" component={MeetingsListScreen} options={{ title: 'Meetings' }} />
      <MeetingsStack.Screen name="MeetingDetails" component={MeetingDetailsScreen} options={{ title: 'Meeting Details' }} />
    </MeetingsStack.Navigator>
  );
}

function DocumentsNavigator() {
  const t = useTheme();
  return (
    <DocumentsStack.Navigator
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: t.colors.primary },
        headerTintColor: t.colors.textOnPrimary,
        headerTitleStyle: { fontWeight: '800' },
      }}
    >
      <DocumentsStack.Screen name="DocumentsHome" component={DocumentsScreen} options={{ title: 'Documents' }} />
    </DocumentsStack.Navigator>
  );
}

function ProfileNavigator() {
  const t = useTheme();
  const user = useAuthStore((s) => s.user);
  const managedViewActive = isManagedViewActive(user);
  return (
    <ProfileStack.Navigator
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: t.colors.primary },
        headerTintColor: t.colors.textOnPrimary,
        headerTitleStyle: { fontWeight: '800' },
      }}
    >
      <ProfileStack.Screen name="ProfileHome" component={managedViewActive ? (ManagedCandidateProfileScreen as any) : ProfileScreen} options={{ title: 'Profile' }} />
      <ProfileStack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: 'Edit Profile' }} />
    </ProfileStack.Navigator>
  );
}

function TabIcon({
  focused,
  active,
  inactive,
}: {
  focused: boolean;
  active: keyof typeof Feather.glyphMap;
  inactive: keyof typeof Feather.glyphMap;
}) {
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
  const user = useAuthStore((s) => s.user);
  const managedViewActive = isManagedViewActive(user);
  return (
    <Tab.Navigator
      backBehavior="history"
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
          tabBarLabel: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} active="home" inactive="home" />,
        }}
      />
      <Tab.Screen
        name="Overview"
        component={AgentOverviewScreen}
        options={{
          tabBarLabel: 'Overview',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} active="activity" inactive="activity" />,
        }}
      />
      <Tab.Screen
        name="Applications"
        component={MyApplicationsScreen}
        options={{
          tabBarButton: () => null,
        }}
      />
      <Tab.Screen
        name="Candidates"
        component={ManagedCandidatesScreen}
        options={{
          tabBarButton: () => null,
        }}
      />
      <Tab.Screen
        name="Analytics"
        component={managedViewActive ? (ManagedCandidateAnalyticsScreen as any) : AnalyticsScreen}
        options={{
          tabBarLabel: 'Analytics',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} active="bar-chart-2" inactive="bar-chart-2" />,
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
        component={ProfileNavigator}
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
      <Tab.Screen
        name="Tasks"
        component={TasksNavigator}
        options={{
          tabBarButton: () => null,
        }}
      />
      <Tab.Screen
        name="Meetings"
        component={MeetingsNavigator}
        options={{
          tabBarButton: () => null,
        }}
      />
      <Tab.Screen
        name="Documents"
        component={DocumentsNavigator}
        options={{
          tabBarButton: () => null,
        }}
      />
      <Tab.Screen
        name="Invoices"
        component={InvoicesNavigator}
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
    left: 14,
    right: 14,
    bottom: 14,
    height: 104,
    paddingTop: 10,
    paddingBottom: 12,
    paddingHorizontal: 10,
    borderTopWidth: 0,
    borderRadius: 34,
    backgroundColor: 'rgba(255,255,255,0.97)',
    shadowColor: '#5169A5',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  tabItem: {
    borderRadius: 20,
    marginHorizontal: 2,
  },
  tabLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    marginTop: 4,
    marginBottom: 2,
  },
  iconWrap: {
    width: 50,
    height: 50,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  iconWrapActiveGradient: {
    width: 58,
    height: 58,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1651AA',
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
});

