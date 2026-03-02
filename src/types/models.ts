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
