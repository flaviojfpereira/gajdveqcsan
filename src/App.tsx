import React, { useState, useEffect } from 'react';
import { HeaderBanner } from './components/HeaderBanner.js';
import { SummaryCard } from './components/SummaryCard.js';
import { CalendarSchedule } from './components/CalendarSchedule.js';
import { LoginModal } from './components/LoginModal.js';
import { TeamDrawModal } from './components/TeamDrawModal.js';
import { Shoutbox } from './components/Shoutbox.js';
import { AudioPlayer } from './components/AudioPlayer.js';
import type { AppState, User, Vote, Comment, VoteStatus, TeamDistribution } from './types.js';
import { getDefaultAppState } from './utils/calendarGenerator.js';

function getInitialState(): AppState {
  try {
    const cached = localStorage.getItem('gajdveqcsan_cached_state');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && Array.isArray(parsed.days) && parsed.days.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to parse cached state:', e);
  }
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

  // App opens strictly WITHOUT any user logged in.
  // Purge any lingering session keys so no one is ever auto-logged in.
  useEffect(() => {
    try {
      localStorage.removeItem('gajdveqcsan_user');
      localStorage.removeItem('gajdveqcsan_explicit_login');
    } catch {
      // ignore
    }
    setCurrentUser(null);
  }, []);

  // Sync state changes to localStorage cache
  useEffect(() => {
    try {
      localStorage.setItem('gajdveqcsan_cached_state', JSON.stringify(state));
    } catch (e) {
      console.error('Failed to cache state in localStorage:', e);
    }
  }, [state]);

  // Fetch state from server and intelligently merge with local cache
  const fetchState = async () => {
    try {
      const res = await fetch('/api/state');
      if (res.ok) {
        const serverState: AppState = await res.json();
        if (serverState && Array.isArray(serverState.days) && serverState.days.length > 0) {
          setState(prev => {
            // 1. Merge votes: keep whichever has the latest updatedAt, never lose un-synced votes
            const voteMap = new Map<string, Vote>();

            if (Array.isArray(prev.votes)) {
              for (const lv of prev.votes) {
                const key = `${lv.userId}_${lv.dateStr}_${lv.slotId}`;
                voteMap.set(key, lv);
              }
            }

            if (Array.isArray(serverState.votes)) {
              for (const sv of serverState.votes) {
                const key = `${sv.userId}_${sv.dateStr}_${sv.slotId}`;
                const existing = voteMap.get(key);
                if (!existing) {
                  voteMap.set(key, sv);
                } else {
                  const svTime = new Date(sv.updatedAt || 0).getTime();
                  const exTime = new Date(existing.updatedAt || 0).getTime();
                  if (svTime >= exTime) {
                    voteMap.set(key, sv);
                  }
                }
              }
            }

            const mergedVotes = Array.from(voteMap.values());

            // 2. Merge users
            const userMap = new Map<string, User>();
            if (Array.isArray(prev.users)) {
              for (const u of prev.users) userMap.set(u.id, u);
            }
            if (Array.isArray(serverState.users)) {
              for (const u of serverState.users) userMap.set(u.id, u);
            }
            const mergedUsers = Array.from(userMap.values());

            // 3. Merge comments
            const commentMap = new Map<string, any>();
            if (Array.isArray(prev.comments)) {
              for (const c of prev.comments) commentMap.set(c.id, c);
            }
            if (Array.isArray(serverState.comments)) {
              for (const c of serverState.comments) commentMap.set(c.id, c);
            }
            const mergedComments = Array.from(commentMap.values()).sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );

            // 4. Merge teams
            const mergedTeams = {
              ...(prev.teams || {}),
              ...(serverState.teams || {})
            };

            return {
              days: serverState.days && serverState.days.length > 0 ? serverState.days : prev.days,
              users: mergedUsers,
              votes: mergedVotes,
              comments: mergedComments,
              teams: mergedTeams
            };
          });
        }
      }
    } catch (err) {
      // In static hosts (like Vercel default without serverless) or offline, state is already rendered from cache
      console.warn('API sync notice (running with local cache):', err);
    }
  };

  useEffect(() => {
    fetchState();
    // Poll every 10s to keep friends in sync if server is available
    const interval = setInterval(fetchState, 10000);
    return () => clearInterval(interval);
  }, []);

  // Core vote execution
  const executeVote = async (user: User, dateStr: string, slotId: string, status: VoteStatus | 'none') => {
    // Optimistic update
    setState(prev => {
      const votes = [...prev.votes];
      const idx = votes.findIndex(
        v => v.userId === user.id && v.dateStr === dateStr && v.slotId === slotId
      );

      if (status === 'none') {
        if (idx !== -1) votes.splice(idx, 1);
      } else {
        const newVote = {
          id: idx !== -1 ? votes[idx].id : `v_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          userId: user.id,
          userName: user.name,
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
          userId: user.id,
          userName: user.name,
          dateStr,
          slotId,
          status
        })
      });
    } catch (err) {
      console.warn('Vote recorded locally:', err);
    }
  };

  // Handle simple login (name + password = same name)
  const handleLogin = async (name: string, password?: string): Promise<boolean> => {
    const cleanName = name.trim();
    if (!cleanName) return false;

    let loggedUser: User | null = null;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cleanName, password: password || cleanName })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          loggedUser = data.user;
        }
      }
    } catch (err) {
      console.warn('Backend login fallback to local user:', err);
    }

    // Fallback if backend is static/offline
    if (!loggedUser) {
      const existing = state.users.find(u => u.name.toLowerCase() === cleanName.toLowerCase());
      if (existing) {
        loggedUser = existing;
      } else {
        loggedUser = {
          id: `u_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: cleanName,
          avatarSeed: cleanName.toLowerCase().replace(/\s+/g, '_'),
          createdAt: new Date().toISOString()
        };
        setState(prev => ({ ...prev, users: [...prev.users, loggedUser!] }));
      }
    }

    setCurrentUser(loggedUser);

    // Automatically record pending vote if user clicked before logging in
    if (pendingVote) {
      await executeVote(loggedUser, pendingVote.dateStr, pendingVote.slotId, pendingVote.status);
      setPendingVote(null);
    }

    // Automatically send comment if typed before logging in
    if (pendingComment) {
      await executeAddComment(loggedUser, pendingComment);
      setPendingComment(null);
    }

    return true;
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('gajdveqcsan_user');
    localStorage.removeItem('gajdveqcsan_explicit_login');
  };

  // Vote on a specific slot with optimistic UI update
  const handleVote = async (dateStr: string, slotId: string, status: VoteStatus | 'none') => {
    if (!currentUser) {
      setPendingVote({ dateStr, slotId, status });
      setIsLoginOpen(true);
      return;
    }

    await executeVote(currentUser, dateStr, slotId, status);
  };

  // Bulk votes update (e.g. "Posso todas as sextas")
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
            id: idx !== -1 ? votes[idx].id : `v_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
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
      await fetch('/api/votes/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          userName: currentUser.name,
          updates
        })
      });
    } catch (err) {
      console.warn('Bulk vote stored locally:', err);
    }
  };

  // Execute comment submission
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
      await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          userName: user.name,
          text: cleanText
        })
      });
    } catch (err) {
      console.warn('Comment stored locally:', err);
    }
    return true;
  };

  // Add message to shoutbox
  const handleAddComment = async (text: string): Promise<boolean> => {
    if (!currentUser) {
      setPendingComment(text);
      setIsLoginOpen(true);
      return false;
    }
    return executeAddComment(currentUser, text);
  };

  // Shuffle teams for 5v5
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
      const res = await fetch('/api/teams/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dateStr, slotId })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.distribution) {
          setState(prev => ({
            ...prev,
            teams: {
              ...prev.teams,
              [`${dateStr}_${slotId}`]: data.distribution
            }
          }));
          return data.distribution;
        }
      }
    } catch (err) {
      console.warn('Teams generated locally:', err);
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
