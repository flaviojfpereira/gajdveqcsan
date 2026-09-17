import React, { useState, useEffect } from 'react';
import { HeaderBanner } from './components/HeaderBanner.js';
import { SummaryCard } from './components/SummaryCard.js';
import { CalendarSchedule } from './components/CalendarSchedule.js';
import { LoginModal } from './components/LoginModal.js';
import { TeamDrawModal } from './components/TeamDrawModal.js';
import { Shoutbox } from './components/Shoutbox.js';
import { AudioPlayer } from './components/AudioPlayer.js';
import type { AppState, User, Vote, VoteStatus, TeamDistribution } from './types.js';
import { getDefaultAppState } from './utils/calendarGenerator.js';
import {
  subscribeToFirestore,
  setVoteInFirestore,
  setBulkVotesInFirestore,
  addCommentInFirestore,
  registerUserInFirestore,
  saveTeamInFirestore,
  userIdFromName,
  type SyncStatus
} from './lib/firebase.js';

function getInitialState(): AppState {
  return getDefaultAppState();
}

export default function App() {
  const [state, setState] = useState<AppState>(getInitialState);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [pendingVote, setPendingVote] = useState<{
    dateStr: string;
    slotId: string;
    status: VoteStatus | 'none';
  } | null>(null);
  const [pendingComment, setPendingComment] = useState<string | null>(null);
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('connecting');
  const [syncError, setSyncError] = useState<string | null>(null);

  const [teamModalData, setTeamModalData] = useState<{
    isOpen: boolean;
    dateStr: string;
    slotId: string;
  }>({
    isOpen: false,
    dateStr: '',
    slotId: ''
  });

  useEffect(() => {
    try {
      localStorage.removeItem('gajdveqcsan_user');
      localStorage.removeItem('gajdveqcsan_explicit_login');
      localStorage.removeItem('gajdveqcsan_cached_state');
    } catch {
      // ignore
    }
    setCurrentUser(null);
  }, []);

  useEffect(() => {
    const unsub = subscribeToFirestore({
      onVotes: votes => {
        setState(prev => ({ ...prev, votes }));
      },
      onComments: comments => {
        setState(prev => ({ ...prev, comments }));
      },
      onUsers: users => {
        setState(prev => {
          const byId = new Map<string, User>();
          for (const u of users) byId.set(u.id, u);
          if (!byId.has('u_flavio')) {
            const flavio = prev.users.find(u => u.id === 'u_flavio');
            if (flavio) byId.set(flavio.id, flavio);
          }
          return { ...prev, users: Array.from(byId.values()) };
        });
      },
      onTeams: teams => {
        setState(prev => ({ ...prev, teams }));
      },
      onStatus: (status, message) => {
        setSyncStatus(status);
        setSyncError(status === 'error' ? message || 'Falha a ligar ao storage partilhado' : null);
      }
    });
    return () => unsub();
  }, []);

  const executeVote = async (user: User, dateStr: string, slotId: string, status: VoteStatus | 'none') => {
    setState(prev => {
      const votes = [...prev.votes];
      const idx = votes.findIndex(
        v => v.userId === user.id && v.dateStr === dateStr && v.slotId === slotId
      );

      if (status === 'none') {
        if (idx !== -1) votes.splice(idx, 1);
      } else {
        const newVote: Vote = {
          id: idx !== -1 ? votes[idx].id : `v_${user.id}_${dateStr}_${slotId}`,
          userId: user.id,
          userName: user.name,
          dateStr,
          slotId,
          status,
          updatedAt: new Date().toISOString()
        };
        if (idx !== -1) votes[idx] = newVote;
        else votes.push(newVote);
      }
      return { ...prev, votes };
    });

    try {
      await setVoteInFirestore(user, dateStr, slotId, status);
    } catch (err) {
      console.warn('Firestore vote write failed:', err);
      setSyncStatus('error');
      setSyncError(err instanceof Error ? err.message : 'Não foi possível gravar o voto');
    }
  };

  const handleLogin = async (name: string, _password?: string): Promise<boolean> => {
    const cleanName = name.trim();
    if (!cleanName) return false;

    const loggedUser: User = {
      id: userIdFromName(cleanName),
      name: cleanName,
      avatarSeed: cleanName.toLowerCase().replace(/\s+/g, '_'),
      createdAt: new Date().toISOString()
    };

    const existing = state.users.find(
      u => u.id === loggedUser.id || u.name.toLowerCase() === cleanName.toLowerCase()
    );
    if (existing) {
      loggedUser.id = existing.id;
      loggedUser.name = existing.name;
      loggedUser.avatarSeed = existing.avatarSeed;
      loggedUser.createdAt = existing.createdAt;
    }

    setCurrentUser(loggedUser);
    setState(prev => {
      if (prev.users.some(u => u.id === loggedUser.id)) return prev;
      return { ...prev, users: [...prev.users, loggedUser] };
    });

    try {
      await registerUserInFirestore(loggedUser);
    } catch (err) {
      console.warn('Firestore user write failed:', err);
    }

    if (pendingVote) {
      await executeVote(loggedUser, pendingVote.dateStr, pendingVote.slotId, pendingVote.status);
      setPendingVote(null);
    }

    if (pendingComment) {
      await executeAddComment(loggedUser, pendingComment);
      setPendingComment(null);
    }

    return true;
  };

  const handleLogout = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem('gajdveqcsan_user');
      localStorage.removeItem('gajdveqcsan_explicit_login');
    } catch {
      // ignore
    }
  };

  const handleVote = async (dateStr: string, slotId: string, status: VoteStatus | 'none') => {
    if (!currentUser) {
      setPendingVote({ dateStr, slotId, status });
      setIsLoginOpen(true);
      return;
    }

    await executeVote(currentUser, dateStr, slotId, status);
  };

  const handleBulkVote = async (updates: { dateStr: string; slotId: string; status: VoteStatus | 'none' }[]) => {
    if (!currentUser) {
      setIsLoginOpen(true);
      return;
    }

    setState(prev => {
      const votes = [...prev.votes];
      for (const item of updates) {
        const idx = votes.findIndex(
          v => v.userId === currentUser.id && v.dateStr === item.dateStr && v.slotId === item.slotId
        );
        if (item.status === 'none') {
          if (idx !== -1) votes.splice(idx, 1);
        } else {
          const vote: Vote = {
            id: idx !== -1 ? votes[idx].id : `v_${currentUser.id}_${item.dateStr}_${item.slotId}`,
            userId: currentUser.id,
            userName: currentUser.name,
            dateStr: item.dateStr,
            slotId: item.slotId,
            status: item.status,
            updatedAt: new Date().toISOString()
          };
          if (idx !== -1) votes[idx] = vote;
          else votes.push(vote);
        }
      }
      return { ...prev, votes };
    });

    try {
      await setBulkVotesInFirestore(currentUser, updates);
    } catch (err) {
      console.warn('Firestore bulk vote write failed:', err);
      setSyncStatus('error');
      setSyncError(err instanceof Error ? err.message : 'Não foi possível gravar os votos');
    }
  };

  const executeAddComment = async (user: User, text: string): Promise<boolean> => {
    const cleanText = text.trim();
    if (!cleanText) return false;

    const newComment = {
      id: `c_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: user.id,
      userName: user.name,
      text: cleanText,
      createdAt: new Date().toISOString()
    };

    setState(prev => ({
      ...prev,
      comments: [newComment, ...prev.comments].slice(0, 100)
    }));

    try {
      await addCommentInFirestore(user, cleanText);
    } catch (err) {
      console.warn('Firestore comment write failed:', err);
      setSyncStatus('error');
      setSyncError(err instanceof Error ? err.message : 'Não foi possível gravar o comentário');
    }
    return true;
  };

  const handleAddComment = async (text: string): Promise<boolean> => {
    if (!currentUser) {
      setPendingComment(text);
      setIsLoginOpen(true);
      return false;
    }
    return executeAddComment(currentUser, text);
  };

  const handleShuffleTeams = async (dateStr: string, slotId: string): Promise<TeamDistribution | null> => {
    const confirmedVotes = state.votes.filter(
      v => v.dateStr === dateStr && v.slotId === slotId && v.status === 'yes'
    );
    const confirmedUsers = confirmedVotes.map(v => v.userName);
    const fallbackRoles = ['Entry Fragger', 'AWP Sniper', 'IGL Capitão', 'Lurker', 'Support'];
    const shuffled = [...confirmedUsers].sort(() => 0.5 - Math.random());

    const ctMembers = shuffled.slice(0, 5);
    const tMembers = shuffled.slice(5, 10);

    while (ctMembers.length < 5) ctMembers.push(`Bot Alpha ${ctMembers.length + 1}`);
    while (tMembers.length < 5) tMembers.push(`Bot Bravo ${tMembers.length + 1}`);

    const localDistribution: TeamDistribution = {
      dateStr,
      slotId,
      ctTeam: ctMembers.map((name, i) => ({ name, role: fallbackRoles[i % fallbackRoles.length] })),
      tTeam: tMembers.map((name, i) => ({ name, role: fallbackRoles[i % fallbackRoles.length] })),
      createdAt: new Date().toISOString()
    };

    setState(prev => ({
      ...prev,
      teams: {
        ...prev.teams,
        [`${dateStr}_${slotId}`]: localDistribution
      }
    }));

    try {
      await saveTeamInFirestore(localDistribution);
    } catch (err) {
      console.warn('Firestore team write failed:', err);
    }
    return localDistribution;
  };

  const handleOpenTeamModal = (dateStr: string, slotId: string) => {
    setTeamModalData({
      isOpen: true,
      dateStr,
      slotId
    });
  };

  const uniqueVoterIds = new Set(state.votes.map(v => v.userId));
  const totalVotersCount = Math.max(state.users.length, uniqueVoterIds.size);

  const activeDaySchedule = state.days.find(d => d.dateStr === teamModalData.dateStr);
  const activeConfirmedVotes = state.votes.filter(
    v => v.dateStr === teamModalData.dateStr && v.slotId === teamModalData.slotId && v.status === 'yes'
  );
  const activeSavedTeams = state.teams[`${teamModalData.dateStr}_${teamModalData.slotId}`];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans pb-16">
      <HeaderBanner
        currentUser={currentUser}
        onLogout={handleLogout}
        onOpenLogin={() => setIsLoginOpen(true)}
        totalVotersCount={totalVotersCount}
      />

      {syncStatus !== 'live' && (
        <div
          className={`w-full text-center text-xs py-1.5 px-3 font-semibold ${
            syncStatus === 'error'
              ? 'bg-red-950 text-red-300 border-b border-red-800'
              : 'bg-amber-950 text-amber-300 border-b border-amber-800'
          }`}
        >
          {syncStatus === 'connecting'
            ? 'A ligar ao storage partilhado…'
            : `Storage partilhado offline. Votos deste browser não passam para os outros. ${syncError || ''}`}
        </div>
      )}

      <main className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6 flex-1">
        <SummaryCard
          days={state.days}
          votes={state.votes}
          currentUser={currentUser}
          onSelectDate={dateStr => setSelectedDateStr(dateStr)}
          onOpenTeamModal={handleOpenTeamModal}
          onOpenLogin={() => setIsLoginOpen(true)}
          onQuickVote={(dateStr, slotId, status) => handleVote(dateStr, slotId, status)}
        />

        <CalendarSchedule
          days={state.days}
          votes={state.votes}
          currentUser={currentUser}
          onVote={handleVote}
          onBulkVote={handleBulkVote}
          onOpenLogin={() => setIsLoginOpen(true)}
          onOpenTeamModal={handleOpenTeamModal}
          selectedDateStr={selectedDateStr}
        />

        <Shoutbox
          comments={state.comments}
          currentUser={currentUser}
          onAddComment={handleAddComment}
          onOpenLogin={() => setIsLoginOpen(true)}
        />
      </main>

      <footer className="w-full text-center py-6 text-xs text-slate-500 border-t border-slate-900 mt-12">
        <p className="font-gaming uppercase tracking-wider text-slate-400">
          Meninos • GAJDVEQCSAN • Grupo de Amigos que joga de vez em quando CS à noite
        </p>
        <p className="text-[11px] mt-1 text-slate-600">
          Reunião de velhos amigos para recordar o 5v5 no Counter-Strike.
        </p>
      </footer>

      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onLogin={handleLogin}
        existingUsers={state.users}
      />

      <TeamDrawModal
        isOpen={teamModalData.isOpen}
        onClose={() => setTeamModalData(prev => ({ ...prev, isOpen: false }))}
        dateStr={teamModalData.dateStr}
        slotId={teamModalData.slotId}
        daySchedule={activeDaySchedule}
        confirmedVotes={activeConfirmedVotes}
        savedTeams={activeSavedTeams}
        onShuffleTeams={handleShuffleTeams}
      />

      <AudioPlayer
        songTitle="Para os Meus Ninjas"
        artist="GAJDVEQCSAN Hino"
      />
    </div>
  );
}
