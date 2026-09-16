import React, { useState, useEffect } from 'react';
import { HeaderBanner } from './components/HeaderBanner.js';
import { SummaryCard } from './components/SummaryCard.js';
import { CalendarSchedule } from './components/CalendarSchedule.js';
import { LoginModal } from './components/LoginModal.js';
import { TeamDrawModal } from './components/TeamDrawModal.js';
import { Shoutbox } from './components/Shoutbox.js';
import { AudioPlayer } from './components/AudioPlayer.js';
import type { AppState, User, VoteStatus, TeamDistribution } from './types.js';

export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);

  // Team Modal State
  const [teamModalData, setTeamModalData] = useState<{
    isOpen: boolean;
    dateStr: string;
    slotId: string;
  }>({
    isOpen: false,
    dateStr: '',
    slotId: ''
  });

  // Load saved user from local storage; default to Flávio as requested
  useEffect(() => {
    try {
      const savedUserStr = localStorage.getItem('gajdveqcsan_user');
      if (savedUserStr) {
        const parsed = JSON.parse(savedUserStr);
        setCurrentUser(parsed);
      } else {
        const defaultUser: User = {
          id: 'u_flavio',
          name: 'Flávio',
          avatarSeed: 'flavio',
          createdAt: new Date().toISOString()
        };
        setCurrentUser(defaultUser);
        localStorage.setItem('gajdveqcsan_user', JSON.stringify(defaultUser));
      }
    } catch (e) {
      console.error('Failed to parse saved user:', e);
    }
  }, []);

  // Fetch initial state from server
  const fetchState = async () => {
    try {
      const res = await fetch('/api/state');
      if (res.ok) {
        const data: AppState = await res.json();
        setState(data);
      }
    } catch (err) {
      console.error('Error fetching state:', err);
    }
  };

  useEffect(() => {
    fetchState();
    // Poll every 10s to keep friends in sync
    const interval = setInterval(fetchState, 10000);
    return () => clearInterval(interval);
  }, []);

  // Handle simple login (name + password = same name)
  const handleLogin = async (name: string, password?: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, password: password || name })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setCurrentUser(data.user);
          localStorage.setItem('gajdveqcsan_user', JSON.stringify(data.user));
          await fetchState();
          return true;
        }
      }
    } catch (err) {
      console.error('Login error:', err);
    }
    return false;
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('gajdveqcsan_user');
  };

  // Vote on a specific slot with optimistic UI update
  const handleVote = async (dateStr: string, slotId: string, status: VoteStatus | 'none') => {
    if (!currentUser || !state) {
      setIsLoginOpen(true);
      return;
    }

    // Optimistic update
    setState(prev => {
      if (!prev) return prev;
      const votes = [...prev.votes];
      const idx = votes.findIndex(
        v => v.userId === currentUser.id && v.dateStr === dateStr && v.slotId === slotId
      );

      if (status === 'none') {
        if (idx !== -1) votes.splice(idx, 1);
      } else {
        const newVote = {
          id: idx !== -1 ? votes[idx].id : `v_${Date.now()}`,
          userId: currentUser.id,
          userName: currentUser.name,
          dateStr,
          slotId,
          status,
          updatedAt: new Date().toISOString()
        };
        if (idx !== -1) {
          votes[idx] = newVote;
        } else {
          votes.push(newVote);
        }
      }
      return { ...prev, votes };
    });

    try {
      await fetch('/api/votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          dateStr,
          slotId,
          status
        })
      });
    } catch (err) {
      console.error('Vote failed:', err);
      fetchState();
    }
  };

  // Bulk votes update (e.g. "Posso todas as sextas")
  const handleBulkVote = async (updates: { dateStr: string; slotId: string; status: VoteStatus | 'none' }[]) => {
    if (!currentUser || !state) {
      setIsLoginOpen(true);
      return;
    }

    try {
      const res = await fetch('/api/votes/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          updates
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.votes) {
          setState(prev => (prev ? { ...prev, votes: data.votes } : prev));
        }
      }
    } catch (err) {
      console.error('Bulk vote failed:', err);
      fetchState();
    }
  };

  // Add message to shoutbox
  const handleAddComment = async (text: string): Promise<boolean> => {
    if (!currentUser) {
      setIsLoginOpen(true);
      return false;
    }
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          text
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.comments) {
          setState(prev => (prev ? { ...prev, comments: data.comments } : prev));
          return true;
        }
      }
    } catch (err) {
      console.error('Comment error:', err);
    }
    return false;
  };

  // Shuffle teams for 5v5
  const handleShuffleTeams = async (dateStr: string, slotId: string): Promise<TeamDistribution | null> => {
    try {
      const res = await fetch('/api/teams/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dateStr, slotId })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.distribution) {
          setState(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              teams: {
                ...prev.teams,
                [`${dateStr}_${slotId}`]: data.distribution
              }
            };
          });
          return data.distribution;
        }
      }
    } catch (err) {
      console.error('Shuffle error:', err);
    }
    return null;
  };

  const handleOpenTeamModal = (dateStr: string, slotId: string) => {
    setTeamModalData({
      isOpen: true,
      dateStr,
      slotId
    });
  };

  if (!state) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-amber-400 font-bold font-gaming text-lg tracking-wider">
          A CARREGAR GAJDVEQCSAN...
        </p>
      </div>
    );
  }

  // Count unique voters
  const uniqueVoterIds = new Set(state.votes.map(v => v.userId));
  const totalVotersCount = Math.max(state.users.length, uniqueVoterIds.size);

  const activeDaySchedule = state.days.find(d => d.dateStr === teamModalData.dateStr);
  const activeConfirmedVotes = state.votes.filter(
    v => v.dateStr === teamModalData.dateStr && v.slotId === teamModalData.slotId && v.status === 'yes'
  );
  const activeSavedTeams = state.teams[`${teamModalData.dateStr}_${teamModalData.slotId}`];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans pb-16">
      {/* Header with Cartoon Image Banner */}
      <HeaderBanner
        currentUser={currentUser}
        onLogout={handleLogout}
        onOpenLogin={() => setIsLoginOpen(true)}
        totalVotersCount={totalVotersCount}
      />

      {/* Main Content Container */}
      <main className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6 flex-1">
        {/* Top Highlight Summary Card */}
        <SummaryCard
          days={state.days}
          votes={state.votes}
          currentUser={currentUser}
          onSelectDate={dateStr => setSelectedDateStr(dateStr)}
          onOpenTeamModal={handleOpenTeamModal}
          onOpenLogin={() => setIsLoginOpen(true)}
          onQuickVote={(dateStr, slotId, status) => handleVote(dateStr, slotId, status)}
        />

        {/* Calendar View with 5v5 Slots and Voting */}
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

        {/* Nostalgic Shoutbox / Notes */}
        <Shoutbox
          comments={state.comments}
          currentUser={currentUser}
          onAddComment={handleAddComment}
          onOpenLogin={() => setIsLoginOpen(true)}
        />
      </main>

      {/* Footer */}
      <footer className="w-full text-center py-6 text-xs text-slate-500 border-t border-slate-900 mt-12">
        <p className="font-gaming uppercase tracking-wider text-slate-400">
          GAJDVEQCSAN • Grupo de amigos que joga CS à noite
        </p>
        <p className="text-[11px] mt-1 text-slate-600">
          Reunião de velhos amigos para recordar o 5v5 no Counter-Strike.
        </p>
      </footer>

      {/* Login Modal */}
      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onLogin={handleLogin}
        existingUsers={state.users}
      />

      {/* 5v5 Team Draw Modal */}
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

      {/* Floating Audio Player with Song Indicator */}
      <AudioPlayer
        songTitle="Para os Meus Ninjas"
        artist="GAJDVEQCSAN Hino"
      />
    </div>
  );
}
