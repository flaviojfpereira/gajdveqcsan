export type VoteStatus = 'yes' | 'maybe' | 'no';

export interface User {
  id: string;
  name: string;
  avatarSeed: string;
  createdAt: string;
}

export interface Vote {
  id: string;
  userId: string;
  userName: string;
  dateStr: string; // YYYY-MM-DD
  slotId: string;  // e.g. "night-21h30"
  status: VoteStatus;
  updatedAt: string;
}

export interface TimeSlot {
  id: string;
  label: string;
  time: string;
}

export interface DaySchedule {
  dateStr: string;
  dayOfWeek: string;
  formattedDate: string;
  isWeekend: boolean;
  slots: TimeSlot[];
}

export interface Comment {
  id: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
  dateStr?: string;
}

export interface TeamDistribution {
  dateStr: string;
  slotId: string;
  ctTeam: { name: string; role: string }[];
  tTeam: { name: string; role: string }[];
  createdAt: string;
}

export interface AppState {
  users: User[];
  days: DaySchedule[];
  votes: Vote[];
  comments: Comment[];
  teams: Record<string, TeamDistribution>; // key: `${dateStr}_${slotId}`
}
