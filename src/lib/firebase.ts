import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  writeBatch,
  enableIndexedDbPersistence
} from 'firebase/firestore';
import type { Vote, User, Comment, TeamDistribution, VoteStatus } from '../types.js';

export const firebaseConfig = {
  projectId: 'boreal-agency-wpthm',
  appId: '1:319451236025:web:05a46cde88060330ffbd68',
  apiKey: 'AIzaSyB9BtNl7-djmsvCAfKjCKnTOGsWGunBaoU',
  authDomain: 'boreal-agency-wpthm.firebaseapp.com',
  firestoreDatabaseId: 'ai-studio-gajdveqcsan5v5cs-64e39e14-55f4-4473-aafa-2ceb3b9eb0da',
  storageBucket: 'boreal-agency-wpthm.firebasestorage.app',
  messagingSenderId: '319451236025'
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

try {
  enableIndexedDbPersistence(db).catch(() => {
    // Multiple tabs or unsupported browser — live network still works.
  });
} catch {
  // ignore
}

export function userIdFromName(name: string): string {
  const normalized = name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized ? `u_${normalized}` : `u_anon`;
}

export function getVoteDocId(userId: string, dateStr: string, slotId: string): string {
  const cleanUser = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanDate = dateStr.replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanSlot = slotId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${cleanUser}___${cleanDate}___${cleanSlot}`;
}

export function getTeamDocId(dateStr: string, slotId: string): string {
  return `${dateStr.replace(/[^a-zA-Z0-9_-]/g, '_')}___${slotId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

export async function setVoteInFirestore(
  user: User,
  dateStr: string,
  slotId: string,
  status: VoteStatus | 'none'
): Promise<void> {
  const docId = getVoteDocId(user.id, dateStr, slotId);
  const voteRef = doc(db, 'votes', docId);

  if (status === 'none') {
    await deleteDoc(voteRef);
  } else {
    const voteData: Vote = {
      id: docId,
      userId: user.id,
      userName: user.name,
      dateStr,
      slotId,
      status,
      updatedAt: new Date().toISOString()
    };
    await setDoc(voteRef, voteData, { merge: true });
  }

  await registerUserInFirestore(user);
}

export async function setBulkVotesInFirestore(
  user: User,
  updates: { dateStr: string; slotId: string; status: VoteStatus | 'none' }[]
): Promise<void> {
  const batch = writeBatch(db);

  for (const item of updates) {
    const docId = getVoteDocId(user.id, item.dateStr, item.slotId);
    const voteRef = doc(db, 'votes', docId);

    if (item.status === 'none') {
      batch.delete(voteRef);
    } else {
      const voteData: Vote = {
        id: docId,
        userId: user.id,
        userName: user.name,
        dateStr: item.dateStr,
        slotId: item.slotId,
        status: item.status,
        updatedAt: new Date().toISOString()
      };
      batch.set(voteRef, voteData, { merge: true });
    }
  }

  await batch.commit();
  await registerUserInFirestore(user);
}

export async function addCommentInFirestore(user: User, text: string, dateStr?: string): Promise<void> {
  const commentId = `c_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const commentRef = doc(db, 'comments', commentId);

  const commentData: Comment = {
    id: commentId,
    userId: user.id,
    userName: user.name,
    text: text.trim().slice(0, 300),
    createdAt: new Date().toISOString(),
    ...(dateStr ? { dateStr } : {})
  };

  await setDoc(commentRef, commentData);
  await registerUserInFirestore(user);
}

export async function registerUserInFirestore(user: User): Promise<void> {
  const userRef = doc(db, 'users', user.id);
  await setDoc(
    userRef,
    {
      id: user.id,
      name: user.name,
      avatarSeed: user.avatarSeed || user.name.toLowerCase(),
      createdAt: user.createdAt || new Date().toISOString()
    },
    { merge: true }
  );
}

export async function saveTeamInFirestore(distribution: TeamDistribution): Promise<void> {
  const teamDocId = getTeamDocId(distribution.dateStr, distribution.slotId);
  const teamRef = doc(db, 'teams', teamDocId);

  await setDoc(teamRef, {
    ...distribution,
    updatedAt: new Date().toISOString()
  });
}

export type SyncStatus = 'connecting' | 'live' | 'error';

export function subscribeToFirestore(callbacks: {
  onVotes: (votes: Vote[]) => void;
  onComments: (comments: Comment[]) => void;
  onUsers: (users: User[]) => void;
  onTeams: (teamsMap: Record<string, TeamDistribution>) => void;
  onStatus?: (status: SyncStatus, message?: string) => void;
}) {
  callbacks.onStatus?.('connecting');

  const votesUnsub = onSnapshot(
    collection(db, 'votes'),
    snapshot => {
      const votes: Vote[] = [];
      snapshot.forEach(d => {
        const data = d.data() as Vote;
        if (data && data.userId && data.dateStr && data.status) {
          votes.push({ ...data, id: data.id || d.id });
        }
      });
      callbacks.onVotes(votes);
      callbacks.onStatus?.('live');
    },
    err => {
      console.warn('Firestore votes listener error:', err);
      callbacks.onStatus?.('error', err.message);
    }
  );

  const commentsQuery = query(collection(db, 'comments'), orderBy('createdAt', 'desc'), limit(100));
  let commentsUnsub = onSnapshot(
    commentsQuery,
    snapshot => {
      const comments: Comment[] = [];
      snapshot.forEach(d => {
        const data = d.data() as Comment;
        if (data && data.text) {
          comments.push({ ...data, id: data.id || d.id });
        }
      });
      callbacks.onComments(comments);
    },
    err => {
      console.warn('Firestore comments ordered listener error:', err);
      commentsUnsub = onSnapshot(
        collection(db, 'comments'),
        snapshot => {
          const comments: Comment[] = [];
          snapshot.forEach(d => {
            const data = d.data() as Comment;
            if (data && data.text) {
              comments.push({ ...data, id: data.id || d.id });
            }
          });
          comments.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
          callbacks.onComments(comments.slice(0, 100));
        },
        fallbackErr => {
          console.warn('Firestore comments fallback error:', fallbackErr);
        }
      );
    }
  );

  const usersUnsub = onSnapshot(
    collection(db, 'users'),
    snapshot => {
      const users: User[] = [];
      snapshot.forEach(d => {
        const data = d.data() as User;
        if (data && data.id && data.name) {
          users.push(data);
        }
      });
      callbacks.onUsers(users);
    },
    err => {
      console.warn('Firestore users listener error:', err);
      callbacks.onStatus?.('error', err.message);
    }
  );

  const teamsUnsub = onSnapshot(
    collection(db, 'teams'),
    snapshot => {
      const teamsMap: Record<string, TeamDistribution> = {};
      snapshot.forEach(d => {
        const data = d.data() as TeamDistribution;
        if (data && data.dateStr && data.slotId) {
          teamsMap[`${data.dateStr}_${data.slotId}`] = data;
        }
      });
      callbacks.onTeams(teamsMap);
    },
    err => {
      console.warn('Firestore teams listener error:', err);
    }
  );

  return () => {
    votesUnsub();
    commentsUnsub();
    usersUnsub();
    teamsUnsub();
  };
}
