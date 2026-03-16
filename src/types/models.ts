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

export type Invoice = {
  _id: string;
  invoiceNumber?: string;
  status?: string;
  total?: number;
  currency?: string;
  dueDate?: string;
  items?: Array<{ name?: string; qty?: number; unitPrice?: number; total?: number }>;
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
  notes?: string;
  clientName?: string;
  candidate?: {
    name?: string;
    email?: string;
  };
  participants?: string[];
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
