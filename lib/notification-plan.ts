import { REMINDER_KEYS, type NotificationSettings, type ReminderKey, type Weekday } from './notification-settings';
import {
  addCalendarDays,
  getZonedDay,
  isoWeekday,
  mondayEpochDay,
  toEpochDay,
  zonedTimeToDate,
} from './zoned-time';

export const NOTIFICATION_ID_PREFIX = 'fairwayiq.';

export const NOTIFICATION_IDS: Record<ReminderKey, string> = {
  weeklyPlan: `${NOTIFICATION_ID_PREFIX}weekly-plan`,
  playReminder: `${NOTIFICATION_ID_PREFIX}play-reminder`,
  streakAtRisk: `${NOTIFICATION_ID_PREFIX}streak-at-risk`,
  practiceReminder: `${NOTIFICATION_ID_PREFIX}practice-reminder`,
};

export const STREAK_MIN_DAYS = 2;
export const STREAK_REMINDER_TIME = { hour: 18, minute: 30 } as const;
export const WEEKLY_PLAN_SLOT = { weekday: 1, hour: 8, minute: 0 } as const;

export type NotificationType = 'weekly_plan' | 'play_reminder' | 'streak_at_risk' | 'practice_reminder';

export type PlannedTrigger =
  | { type: 'weekly'; weekday: Weekday; hour: number; minute: number }
  | { type: 'date'; date: Date };

export type PlannedNotification = {
  kind: ReminderKey;
  identifier: string;
  title: string;
  body: string;
  data: { type: NotificationType };
  trigger: PlannedTrigger;
};

export type NotificationPlan = {
  schedule: PlannedNotification[];
  cancel: string[];
};

export type PlanContext = {
  streak: number;
  lastDrillAt: Date | string | null;
  now: Date;
  timeZone: string;
};

function toValidDate(value: Date | string | null): Date | null {
  if (value === null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function nextWeeklyOccurrence(now: Date, weekday: Weekday, hour: number, timeZone: string) {
  const today = getZonedDay(now, timeZone);
  let day = addCalendarDays(today, (weekday - isoWeekday(today) + 7) % 7);
  let date = zonedTimeToDate(day, { hour, minute: 0 }, timeZone);

  if (date.getTime() <= now.getTime()) {
    day = addCalendarDays(day, 7);
    date = zonedTimeToDate(day, { hour, minute: 0 }, timeZone);
  }

  return { day, date };
}

function planWeeklyPlan(): PlannedNotification {
  return {
    kind: 'weeklyPlan',
    identifier: NOTIFICATION_IDS.weeklyPlan,
    title: 'Ton plan de la semaine est prêt',
    body: 'Ouvre FairwayIQ pour voir les exercices de la semaine.',
    data: { type: 'weekly_plan' },
    trigger: { type: 'weekly', ...WEEKLY_PLAN_SLOT },
  };
}

function planPlayReminder(settings: NotificationSettings): PlannedNotification {
  const { weekday, hour } = settings.playReminder;

  return {
    kind: 'playReminder',
    identifier: NOTIFICATION_IDS.playReminder,
    title: 'Tu joues aujourd’hui ?',
    body: 'Enregistre ton round trou par trou pour obtenir un diagnostic plus précis.',
    data: { type: 'play_reminder' },
    trigger: { type: 'weekly', weekday, hour, minute: 0 },
  };
}

function planStreakAtRisk(context: PlanContext): PlannedNotification | null {
  const { streak, now, timeZone } = context;
  if (!(streak >= STREAK_MIN_DAYS)) return null;

  const today = getZonedDay(now, timeZone);
  const lastDrillAt = toValidDate(context.lastDrillAt);
  const doneToday = lastDrillAt !== null && toEpochDay(getZonedDay(lastDrillAt, timeZone)) === toEpochDay(today);
  const date = zonedTimeToDate(doneToday ? addCalendarDays(today, 1) : today, STREAK_REMINDER_TIME, timeZone);

  if (date.getTime() <= now.getTime()) return null;

  return {
    kind: 'streakAtRisk',
    identifier: NOTIFICATION_IDS.streakAtRisk,
    title: `Série de ${streak} jours en cours`,
    body: 'Un exercice aujourd’hui la prolonge.',
    data: { type: 'streak_at_risk' },
    trigger: { type: 'date', date },
  };
}

function planPracticeReminder(settings: NotificationSettings, context: PlanContext): PlannedNotification {
  const { weekday, hour } = settings.practiceReminder;
  const { now, timeZone } = context;
  const lastDrillAt = toValidDate(context.lastDrillAt);
  let { day, date } = nextWeeklyOccurrence(now, weekday, hour, timeZone);

  const alreadyPracticedThatWeek =
    lastDrillAt !== null && mondayEpochDay(getZonedDay(lastDrillAt, timeZone)) === mondayEpochDay(day);
  if (alreadyPracticedThatWeek) {
    day = addCalendarDays(day, 7);
    date = zonedTimeToDate(day, { hour, minute: 0 }, timeZone);
  }

  return {
    kind: 'practiceReminder',
    identifier: NOTIFICATION_IDS.practiceReminder,
    title: 'Un exercice cette semaine ?',
    body: 'Choisis-en un dans ton plan : une séance courte suffit pour avancer.',
    data: { type: 'practice_reminder' },
    trigger: { type: 'date', date },
  };
}

export function planNotifications(settings: NotificationSettings, context: PlanContext): NotificationPlan {
  const planners: Record<ReminderKey, () => PlannedNotification | null> = {
    weeklyPlan: planWeeklyPlan,
    playReminder: () => planPlayReminder(settings),
    streakAtRisk: () => planStreakAtRisk(context),
    practiceReminder: () => planPracticeReminder(settings, context),
  };

  const schedule: PlannedNotification[] = [];
  const cancel: string[] = [];

  for (const key of REMINDER_KEYS) {
    const planned = settings.enabled && settings[key].enabled ? planners[key]() : null;
    if (planned) {
      schedule.push(planned);
    } else {
      cancel.push(NOTIFICATION_IDS[key]);
    }
  }

  return { schedule, cancel };
}
