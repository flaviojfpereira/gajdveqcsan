import React, { useState } from 'react';
import { Trophy, Users, Flame, Calendar, Share2, Check, ArrowRight } from 'lucide-react';
import type { DaySchedule, Vote, User } from '../types.js';

interface SummaryCardProps {
  days: DaySchedule[];
  votes: Vote[];
  currentUser: User | null;
  onSelectDate: (dateStr: string) => void;
  onOpenTeamModal: (dateStr: string, slotId: string) => void;
  onOpenLogin: () => void;
  onQuickVote: (dateStr: string, slotId: string, status: 'yes') => void;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({
  days,
  votes,
  currentUser,
  onSelectDate,
  onOpenTeamModal,
  onOpenLogin,
  onQuickVote
}) => {
  const [copied, setCopied] = useState(false);

  // Compute best slot across all days
  let bestCandidate: {
    day: DaySchedule;
    slotId: string;
    slotLabel: string;
    yesVotes: Vote[];
    maybeVotes: Vote[];
    totalScore: number;
  } | null = null;

  // Find preferred default weekend day if no votes
  const defaultWeekendDay = days.find(d => d.dayOfWeek === 'Sexta' || d.dayOfWeek === 'Sábado') || days[0];

  days.forEach(day => {
    day.slots.forEach(slot => {
      const slotYes = votes.filter(v => v.dateStr === day.dateStr && v.slotId === slot.id && v.status === 'yes');
      const slotMaybe = votes.filter(v => v.dateStr === day.dateStr && v.slotId === slot.id && v.status === 'maybe');
      const score = slotYes.length * 2 + slotMaybe.length;

      if (!bestCandidate) {
        bestCandidate = {
          day,
          slotId: slot.id,
          slotLabel: slot.label,
          yesVotes: slotYes,
          maybeVotes: slotMaybe,
          totalScore: score
        };
      } else if (score > bestCandidate.totalScore) {
        bestCandidate = {
          day,
          slotId: slot.id,
          slotLabel: slot.label,
          yesVotes: slotYes,
          maybeVotes: slotMaybe,
          totalScore: score
        };
      } else if (score === 0 && bestCandidate.totalScore === 0 && (day.dayOfWeek === 'Sexta' || day.dayOfWeek === 'Sábado')) {
        bestCandidate = {
          day,
          slotId: slot.id,
          slotLabel: slot.label,
          yesVotes: slotYes,
          maybeVotes: slotMaybe,
          totalScore: 0
        };
      }
    });
  });

  if (!bestCandidate && defaultWeekendDay) {
    bestCandidate = {
      day: defaultWeekendDay,
      slotId: defaultWeekendDay.slots[0]?.id || 'night_cs',
      slotLabel: defaultWeekendDay.slots[0]?.label || 'Noite de CS (21h30)',
      yesVotes: [],
      maybeVotes: [],
      totalScore: 0
    };
  }

  if (!bestCandidate) return null;

  const confirmedCount = bestCandidate.yesVotes.length;
  const isReady = confirmedCount >= 10;
  const needed = Math.max(0, 10 - confirmedCount);
  const percentage = Math.min(100, Math.round((confirmedCount / 10) * 100));

  const hasCurrentUserVotedYes = currentUser
    ? bestCandidate.yesVotes.some(v => v.userId === currentUser.id)
    : false;

  const handleShareTopDate = async () => {
    if (!bestCandidate) return;
    const msg = isReady
      ? `🔥 GAJDVEQCSAN 5v5 FECHADO! Temos 10 Meninos confirmados para ${bestCandidate.day.dayOfWeek}, ${bestCandidate.day.formattedDate} (${bestCandidate.slotLabel})! Ver equipas: ${window.location.href}`
      : `🎯 GAJDVEQCSAN: A data mais forte para o 5v5 é ${bestCandidate.day.dayOfWeek}, ${bestCandidate.day.formattedDate} com ${confirmedCount}/10 jogadores confirmados! Faltam apenas ${needed}. Votem aqui: ${window.location.href}`;

    if (navigator.clipboard) {
      await navigator.clipboard.writeText(msg);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <section className={`cartoon-card p-4 sm:p-6 transition-all ${
      isReady
        ? 'bg-gradient-to-br from-slate-900 via-emerald-950/40 to-slate-900 border-emerald-500 shadow-emerald-950/60'
        : 'bg-gradient-to-br from-slate-900 via-slate-900/90 to-amber-950/20 border-amber-500/80 shadow-amber-950/40'
    }`}>
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Left info */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
              isReady
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500'
                : 'bg-amber-500/20 text-amber-300 border border-amber-500/60'
            }`}>
              {isReady ? <Flame className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" /> : <Trophy className="w-3.5 h-3.5 text-amber-400" />}
              {isReady ? '5v5 Fechado! Vai haver jogo!' : 'Data Favorita da Malta'}
            </span>
            <span className="text-xs text-slate-400 font-semibold">
              {bestCandidate.day.isWeekend ? 'Fim de Semana' : 'Dia de Semana'}
            </span>
          </div>

          <h3 className="text-xl sm:text-2xl font-black text-white font-gaming tracking-wide flex items-center gap-2">
            <Calendar className="w-5 h-5 text-amber-400" />
            <span>{bestCandidate.day.dayOfWeek}, {bestCandidate.day.formattedDate}</span>
          </h3>

          <p className="text-xs sm:text-sm text-slate-300 mt-1 font-medium">
            Horário: <strong className="text-amber-300">{bestCandidate.slotLabel}</strong>
          </p>

          {/* Player avatars list */}
          <div className="flex items-center flex-wrap gap-1.5 mt-3">
            <span className="text-[11px] font-bold uppercase text-slate-400 mr-1 flex items-center gap-1">
              <Users className="w-3 h-3 text-slate-400" /> Confirmados:
            </span>
            {bestCandidate.yesVotes.map(v => (
              <span
                key={v.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                {v.userName}
              </span>
            ))}
            {bestCandidate.maybeVotes.length > 0 && (
              <span className="text-xs text-slate-400 ml-1">
                (+{bestCandidate.maybeVotes.length} talvez)
              </span>
            )}
          </div>
        </div>

        {/* Right metrics and quick buttons */}
        <div className="w-full md:w-auto flex flex-col sm:flex-row md:flex-col items-stretch md:items-end gap-3 min-w-[240px]">
          {/* Progress Box */}
          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-center sm:text-right w-full">
            <div className="flex justify-between items-baseline gap-4 mb-1">
              <span className="text-xs font-bold text-slate-400 uppercase">Lotação 5v5</span>
              <span className={`text-lg font-black font-gaming ${
                isReady ? 'text-emerald-400' : 'text-amber-400'
              }`}>
                {confirmedCount} / 10 Jogadores
              </span>
            </div>

            {/* Visual Bar */}
            <div className="w-full h-3.5 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isReady
                    ? 'bg-gradient-to-r from-emerald-500 to-green-400'
                    : 'bg-gradient-to-r from-amber-500 to-amber-300'
                }`}
                style={{ width: `${percentage}%` }}
              />
            </div>

            <p className="text-[11px] text-slate-400 mt-1 font-semibold">
              {isReady
                ? '🎯 Temos os 10 necessários! Podem sortear equipas.'
                : `⚡ Faltam ${needed} jogador${needed === 1 ? '' : 'es'} para fechar o 5v5.`}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 w-full">
            <button
              onClick={handleShareTopDate}
              className="cartoon-btn flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
              title="Copiar texto para colar no WhatsApp"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300">Copiado!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </>
              )}
            </button>

            {isReady ? (
              <button
                onClick={() => onOpenTeamModal(bestCandidate!.day.dateStr, bestCandidate!.slotId)}
                className="cartoon-btn flex-1 py-2 px-3 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 text-slate-950 text-xs font-black rounded-xl flex items-center justify-center gap-1.5 cursor-pointer font-gaming uppercase tracking-wider"
              >
                <span>Equipas 5v5</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : !currentUser ? (
              <button
                onClick={onOpenLogin}
                className="cartoon-btn flex-1 py-2 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl flex items-center justify-center gap-1.5 cursor-pointer font-gaming"
              >
                <span>Entrar & Votar</span>
              </button>
            ) : !hasCurrentUserVotedYes ? (
              <button
                onClick={() => onQuickVote(bestCandidate!.day.dateStr, bestCandidate!.slotId, 'yes')}
                className="cartoon-btn flex-1 py-2 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl flex items-center justify-center gap-1.5 cursor-pointer font-gaming uppercase"
              >
                <span>Posso neste dia! 🎮</span>
              </button>
            ) : (
              <button
                onClick={() => onSelectDate(bestCandidate!.day.dateStr)}
                className="cartoon-btn flex-1 py-2 px-3 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Ver no Calendário</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
