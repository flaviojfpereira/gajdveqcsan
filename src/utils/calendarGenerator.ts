import type { AppState, DaySchedule } from '../types.js';

export function generateDays(): DaySchedule[] {
  const days: DaySchedule[] = [];
  const baseDate = new Date();

  const ptWeekdays = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const ptMonths = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const startDay = new Date(baseDate);
  startDay.setDate(1);

  for (let i = 0; i < 60; i++) {
    const d = new Date(startDay);
    d.setDate(startDay.getDate() + i);

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const dayIdx = d.getDay();
    const isWeekend = dayIdx === 5 || dayIdx === 6 || dayIdx === 0;

    days.push({
      dateStr,
      dayOfWeek: ptWeekdays[dayIdx],
      formattedDate: `${d.getDate()} de ${ptMonths[d.getMonth()]}`,
      isWeekend,
      slots: [
        { id: 'night_cs', label: 'Noite de CS (21h30)', time: '21:30' }
      ]
    });
  }
  return days;
}

export function getDefaultAppState(): AppState {
  return {
    users: [
      {
        id: 'u_flavio',
        name: 'Flávio',
        avatarSeed: 'flavio',
        createdAt: new Date().toISOString()
      }
    ],
    days: generateDays(),
    votes: [],
    comments: [
      {
        id: 'c1',
        userId: 'u_flavio',
        userName: 'Flávio',
        text: 'Boas marretas! Vamos juntar os 10 para recordar as noites de CS! Votem no calendário em quando podem!',
        createdAt: new Date().toISOString()
      }
    ],
    teams: {}
  };
}
