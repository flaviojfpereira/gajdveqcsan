import React, { useState, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  HelpCircle, 
  X, 
  Users, 
  Flame, 
  Trophy, 
  Zap, 
  Share2, 
  List, 
  Grid,
  CheckCircle2,
  Clock
} from 'lucide-react';
import type { DaySchedule, Vote, User, VoteStatus } from '../types.js';

interface CalendarScheduleProps {
  days: DaySchedule[];
  votes: Vote[];
  currentUser: User | null;
  onVote: (dateStr: string, slotId: string, status: VoteStatus | 'none') => void;
  onBulkVote: (updates: { dateStr: string; slotId: string; status: VoteStatus | 'none' }[]) => void;
  onOpenLogin: () => void;
  onOpenTeamModal: (dateStr: string, slotId: string) => void;
  selectedDateStr: string | null;
}

const PT_MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const WEEKDAY_NAMES = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

export const CalendarSchedule: React.FC<CalendarScheduleProps> = ({
  days,
  votes,
  currentUser,
  onVote,
  onBulkVote,
  onOpenLogin,
  onOpenTeamModal,
  selectedDateStr
}) => {
  // Determine initial month from current date or first day
  const today = new Date();
  const [currentYear, setCurrentYear] = useState<number>(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(today.getMonth()); // 0-indexed
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  
  // Selected date inside calendar
  const [activeDateStr, setActiveDateStr] = useState<string>(() => {
    if (selectedDateStr) return selectedDateStr;
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const found = days.find(d => d.dateStr === todayStr);
    return found ? found.dateStr : (days[0]?.dateStr || todayStr);
  });

  const [copiedDate, setCopiedDate] = useState<string | null>(null);

  // Month navigation
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const handleGoToToday = () => {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    setActiveDateStr(todayStr);
  };

  // Build the calendar matrix for currentYear & currentMonth (European Monday-first format)
  const calendarCells = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();

    // In JS, getDay(): 0 is Sunday, 1 is Monday ... 6 is Saturday
    // Convert to Monday = 0, ..., Sunday = 6
    const startWeekday = (firstDayOfMonth.getDay() + 6) % 7;

    const cells: {
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      daySchedule?: DaySchedule;
      isWeekend: boolean;
    }[] = [];

    // Previous month filler days
    const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = startWeekday - 1; i >= 0; i--) {
      const dayNum = prevMonthLastDay - i;
      const prevDate = new Date(currentYear, currentMonth - 1, dayNum);
      const m = String(prevDate.getMonth() + 1).padStart(2, '0');
      const d = String(prevDate.getDate()).padStart(2, '0');
      const dStr = `${prevDate.getFullYear()}-${m}-${d}`;
      const schedule = days.find(day => day.dateStr === dStr);
      const isWeekend = prevDate.getDay() === 5 || prevDate.getDay() === 6 || prevDate.getDay() === 0;

      cells.push({
        dateStr: dStr,
        dayNumber: dayNum,
        isCurrentMonth: false,
        daySchedule: schedule,
        isWeekend
      });
    }

    // Current month days
    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const curDate = new Date(currentYear, currentMonth, dayNum);
      const m = String(curDate.getMonth() + 1).padStart(2, '0');
      const d = String(dayNum).padStart(2, '0');
      const dStr = `${currentYear}-${m}-${d}`;
      const schedule = days.find(day => day.dateStr === dStr);
      const isWeekend = curDate.getDay() === 5 || curDate.getDay() === 6 || curDate.getDay() === 0;

      cells.push({
        dateStr: dStr,
        dayNumber: dayNum,
        isCurrentMonth: true,
        daySchedule: schedule,
        isWeekend
      });
    }

    // Next month filler days to complete grid to multiple of 7
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let dayNum = 1; dayNum <= remaining; dayNum++) {
      const nextDate = new Date(currentYear, currentMonth + 1, dayNum);
      const m = String(nextDate.getMonth() + 1).padStart(2, '0');
      const d = String(dayNum).padStart(2, '0');
      const dStr = `${nextDate.getFullYear()}-${m}-${d}`;
      const schedule = days.find(day => day.dateStr === dStr);
      const isWeekend = nextDate.getDay() === 5 || nextDate.getDay() === 6 || nextDate.getDay() === 0;

      cells.push({
        dateStr: dStr,
        dayNumber: dayNum,
        isCurrentMonth: false,
        daySchedule: schedule,
        isWeekend
      });
    }

    return cells;
  }, [currentYear, currentMonth, days]);

  // Bulk actions helpers
  const handleBulkWeekdays = (dayName: string, status: VoteStatus) => {
    if (!currentUser) {
      onOpenLogin();
      return;
    }
    const targetDays = days.filter(d => d.dayOfWeek === dayName);
    const updates = targetDays.map(d => ({
      dateStr: d.dateStr,
      slotId: 'night_cs',
      status
    }));
    onBulkVote(updates);
  };

  const handleClearAllMyVotes = () => {
    if (!currentUser) return;
    const myVotes = votes.filter(v => v.userId === currentUser.id);
    const updates = myVotes.map(v => ({
      dateStr: v.dateStr,
      slotId: v.slotId,
      status: 'none' as const
    }));
    onBulkVote(updates);
  };

  // Active day details
  const activeDay = useMemo(() => {
    return days.find(d => d.dateStr === activeDateStr) || {
      dateStr: activeDateStr,
      dayOfWeek: 'Dia',
      formattedDate: activeDateStr,
      isWeekend: false,
      slots: [{ id: 'night_cs', label: 'Noite de CS (21h30)', time: '21:30' }]
    };
  }, [days, activeDateStr]);

  const activeDayVotes = votes.filter(v => v.dateStr === activeDateStr && v.slotId === 'night_cs');
  const yesVotes = activeDayVotes.filter(v => v.status === 'yes');
  const maybeVotes = activeDayVotes.filter(v => v.status === 'maybe');
  const noVotes = activeDayVotes.filter(v => v.status === 'no');
  const confirmedCount = yesVotes.length;
  const isTenReady = confirmedCount >= 10;

  const myVote = currentUser
    ? activeDayVotes.find(v => v.userId === currentUser.id)
    : null;

  const handleShareDate = async (daySchedule: DaySchedule) => {
    const text = isTenReady
      ? `🔥 GAJDVEQCSAN: Temos 10 confirmados para ${daySchedule.dayOfWeek}, ${daySchedule.formattedDate} às 21h30! Ver equipas: ${window.location.href}`
      : `🎯 GAJDVEQCSAN: Quem alinha para o 5v5 na ${daySchedule.dayOfWeek}, ${daySchedule.formattedDate} às 21h30? Já somos ${confirmedCount}/10 confirmados! Votem aqui: ${window.location.href}`;

    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      setCopiedDate(daySchedule.dateStr);
      setTimeout(() => setCopiedDate(null), 2500);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/95 p-4 sm:p-5 rounded-2xl border-2 border-slate-800 cartoon-card">
        <div>
          <h3 className="text-xl sm:text-2xl font-black text-white font-gaming tracking-wide flex items-center gap-2.5">
            <CalendarIcon className="w-6 h-6 text-amber-400" />
            <span>Calendário Oficial de Treinos 5v5</span>
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 font-medium mt-1">
            Reunião noturna às <strong>21h30</strong>. Clica nas datas para indicar a tua disponibilidade!
          </p>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <div className="flex items-center p-1 bg-slate-950 rounded-xl border border-slate-800">
            <button
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'calendar'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Mês</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Lista</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Shortcuts Bar */}
      {currentUser ? (
        <div className="bg-slate-900/80 p-3 sm:p-4 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs cartoon-card">
          <div className="flex items-center gap-2 text-slate-200 font-bold">
            <Zap className="w-4 h-4 text-amber-400" />
            <span>Votação rápida para <span className="text-amber-400 font-gaming">{currentUser.name}</span>:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleBulkWeekdays('Sexta', 'yes')}
              className="cartoon-btn px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white font-bold cursor-pointer border border-slate-700 text-xs transition-colors"
            >
              ✅ Posso todas as Sextas
            </button>
            <button
              onClick={() => handleBulkWeekdays('Sábado', 'yes')}
              className="cartoon-btn px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white font-bold cursor-pointer border border-slate-700 text-xs transition-colors"
            >
              ✅ Posso todos os Sábados
            </button>
            <button
              onClick={handleClearAllMyVotes}
              className="px-2.5 py-1.5 rounded-xl bg-slate-950 hover:bg-red-950/60 text-slate-400 hover:text-red-300 font-semibold cursor-pointer border border-slate-800 text-xs transition-colors"
            >
              Limpar os meus votos
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-amber-950/40 border-2 border-amber-500/60 p-3.5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs cartoon-card">
          <div className="flex items-center gap-2 text-amber-200">
            <span className="text-lg">👋</span>
            <span>
              <strong>Olá jogador!</strong> Entra com o teu nome para começares a marcar os teus votos no calendário.
            </span>
          </div>
          <button
            onClick={onOpenLogin}
            className="cartoon-btn px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider font-gaming cursor-pointer"
          >
            Entrar / Identificar-me
          </button>
        </div>
      )}

      {/* MAIN VIEW: Calendar Grid or List */}
      {viewMode === 'calendar' ? (
        <div className="space-y-6">
          {/* Month Calendar Grid Card */}
          <div className="bg-slate-900/95 border-2 border-slate-800 rounded-2xl p-4 sm:p-6 cartoon-card shadow-2xl">
            {/* Month Navigation Bar */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <h4 className="text-lg sm:text-2xl font-black font-gaming text-amber-400 uppercase tracking-wide">
                  {PT_MONTHS[currentMonth]} {currentYear}
                </h4>
                <button
                  onClick={handleGoToToday}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer border border-slate-700"
                >
                  Hoje
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={handlePrevMonth}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-300 transition-colors cursor-pointer border border-slate-700"
                  title="Mês Anterior"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={handleNextMonth}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-300 transition-colors cursor-pointer border border-slate-700"
                  title="Próximo Mês"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Weekday Headers */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 text-center">
              {WEEKDAY_NAMES.map((name, idx) => {
                const isWeekend = idx >= 4; // Sex, Sáb, Dom
                return (
                  <div
                    key={name}
                    className={`py-2 text-xs font-black uppercase tracking-wider font-gaming ${
                      isWeekend ? 'text-amber-400' : 'text-slate-400'
                    }`}
                  >
                    <span>{name}</span>
                    {isWeekend && <span className="hidden sm:inline text-[10px] ml-1">🔥</span>}
                  </div>
                );
              })}
            </div>

            {/* Calendar Days Matrix */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2.5">
              {calendarCells.map(cell => {
                const isSelected = cell.dateStr === activeDateStr;
                const cellVotes = votes.filter(v => v.dateStr === cell.dateStr && v.slotId === 'night_cs');
                const cellYesCount = cellVotes.filter(v => v.status === 'yes').length;
                const cellIs10 = cellYesCount >= 10;
                
                const cellUserVote = currentUser
                  ? cellVotes.find(v => v.userId === currentUser.id)
                  : null;

                const isTodayDate = cell.dateStr === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

                return (
                  <div
                    key={cell.dateStr}
                    onClick={() => setActiveDateStr(cell.dateStr)}
                    className={`relative min-h-[75px] sm:min-h-[105px] p-1.5 sm:p-2.5 rounded-xl sm:rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                      !cell.isCurrentMonth
                        ? 'opacity-35 bg-slate-950/40 border-slate-900 hover:opacity-75'
                        : isSelected
                        ? 'bg-slate-800/95 border-amber-400 shadow-lg shadow-amber-500/20 scale-[1.02] z-10'
                        : cellIs10
                        ? 'bg-emerald-950/40 border-emerald-500/80 hover:border-emerald-400'
                        : cell.isWeekend
                        ? 'bg-slate-900/90 border-slate-800 hover:border-amber-500/60'
                        : 'bg-slate-950/60 border-slate-900 hover:border-slate-700'
                    }`}
                  >
                    {/* Top row in cell: Day number + Today indicator */}
                    <div className="flex items-center justify-between">
                      <span className={`text-xs sm:text-base font-black font-gaming ${
                        isSelected
                          ? 'text-amber-400'
                          : cellIs10
                          ? 'text-emerald-300'
                          : cell.isWeekend
                          ? 'text-white'
                          : 'text-slate-300'
                      }`}>
                        {cell.dayNumber}
                      </span>

                      {isTodayDate && (
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" title="Hoje" />
                      )}
                    </div>

                    {/* Middle / Bottom in cell: 5v5 Count Badge */}
                    <div className="my-1">
                      {cellYesCount > 0 ? (
                        <div className={`inline-flex items-center gap-1 px-1 sm:px-2 py-0.5 rounded-lg text-[10px] sm:text-xs font-black font-gaming tracking-wide w-full justify-center ${
                          cellIs10
                            ? 'bg-emerald-500 text-slate-950 shadow-sm animate-pulse'
                            : cellYesCount >= 7
                            ? 'bg-amber-500/25 text-amber-300 border border-amber-500/40'
                            : 'bg-slate-800 text-slate-300'
                        }`}>
                          {cellIs10 ? (
                            <Trophy className="w-3 h-3 text-slate-950 fill-slate-950" />
                          ) : (
                            <Users className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                          )}
                          <span>{cellYesCount}/10</span>
                        </div>
                      ) : (
                        <div className="h-4 sm:h-5" />
                      )}
                    </div>

                    {/* User Vote Status indicator on this day */}
                    {cellUserVote && (
                      <div className="flex justify-center">
                        <span className={`text-[9px] sm:text-[10px] px-1 sm:px-2 py-0.5 rounded-full font-bold uppercase truncate max-w-full text-center ${
                          cellUserVote.status === 'yes'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                            : cellUserVote.status === 'maybe'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                            : 'bg-red-500/20 text-red-300 border border-red-500/50'
                        }`}>
                          {cellUserVote.status === 'yes' && '✓ Posso'}
                          {cellUserVote.status === 'maybe' && '? Talvez'}
                          {cellUserVote.status === 'no' && '✗ Não'}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* DAY INSPECTOR & QUICK VOTE PANEL (The active selected date) */}
          <div className={`cartoon-card p-5 sm:p-6 rounded-2xl border-4 transition-all ${
            isTenReady
              ? 'bg-gradient-to-br from-slate-900 via-emerald-950/30 to-slate-900 border-emerald-500 shadow-emerald-950/50'
              : 'bg-slate-900/95 border-amber-400/90 shadow-2xl'
          }`}>
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-5 border-b border-slate-800">
              {/* Left Date Info */}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase font-gaming tracking-wider ${
                    isTenReady
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-400'
                  }`}>
                    {activeDay.dayOfWeek} • {activeDay.formattedDate}
                  </span>
                  <span className="text-xs text-slate-400 flex items-center gap-1 font-semibold">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>21h30 (Noite de CS)</span>
                  </span>
                </div>

                <h3 className="text-xl sm:text-2xl font-black text-white font-gaming tracking-wide">
                  {activeDay.dayOfWeek}, {activeDay.formattedDate}
                </h3>
              </div>

              {/* Middle 5v5 Meter */}
              <div className="flex flex-col items-start lg:items-end min-w-[200px]">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                    Estado do 5v5:
                  </span>
                  <span className={`text-base font-black font-gaming ${
                    isTenReady ? 'text-emerald-400' : 'text-amber-400'
                  }`}>
                    {confirmedCount} / 10 Jogadores
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full lg:w-48 h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-700">
                  <div
                    className={`h-full transition-all duration-500 rounded-full ${
                      isTenReady ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                    style={{ width: `${Math.min(100, (confirmedCount / 10) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Right CTA Actions */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleShareDate(activeDay)}
                  className="cartoon-btn px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center gap-1.5 cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>{copiedDate === activeDay.dateStr ? 'Copiado!' : 'Partilhar Data'}</span>
                </button>

                {isTenReady && (
                  <button
                    onClick={() => onOpenTeamModal(activeDay.dateStr, 'night_cs')}
                    className="cartoon-btn-gold px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-xs sm:text-sm font-gaming uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-lg"
                  >
                    <Trophy className="w-4 h-4" />
                    <span>Ver Equipas 5v5</span>
                  </button>
                )}
              </div>
            </div>

            {/* Voting & Players List Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-5">
              {/* Left Column: Your Vote */}
              <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800/90 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-2 flex items-center gap-1.5 font-gaming">
                    <span>O Teu Voto para Esta Noite</span>
                  </h4>

                  {currentUser ? (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-300">
                        Olá <strong>{currentUser.name}</strong>, podes jogar nesta data às 21h30?
                      </p>

                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => onVote(activeDay.dateStr, 'night_cs', 'yes')}
                          className={`cartoon-btn p-2 rounded-xl text-xs font-black flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                            myVote?.status === 'yes'
                              ? 'bg-emerald-600 text-white ring-2 ring-emerald-300 shadow-md'
                              : 'bg-slate-900 hover:bg-emerald-950/60 text-slate-300 hover:text-emerald-300 border border-slate-800'
                          }`}
                        >
                          <Check className="w-4 h-4" />
                          <span>Posso</span>
                        </button>

                        <button
                          onClick={() => onVote(activeDay.dateStr, 'night_cs', 'maybe')}
                          className={`cartoon-btn p-2 rounded-xl text-xs font-black flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                            myVote?.status === 'maybe'
                              ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-300 shadow-md'
                              : 'bg-slate-900 hover:bg-amber-950/60 text-slate-300 hover:text-amber-300 border border-slate-800'
                          }`}
                        >
                          <HelpCircle className="w-4 h-4" />
                          <span>Talvez</span>
                        </button>

                        <button
                          onClick={() => onVote(activeDay.dateStr, 'night_cs', 'no')}
                          className={`cartoon-btn p-2 rounded-xl text-xs font-black flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                            myVote?.status === 'no'
                              ? 'bg-red-600 text-white ring-2 ring-red-300 shadow-md'
                              : 'bg-slate-900 hover:bg-red-950/60 text-slate-300 hover:text-red-300 border border-slate-800'
                          }`}
                        >
                          <X className="w-4 h-4" />
                          <span>Não</span>
                        </button>
                      </div>

                      {myVote && (
                        <div className="text-right">
                          <button
                            onClick={() => onVote(activeDay.dateStr, 'night_cs', 'none')}
                            className="text-[11px] text-slate-500 hover:text-slate-400 underline cursor-pointer"
                          >
                            Remover o meu voto desta data
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-300">
                        Clica na tua disponibilidade para votar nesta data:
                      </p>

                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => onVote(activeDay.dateStr, 'night_cs', 'yes')}
                          className="cartoon-btn p-2 rounded-xl text-xs font-black flex flex-col items-center justify-center gap-1 transition-all cursor-pointer bg-slate-900 hover:bg-emerald-950/70 text-slate-300 hover:text-emerald-300 border border-slate-800 hover:border-emerald-500/50"
                        >
                          <Check className="w-4 h-4 text-emerald-400" />
                          <span>Posso</span>
                        </button>

                        <button
                          onClick={() => onVote(activeDay.dateStr, 'night_cs', 'maybe')}
                          className="cartoon-btn p-2 rounded-xl text-xs font-black flex flex-col items-center justify-center gap-1 transition-all cursor-pointer bg-slate-900 hover:bg-amber-950/70 text-slate-300 hover:text-amber-300 border border-slate-800 hover:border-amber-500/50"
                        >
                          <HelpCircle className="w-4 h-4 text-amber-400" />
                          <span>Talvez</span>
                        </button>

                        <button
                          onClick={() => onVote(activeDay.dateStr, 'night_cs', 'no')}
                          className="cartoon-btn p-2 rounded-xl text-xs font-black flex flex-col items-center justify-center gap-1 transition-all cursor-pointer bg-slate-900 hover:bg-red-950/70 text-slate-300 hover:text-red-300 border border-slate-800 hover:border-red-500/50"
                        >
                          <X className="w-4 h-4 text-red-400" />
                          <span>Não</span>
                        </button>
                      </div>

                      <div className="text-center pt-1">
                        <button
                          onClick={onOpenLogin}
                          className="text-xs text-amber-400 hover:text-amber-300 font-bold underline cursor-pointer"
                        >
                          Ou entra com o teu nome aqui
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Friends who voted */}
              <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800/90 space-y-3">
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center justify-between font-gaming">
                  <span>Disponibilidade da Malta ({activeDayVotes.length})</span>
                  <span className="text-emerald-400 font-bold">{confirmedCount} Confirmados</span>
                </h4>

                {/* Yes list */}
                <div>
                  <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block mb-1.5">
                    ✅ Podem ({yesVotes.length}):
                  </span>
                  {yesVotes.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {yesVotes.map(v => (
                        <span
                          key={v.id}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold"
                        >
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                          <span>{v.userName}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">Nenhum voto confirmado ainda. Sê o primeiro!</p>
                  )}
                </div>

                {/* Maybe list */}
                {maybeVotes.length > 0 && (
                  <div>
                    <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block mb-1">
                      🟡 Talvez ({maybeVotes.length}):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {maybeVotes.map(v => (
                        <span
                          key={v.id}
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-medium"
                        >
                          <span>{v.userName}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* No list */}
                {noVotes.length > 0 && (
                  <div>
                    <span className="text-[11px] font-bold text-red-400 uppercase tracking-wider block mb-1">
                      ❌ Não podem ({noVotes.length}):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {noVotes.map(v => (
                        <span
                          key={v.id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-red-500/10 text-red-400 text-xs font-medium"
                        >
                          <span>{v.userName}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* LINEAR LIST VIEW FALLBACK */
        <div className="space-y-4">
          {days.map(day => {
            const dayVotes = votes.filter(v => v.dateStr === day.dateStr && v.slotId === 'night_cs');
            const dayYesCount = dayVotes.filter(v => v.status === 'yes').length;
            const isTen = dayYesCount >= 10;
            const isSelected = activeDateStr === day.dateStr;

            const userVote = currentUser
              ? dayVotes.find(v => v.userId === currentUser.id)
              : null;

            return (
              <div
                key={day.dateStr}
                onClick={() => setActiveDateStr(day.dateStr)}
                className={`cartoon-card p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                  isSelected
                    ? 'border-amber-400 bg-slate-900/95 ring-2 ring-amber-400/40'
                    : isTen
                    ? 'border-emerald-500/80 bg-emerald-950/20'
                    : 'border-slate-800 bg-slate-900/80 hover:border-slate-700'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-black font-gaming text-white uppercase">
                        {day.dayOfWeek}
                      </span>
                      <span className="text-xs text-slate-400 font-semibold">
                        • {day.formattedDate}
                      </span>
                      <span className="text-xs text-amber-400 font-bold">
                        (21h30)
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black font-gaming ${
                      isTen
                        ? 'bg-emerald-500 text-slate-950'
                        : dayYesCount >= 6
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-400'
                        : 'bg-slate-800 text-slate-300'
                    }`}>
                      {isTen ? <Trophy className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
                      <span>{dayYesCount}/10</span>
                    </span>

                    {userVote && (
                      <span className={`text-xs px-2.5 py-1 rounded-lg font-bold ${
                        userVote.status === 'yes'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : userVote.status === 'maybe'
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-red-500/20 text-red-300'
                      }`}>
                        {userVote.status === 'yes' ? '✓ Posso' : userVote.status === 'maybe' ? '? Talvez' : '✗ Não'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
