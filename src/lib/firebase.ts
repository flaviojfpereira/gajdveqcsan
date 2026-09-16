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
  writeBatch
} from 'firebase/firestore';
import type { Vote, User, Comment, TeamAssignment, VoteStatus } from '../types.js';

export const firebaseConfig = {
  projectId: "boreal-agency-wpthm",
  appId: "1:319451236025:web:05a46cde88060330ffbd68",
  apiKey: "AIzaSyB9BtNl7-djmsvCAfKjCKnTOGsWGunBaoU",
  authDomain: "boreal-agency-wpthm.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-gajdveqcsan5v5cs-64e39e14-55f4-4473-aafa-2ceb3b9eb0da",
  storageBucket: "boreal-agency-wpthm.firebasestorage.app",
  messagingSenderId: "319451236025"
};

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore targeting the provisioned database
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

/**
 * Generate standard deterministic vote doc ID: `${userId}_${dateStr}_${slotId}`
 */
export function getVoteDocId(userId: string, dateStr: string, slotId: string): string {
  const cleanUser = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanDate = dateStr.replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanSlot = slotId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${cleanUser}___${cleanDate}___${cleanSlot}`;
}

/**
 * Save or update a vote in Firestore
 */
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

  // Also ensure user profile exists in Firestore
  await registerUserInFirestore(user);
}

/**
 * Bulk save or clear votes
 */
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

/**
 * Save a new comment to Firestore
 */
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

/**
 * Register or update a user profile in Firestore
 */
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

/**
 * Save team assignments in Firestore
 */
export async function saveTeamInFirestore(
  dateStr: string,
  slotId: string,
  teams: TeamAssignment
): Promise<void> {
  const teamDocId = `${dateStr.replace(/[^a-zA-Z0-9_-]/g, '_')}___${slotId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  const teamRef = doc(db, 'teams', teamDocId);

  await setDoc(teamRef, {
    dateStr,
    slotId,
    ct: teams.ct || [],
    tr: teams.tr || [],
    spectators: teams.spectators || [],
    updatedAt: new Date().toISOString()
  });
}

/**
 * Real-time subscribers for Firestore collections
 */
export function subscribeToFirestore(callbacks: {
  onVotes: (votes: Vote[]) => void;
  onComments: (comments: Comment[]) => void;
  onUsers: (users: User[]) => void;
  onTeams: (teamsMap: Record<string, TeamAssignment>) => void;
}) {
  // 1. Votes live listener
  const votesUnsub = onSnapshot(
    collection(db, 'votes'),
    (snapshot) => {
      const votes: Vote[] = [];
      snapshot.forEach((d) => {
        const data = d.data() as Vote;
        if (data && data.userId && data.dateStr && data.status) {
          votes.push(data);
        }
      });
      callbacks.onVotes(votes);
    },
    (err) => {
      console.warn('Firestore votes listener error:', err);
    }
  );

  // 2. Comments live listener
  const commentsQuery = query(collection(db, 'comments'), orderBy('createdAt', 'desc'), limit(100));
  const commentsUnsub = onSnapshot(
    commentsQuery,
    (snapshot) => {
      const comments: Comment[] = [];
      snapshot.forEach((d) => {
        const data = d.data() as Comment;
        if (data && data.text) {
          comments.push(data);
        }
      });
      callbacks.onComments(comments);
    },
    (err) => {
      console.warn('Firestore comments listener error:', err);
    }
  );

  // 3. Users live listener
  const usersUnsub = onSnapshot(
    collection(db, 'users'),
    (snapshot) => {
      const users: User[] = [];
      snapshot.forEach((d) => {
        const data = d.data() as User;
        if (data && data.id && data.name) {
          users.push(data);
        }
      });
      callbacks.onUsers(users);
    },
    (err) => {
      console.warn('Firestore users listener error:', err);
    }
  );

  // 4. Teams live listener
  const teamsUnsub = onSnapshot(
    collection(db, 'teams'),
    (snapshot) => {
      const teamsMap: Record<string, TeamAssignment> = {};
      snapshot.forEach((d) => {
        const data = d.data() as { dateStr: string; slotId: string; ct: string[]; tr: string[]; spectators: string[] };
        if (data && data.dateStr && data.slotId) {
          const key = `${data.dateStr}_${data.slotId}`;
          teamsMap[key] = {
            ct: data.ct || [],
            tr: data.tr || [],
            spectators: data.spectators || []
          };
        }
      });
      callbacks.onTeams(teamsMap);
    },
    (err) => {
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

// Test connection to Firestore
export async function testFirestoreConnection() {
  try {
    const { getDocFromServer } = await import('firebase/firestore');
    await getDocFromServer(doc(db, 'system', 'ping'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Firestore connection notice: client is running offline or reconnecting.");
    }
  }
}
testFirestoreConnection();
