export type Job = {
  _id: string;
  title?: string;
  company?: string;
  location?: string;
  type?: string;
  salary?: string;
  description?: string;
  requirements?: string;
  createdAt?: string;
  [k: string]: any;
};

export type Application = {
  _id: string;
  job?: Job | string;
  status?: string;
  note?: string;
  createdAt?: string;
  [k: string]: any;
};

export type SavedJobEntry = {
  _id?: string;
  id?: string;
  savedAt?: string;
  job?: Job | null;
  [k: string]: any;
};

export type WishlistStats = {
  totalSaved?: number;
  expiringThisWeek?: number;
  recentlySaved?: number;
  byType?: Array<{ type?: string; count?: number; [k: string]: any }>;
  byCountry?: Array<{ country?: string; count?: number; [k: string]: any }>;
  [k: string]: any;
};

export type Invoice = {
  _id: string;
  invoiceNumber?: string;
  status?: string;
  total?: number;
  grandTotal?: number;
  balanceDue?: number;
  paidAmount?: number;
  currency?: string;
  issueDate?: string;
  dueDate?: string;
  pdfUrl?: string;
  notes?: string;
  hasPaymentProof?: boolean;
  latestProof?: {
    reference?: string;
    referenceNo?: string;
    paymentReference?: string;
    slipUrl?: string;
    slip_url?: string;
    paymentSlipUrl?: string;
    attachmentUrl?: string;
    proofUrl?: string;
    [k: string]: any;
  } | null;
  customer?: {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
    candidateId?: string;
    candidateType?: 'B2C' | 'B2B' | string;
    [k: string]: any;
  };
  payments?: Array<{ amount?: number; reference?: string; createdAt?: string; [k: string]: any }>;
  items?: Array<{
    name?: string;
    description?: string;
    qty?: number;
    quantity?: number;
    unitPrice?: number;
    total?: number;
    lineTotal?: number;
    discount?: number;
    taxRate?: number;
    [k: string]: any;
  }>;
  [k: string]: any;
};

export type Inquiry = {
  _id: string;
  subject?: string;
  category?: string;
  message?: string;
  status?: string;
  replies?: Array<{ message: string; by?: string; createdAt?: string }>;
  createdAt?: string;
  [k: string]: any;
};

export type TaskFile = {
  fileName?: string;
  fileUrl?: string;
  size?: number;
  mimeType?: string;
  cloudinaryId?: string;
  uploadedAt?: string;
  [k: string]: any;
};

export type Task = {
  _id: string;
  title?: string;
  description?: string;
  type?: 'Document Upload' | 'Meeting' | 'Profile Update' | 'Form Fill' | 'Review' | 'Other' | string;
  status?: 'Pending' | 'In Progress' | 'Completed' | 'Cancelled' | string;
  priority?: 'Low' | 'Medium' | 'High' | string;
  dueDate?: string;
  createdAt?: string;
  requiredDocument?: 'cv' | 'passport' | 'picture' | 'drivingLicense' | string;
  completionNotes?: string;
  completionFiles?: TaskFile[];
  [k: string]: any;
};

export type Meeting = {
  _id: string;
  title?: string;
  status?: 'Scheduled' | 'Completed' | 'Canceled' | string;
  locationType?: 'Zoom' | 'Google Meet' | 'Microsoft Teams' | 'Phone' | 'Physical' | string;
  link?: string | null;
  location?: string | null;
  date?: string;
  time?: string;
  scheduledAt?: string | null;
  notes?: string;
  clientName?: string;
  candidateType?: 'B2C' | 'B2B' | string;
  managedCandidateId?: string | null;
  candidate?: {
    _id?: string | null;
    name?: string;
    email?: string;
    phone?: string | null;
    userType?: 'candidate' | 'managedCandidate' | string | null;
  };
  salesAdmin?: {
    _id?: string | null;
    name?: string;
    email?: string | null;
  };
  mainAdmin?: {
    _id?: string | null;
    name?: string;
    email?: string | null;
  };
  agent?: {
    _id?: string | null;
    name?: string;
    email?: string | null;
  };
  participants?: string[];
  createdAt?: string | null;
  updatedAt?: string | null;
  [k: string]: any;
};

export type UserDocument = {
  _id?: string;
  type?: 'photo' | 'passport' | 'drivingLicense' | 'cv' | string;
  url?: string;
  fileUrl?: string;
  originalName?: string;
  fileName?: string;
  mimeType?: string;
  size?: number;
  cloudinaryId?: string;
  uploadedAt?: string;
  [k: string]: any;
};

export type ManagedCandidate = {
  _id: string;
  name?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  ageRange?: string;
  country?: string;
  location?: string;
  profession?: string;
  qualification?: string;
  experience?: string;
  jobInterest?: string;
  categories?: string[];
  skills?: string[];
  aboutMe?: string;
  visaStatus?: string;
  status?: string;
  addedAt?: string;
  lastUpdated?: string;
  socialNetworks?: {
    linkedin?: string;
    github?: string;
    [k: string]: any;
  };
  documents?: UserDocument[];
  inquiries?: Inquiry[];
  appliedJobs?: Array<{ _id?: string; id?: string; [k: string]: any }>;
  savedJobs?: Array<{ _id?: string; id?: string; [k: string]: any }>;
  [k: string]: any;
};

export type DocumentGroups = {
  photo: UserDocument[];
  passport: UserDocument[];
  drivingLicense: UserDocument[];
  cv: UserDocument[];
};

export type ChatAdmin = {
  _id: string;
  name?: string;
  fullName?: string;
  email?: string;
  role?: string;
  [k: string]: any;
};

export type ChatMessage = {
  _id?: string;
  sender?: string;
  receiver?: string;
  message?: string;
  text?: string;
  createdAt?: string;
  attachmentUrl?: string;
  [k: string]: any;
};

export type AgentAnalyticsCurrentMetrics = {
  candidateMetrics?: {
    totalManaged?: number;
    newCandidatesThisMonth?: number;
    successfulPlacements?: number;
    activeCandidates?: number;
    [k: string]: any;
  };
  applicationMetrics?: {
    totalApplications?: number;
    approvedApplications?: number;
    pendingApplications?: number;
    rejectedApplications?: number;
    [k: string]: any;
  };
  performanceMetrics?: {
    placementSuccessRate?: number;
    responseRate?: number;
    clientSatisfactionScore?: number;
    [k: string]: any;
  };
  [k: string]: any;
};

export type AgentAnalyticsTrendPoint = {
  month?: string;
  label?: string;
  period?: string;
  applications?: number;
  placements?: number;
  candidates?: number;
  newCandidates?: number;
  [k: string]: any;
};

export type AgentAnalyticsCategoryBreakdown = {
  category?: string;
  name?: string;
  applications?: number;
  placements?: number;
  successRate?: number;
  [k: string]: any;
};

export type AgentAnalyticsDashboard = {
  currentMetrics?: AgentAnalyticsCurrentMetrics;
  monthlyTrends?: AgentAnalyticsTrendPoint[];
  performanceComparison?: {
    growth?: {
      candidates?: number;
      applications?: number;
      placements?: number;
      successRate?: number;
      [k: string]: any;
    };
    [k: string]: any;
  };
  jobCategoryBreakdown?: AgentAnalyticsCategoryBreakdown[];
  lastUpdated?: string;
  [k: string]: any;
};
