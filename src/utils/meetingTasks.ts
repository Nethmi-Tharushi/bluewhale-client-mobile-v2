import dayjs from 'dayjs';
import type { Meeting, Task } from '../types/models';

const pickText = (item: any, keys: string[]) => {
  for (const key of keys) {
    const value = String(item?.[key] || '').trim();
    if (value) return value;
  }
  return '';
};

const pickNestedText = (item: any, keys: string[]) => {
  for (const key of keys) {
    const value = key
      .split('.')
      .reduce<any>((acc, segment) => (acc && typeof acc === 'object' ? acc[segment] : undefined), item);
    const text = String(value || '').trim();
    if (text) return text;
  }
  return '';
};

const normalizeMeetingStatus = (status?: string): Meeting['status'] => {
  const value = String(status || '').trim().toLowerCase();
  if (value === 'completed') return 'Completed';
  if (value === 'cancelled' || value === 'canceled') return 'Canceled';
  return 'Scheduled';
};

const inferLocationType = (task: Task) => {
  const explicit = pickText(task, ['locationType', 'meetingType', 'meetingMode', 'mode']);
  if (explicit) return explicit;
  const link = pickText(task, ['link', 'meetingLink', 'meetingUrl', 'url']);
  if (link) return 'Zoom';
  const location = pickText(task, ['location', 'meetingLocation', 'address']);
  if (location) return 'Physical';
  return 'Phone';
};

const getMeetingIdentityKey = (meeting: Meeting) => {
  const id = String(meeting?._id || '').trim();
  if (id) return `id:${id}`;
  const title = String(meeting?.title || '').trim().toLowerCase();
  const date = String(meeting?.date || '').trim().toLowerCase();
  const time = String(meeting?.time || '').trim().toLowerCase();
  return `meta:${title}|${date}|${time}`;
};

export const isMeetingTask = (task?: Task | null) => String(task?.type || '').trim().toLowerCase() === 'meeting';

export const isTaskDerivedMeeting = (meeting?: Meeting | null) =>
  Boolean(meeting?.sourceTaskId || String(meeting?._id || '').trim().startsWith('task-meeting-'));

export const getMeetingScheduledAt = (meeting?: Meeting | null) => {
  const direct = String(meeting?.scheduledAt || '').trim();
  if (direct) return direct;

  const taskSource = meeting?.sourceTask;
  const dueDate = String(taskSource?.dueDate || '').trim();
  if (dueDate) return dueDate;

  const rawDate = String(meeting?.date || '').trim();
  if (rawDate && dayjs(rawDate).isValid()) return dayjs(rawDate).toISOString();

  return '';
};

export const getMeetingDisplayDate = (meeting?: Meeting | null) => {
  const scheduledAt = getMeetingScheduledAt(meeting);
  if (scheduledAt && dayjs(scheduledAt).isValid()) return dayjs(scheduledAt).format('MMM D, YYYY');

  const rawDate = String(meeting?.date || '').trim();
  if (!rawDate) return 'N/A';
  if (dayjs(rawDate).isValid()) return dayjs(rawDate).format('MMM D, YYYY');
  return rawDate;
};

export const getMeetingDisplayTime = (meeting?: Meeting | null) => {
  const rawTime = String(meeting?.time || '').trim();
  if (rawTime) return rawTime;

  const scheduledAt = getMeetingScheduledAt(meeting);
  if (scheduledAt && dayjs(scheduledAt).isValid()) return dayjs(scheduledAt).format('hh:mm A');

  return 'N/A';
};

export const getMeetingContactName = (meeting?: Meeting | null) =>
  pickNestedText(meeting, ['candidate.name', 'clientName']);

export const getMeetingNotes = (meeting?: Meeting | null) => {
  const notes = String(meeting?.notes || '').trim();
  if (notes) return notes;

  const taskSource = meeting?.sourceTask;
  return pickText(taskSource, ['description', 'notes', 'meetingNotes']);
};

export const meetingFromTask = (task: Task): Meeting => {
  const taskId = String(task?._id || task?.id || task?.title || Date.now()).trim();
  const scheduledAt = pickText(task, ['scheduledAt', 'dateTime', 'dueDate', 'startTime']);
  const dateLabel = scheduledAt && dayjs(scheduledAt).isValid() ? dayjs(scheduledAt).format('YYYY-MM-DD') : pickText(task, ['date', 'meetingDate', 'dueDate']);
  const timeLabel = scheduledAt && dayjs(scheduledAt).isValid() ? dayjs(scheduledAt).format('hh:mm A') : pickText(task, ['time', 'meetingTime', 'scheduledTime', 'startTime']);
  return {
    _id: `task-meeting-${taskId}`,
    title: pickText(task, ['title']) || 'Meeting',
    status: normalizeMeetingStatus(task?.status),
    locationType: inferLocationType(task),
    link: pickText(task, ['link', 'meetingLink', 'meetingUrl', 'url']) || null,
    location: pickText(task, ['location', 'meetingLocation', 'address']) || null,
    date: dateLabel,
    time: timeLabel,
    scheduledAt: scheduledAt || null,
    notes: pickText(task, ['notes', 'description', 'meetingNotes']),
    clientName: pickText(task, ['clientName', 'assigneeName', 'ownerName']),
    participants: Array.isArray((task as any)?.participants) ? (task as any).participants : [],
    sourceTaskId: taskId,
    sourceTask: task,
  } as Meeting;
};

export const mergeMeetingsWithTaskMeetings = (meetings: Meeting[], tasks: Task[]) => {
  const merged = Array.isArray(meetings) ? [...meetings] : [];
  const seen = new Set(merged.map((meeting) => getMeetingIdentityKey(meeting)));

  for (const task of Array.isArray(tasks) ? tasks : []) {
    if (!isMeetingTask(task)) continue;
    const derivedMeeting = meetingFromTask(task);
    const keys = [
      getMeetingIdentityKey(derivedMeeting),
      `meta:${String(derivedMeeting.title || '').trim().toLowerCase()}|${String(derivedMeeting.date || '').trim().toLowerCase()}|${String(derivedMeeting.time || '').trim().toLowerCase()}`,
    ];
    if (keys.some((key) => seen.has(key))) continue;
    merged.push(derivedMeeting);
    keys.forEach((key) => seen.add(key));
  }

  return merged;
};
