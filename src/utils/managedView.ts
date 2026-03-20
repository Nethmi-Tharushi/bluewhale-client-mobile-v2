import type { AuthUser } from '../context/authStore';
import type { ManagedCandidate } from '../types/models';

const pickString = (values: any[], fallback = '') => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return fallback;
};

export const getManagedCandidate = (user?: AuthUser | null): ManagedCandidate | null => {
  const candidate = user?.managedCandidate;
  return candidate && typeof candidate === 'object' ? (candidate as ManagedCandidate) : null;
};

export const getManagedCandidateId = (user?: AuthUser | null) =>
  String(getManagedCandidate(user)?._id || user?.managedCandidateId || user?.selectedManagedCandidateId || '').trim();

export const getManagedCandidateName = (user?: AuthUser | null) => {
  const candidate = getManagedCandidate(user);
  return pickString([
    candidate?.name,
    `${String(candidate?.firstname || '').trim()} ${String(candidate?.lastname || '').trim()}`.trim(),
    candidate?.email,
  ], 'Managed candidate');
};

export const isManagedViewActive = (user?: AuthUser | null) =>
  Boolean(user?.isManagedView || user?.managedView || getManagedCandidateId(user));

const compactManagedCandidate = (candidate: ManagedCandidate): ManagedCandidate => ({
  _id: candidate._id,
  name: candidate.name,
  email: candidate.email,
  phone: candidate.phone,
  firstname: candidate.firstname,
  lastname: candidate.lastname,
  dateOfBirth: candidate.dateOfBirth,
  gender: candidate.gender,
  ageRange: candidate.ageRange,
  address: candidate.address,
  location: candidate.location,
  country: candidate.country,
  profession: candidate.profession,
  qualification: candidate.qualification,
  experience: candidate.experience,
  jobInterest: candidate.jobInterest,
  categories: Array.isArray(candidate.categories) ? [...candidate.categories] : [],
  skills: Array.isArray(candidate.skills) ? [...candidate.skills] : [],
  aboutMe: candidate.aboutMe,
  visaStatus: candidate.visaStatus,
  status: candidate.status,
  addedAt: candidate.addedAt,
  lastUpdated: candidate.lastUpdated,
  documents: Array.isArray(candidate.documents) ? candidate.documents.map((item: any) => ({ ...item })) : [],
  inquiries: Array.isArray(candidate.inquiries) ? candidate.inquiries.map((item: any) => ({ ...item })) : [],
  savedJobs: Array.isArray(candidate.savedJobs) ? candidate.savedJobs.map((item: any) => ({ _id: item?._id, id: item?.id })) : [],
  appliedJobs: Array.isArray(candidate.appliedJobs) ? candidate.appliedJobs.map((item: any) => ({ _id: item?._id, id: item?.id, jobId: item?.jobId, job: item?.job })) : [],
  socialNetworks: candidate.socialNetworks ? { linkedin: candidate.socialNetworks.linkedin, github: candidate.socialNetworks.github } : undefined,
});

export const getManagedAppliedJobIds = (user?: AuthUser | null) => {
  const candidate = getManagedCandidate(user);
  const fromUser = Array.isArray(user?.managedAppliedJobs) ? user.managedAppliedJobs : [];
  const fromCandidate = Array.isArray(candidate?.appliedJobs) ? candidate.appliedJobs : [];
  return Array.from(
    new Set(
      [...fromUser, ...fromCandidate]
        .map((item: any) => item?._id || item?.id || item?.job?._id || item?.jobId || item?.job)
        .map((value: any) => String(value || '').trim())
        .filter(Boolean)
    )
  );
};

export const buildManagedViewUser = (user: AuthUser, candidate: ManagedCandidate): AuthUser => ({
  ...user,
  managedCandidate: compactManagedCandidate(candidate),
  managedCandidateId: candidate._id,
  selectedManagedCandidateId: candidate._id,
  managedAppliedJobs: getManagedAppliedJobIds({ managedCandidate: candidate, managedAppliedJobs: Array.isArray(candidate?.appliedJobs) ? candidate.appliedJobs : [] } as AuthUser),
  isManagedView: true,
  managedView: true,
});

export const stripManagedViewState = (user?: AuthUser | null): AuthUser => {
  const nextUser: AuthUser = { ...(user || {}) };
  delete nextUser.managedCandidate;
  delete nextUser.managedCandidateId;
  delete nextUser.selectedManagedCandidateId;
  delete nextUser.managedAppliedJobs;
  delete nextUser.isManagedView;
  delete nextUser.managedView;
  return nextUser;
};
