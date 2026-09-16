import React, { useState } from 'react';
import { Shield, Flame, Dices, X, Share2, Check, Crosshair } from 'lucide-react';
import type { TeamDistribution, DaySchedule, Vote } from '../types.js';

interface TeamDrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  dateStr: string;
  slotId: string;
  daySchedule?: DaySchedule;
  confirmedVotes: Vote[];
  savedTeams?: TeamDistribution;
  onShuffleTeams: (dateStr: string, slotId: string) => Promise<TeamDistribution | null>;
}

export const TeamDrawModal: React.FC<TeamDrawModalProps> = ({
  isOpen,
  onClose,
  dateStr,
  slotId,
  daySchedule,
  confirmedVotes,
  savedTeams,
  onShuffleTeams
}) => {
  const [copied, setCopied] = useState(false);
  const [isShuffling, setIsShuffling] = useState(false);

  if (!isOpen) return null;

  // Local fallback distribution if not already drawn
  const playerNames = confirmedVotes.map(v => v.userName);
  const roles = ['AWPer', 'Entry Fragger', 'IGL (Capitão)', 'Lurker', 'Support'];

  const ct = savedTeams?.ctTeam || playerNames.slice(0, 5).map((name, i) => ({
    name,
    role: roles[i] || 'Rifler'
  }));

  const t = savedTeams?.tTeam || playerNames.slice(5, 10).map((name, i) => ({
    name,
    role: roles[i] || 'Rifler'
  }));

  const handleShuffle = async () => {
    setIsShuffling(true);
    await onShuffleTeams(dateStr, slotId);
    setIsShuffling(false);
  };

  const handleCopyTeams = async () => {
    const text = `🎮 *GAJDVEQCSAN 5v5 - EQUIPAS OFICIAIS* 🎮
📅 ${daySchedule?.dayOfWeek || ''}, ${daySchedule?.formattedDate || dateStr}

🔵 *COUNTER-TERRORISTS (CT):*
${ct.map((p, i) => `${i + 1}. ${p.name} [${p.role}]`).join('\n')}

🟠 *TERRORISTS (T):*
${t.map((p, i) => `${i + 1}. ${p.name} [${p.role}]`).join('\n')}

🔥 Bora para o CS: ${window.location.href}`;

    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-slate-900 border-4 border-amber-500 rounded-3xl shadow-2xl p-5 sm:p-6 cartoon-card-gold text-slate-100 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 text-xs font-black uppercase tracking-wider mb-2 font-gaming border border-amber-500/40">
            <Crosshair className="w-3.5 h-3.5 text-amber-400" />
            <span>Sorteio de Equipas 5v5</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black font-gaming tracking-wide uppercase text-white">
            CTs vs Terroristas
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 font-medium">
            {daySchedule?.dayOfWeek}, {daySchedule?.formattedDate} • 10 Jogadores Confirmados!
          </p>
        </div>

        {/* Teams Display: Blue (CT) vs Orange (T) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {/* CT TEAM (Blue) */}
          <div className="bg-slate-950/80 rounded-2xl p-4 border-2 border-sky-500/80 cartoon-card-blue">
            <div className="flex items-center justify-between pb-3 border-b border-sky-500/40 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-sky-500/20 border border-sky-400 flex items-center justify-center text-sky-400">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black font-gaming text-sky-400 uppercase tracking-wider">
                    Counter-Terrorists
                  </h3>
                  <span className="text-[10px] uppercase font-bold text-sky-300/80">Equipa Azul • 5 Jogadores</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {ct.map((player, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs"
                >
                  <span className="font-bold text-slate-100 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-sky-950 border border-sky-500 text-sky-300 font-black text-[10px] flex items-center justify-center">
                      {idx + 1}
                    </span>
                    {player.name}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-sky-950/80 text-sky-300 border border-sky-800 text-[10px] font-bold uppercase">
                    {player.role}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* T TEAM (Orange) */}
          <div className="bg-slate-950/80 rounded-2xl p-4 border-2 border-amber-500/80 cartoon-card-gold">
            <div className="flex items-center justify-between pb-3 border-b border-amber-500/40 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400 flex items-center justify-center text-amber-400">
                  <Flame className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black font-gaming text-amber-400 uppercase tracking-wider">
                    Terroristas
                  </h3>
                  <span className="text-[10px] uppercase font-bold text-amber-300/80">Equipa Laranja • 5 Jogadores</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {t.map((player, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs"
                >
                  <span className="font-bold text-slate-100 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-950 border border-amber-500 text-amber-300 font-black text-[10px] flex items-center justify-center">
                      {idx + 1}
                    </span>
                    {player.name}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-amber-950/80 text-amber-300 border border-amber-800 text-[10px] font-bold uppercase">
                    {player.role}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-3 border-t border-slate-800">
          <button
            onClick={handleShuffle}
            disabled={isShuffling}
            className="cartoon-btn w-full sm:w-1/2 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <Dices className={`w-4 h-4 text-amber-400 ${isShuffling ? 'animate-spin' : ''}`} />
            <span>{isShuffling ? 'A Baralhar...' : 'Sortear Novamente 🎲'}</span>
          </button>

          <button
            onClick={handleCopyTeams}
            className="cartoon-btn w-full sm:w-1/2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer font-gaming"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-slate-950" />
                <span>Copiado para o WhatsApp!</span>
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4" />
                <span>Copiar Equipas (WhatsApp/Discord)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
