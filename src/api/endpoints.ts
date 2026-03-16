/**
 * Central place to adjust backend routes.
 * Client mobile app uses user-side endpoints.
 */

export const Endpoints = {
  // Auth (Candidate/User)
  login: '/users/login',
  signup: '/users/signup',
  profile: '/users/profile',
  updateProfile: '/users/profile',
  userDocuments: '/users/documents',
  changePassword: '/users/change-password',
  deleteAccount: '/users/delete-account',

  // Optional password reset (your backend exposes /api/auth/forgot-password + /reset-password)
  forgotPassword: '/auth/forgot-password',
  resetPassword: '/auth/reset-password',

  // Jobs
  jobs: '/jobs',
  jobById: (id: string) => `/jobs/${id}`,

  // Applications
  applyJob: (jobId: string) => `/applications/${jobId}`,
  myApplications: '/applications',

  // Invoices
  myInvoices: '/sales-admin/invoices',
  invoiceById: (id: string) => `/sales-admin/invoices/${id}`,
  invoicePdf: (id: string) => `/users/invoices/${id}/pdf`,
  markPaid: (id: string) => `/sales-admin/invoices/${id}/mark-paid`,

  // Inquiries
  createInquiry: (jobId: string) => `/inquiries/${jobId}`,
  myInquiries: '/inquiries/my',
  allInquiries: '/inquiries',

  // Meetings
  meetings: '/meetings',

  // Chat
  chatAdmins: '/chats/admins',
  chatMessagesWithAdmin: (adminId: string) => `/chats/user/messages/${adminId}`,
  sendMessageToAdmin: (adminId: string) => `/chats/messages/${adminId}`,

  // Tasks
  tasks: '/tasks',
  taskComplete: (taskId: string) => `/tasks/${taskId}/complete`,
  uploadTaskFiles: '/tasks/upload/task-files',

  // Uploads
  upload: '/upload',

  // Wishlist
  wishlist: '/wishlist',
  wishlistAdd: (jobId: string) => `/wishlist/${jobId}`,
  wishlistRemove: (jobId: string) => `/wishlist/${jobId}`,
  wishlistCheck: (jobId: string) => `/wishlist/check/${jobId}`,
} as const;
