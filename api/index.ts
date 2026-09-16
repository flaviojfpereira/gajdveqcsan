import express from 'express';
import path from 'path';
import fs from 'fs';
import type { AppState, User, Vote, Comment, DaySchedule, TeamDistribution } from '../src/types.js';

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.raw({ type: ['audio/*', 'image/*', 'application/octet-stream'], limit: '50mb' }));

// Determine database path (/tmp on serverless or local data folder)
const LOCAL_DB = path.join(process.cwd(), 'data', 'database.json');
const TMP_DB = path.join('/tmp', 'database.json');

function generateInitialDays(): DaySchedule[] {
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
      slots: [{ id: 'night_cs', label: 'Noite de CS (21h30)', time: '21:30' }]
    });
  }
  return days;
}

let state: AppState = {
  users: [{ id: 'u_flavio', name: 'Flávio', avatarSeed: 'flavio', createdAt: new Date().toISOString() }],
  days: generateInitialDays(),
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

function getDbPath(): string {
  try {
    if (fs.existsSync(TMP_DB)) return TMP_DB;
    if (fs.existsSync(LOCAL_DB)) return LOCAL_DB;
    return TMP_DB;
  } catch {
    return TMP_DB;
  }
}

function loadDatabase() {
  try {
    // Serverless /tmp only. Never hydrate votes from the committed
    // data/database.json — that file is baked into every deploy and
    // would resurrect old votes on every cold start / new instance.
    if (fs.existsSync(TMP_DB)) {
      const data = fs.readFileSync(TMP_DB, 'utf-8');
      state = JSON.parse(data);
    }
  } catch (err) {
    console.error('Error loading DB:', err);
  }
}

function saveDatabase() {
  try {
    const target = fs.existsSync('/tmp') ? TMP_DB : LOCAL_DB;
    fs.writeFileSync(target, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving DB:', err);
  }
}

loadDatabase();

// --- API Endpoints ---

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.get('/api/state', (_req, res) => {
  loadDatabase();
  res.json(state);
});

app.post('/api/auth/login', (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Nome é obrigatório' });
  }

  const cleanName = name.trim();
  let user = state.users.find(u => u.name.toLowerCase() === cleanName.toLowerCase());

  if (!user) {
    user = {
      id: `u_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: cleanName,
      avatarSeed: cleanName.toLowerCase().replace(/\s+/g, '_'),
      createdAt: new Date().toISOString()
    };
    state.users.push(user);
    saveDatabase();
  }

  res.json({ success: true, user });
});

app.post('/api/votes', (req, res) => {
  const { userId, userName, dateStr, slotId, status } = req.body;
  if (!userId || !dateStr || !slotId) return res.status(400).json({ error: 'Parâmetros em falta' });

  let user = state.users.find(u => u.id === userId);
  if (!user) {
    const fallbackName = (userName && typeof userName === 'string' && userName.trim()) || 'Jogador';
    user = {
      id: userId,
      name: fallbackName,
      avatarSeed: fallbackName.toLowerCase().replace(/\s+/g, '_'),
      createdAt: new Date().toISOString()
    };
    state.users.push(user);
  }

  const idx = state.votes.findIndex(v => v.userId === userId && v.dateStr === dateStr && v.slotId === slotId);

  if (status === 'none') {
    if (idx !== -1) state.votes.splice(idx, 1);
  } else {
    const vote: Vote = {
      id: idx !== -1 ? state.votes[idx].id : `v_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId,
      userName: user.name,
      dateStr,
      slotId,
      status,
      updatedAt: new Date().toISOString()
    };
    if (idx !== -1) state.votes[idx] = vote;
    else state.votes.push(vote);
  }

  saveDatabase();
  res.json({ success: true, votes: state.votes });
});

app.post('/api/votes/bulk', (req, res) => {
  const { userId, userName, updates } = req.body;
  if (!userId || !Array.isArray(updates)) return res.status(400).json({ error: 'Parâmetros inválidos' });

  let user = state.users.find(u => u.id === userId);
  if (!user) {
    const fallbackName = (userName && typeof userName === 'string' && userName.trim()) || 'Jogador';
    user = {
      id: userId,
      name: fallbackName,
      avatarSeed: fallbackName.toLowerCase().replace(/\s+/g, '_'),
      createdAt: new Date().toISOString()
    };
    state.users.push(user);
  }

  if (Array.isArray(updates)) {
    for (const item of updates) {
      const idx = state.votes.findIndex(v => v.userId === userId && v.dateStr === item.dateStr && v.slotId === item.slotId);
      if (item.status === 'none') {
        if (idx !== -1) state.votes.splice(idx, 1);
      } else {
        const vote: Vote = {
          id: idx !== -1 ? state.votes[idx].id : `v_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          userId,
          userName: user.name,
          dateStr: item.dateStr,
          slotId: item.slotId,
          status: item.status,
          updatedAt: new Date().toISOString()
        };
        if (idx !== -1) state.votes[idx] = vote;
        else state.votes.push(vote);
      }
    }
  }

  saveDatabase();
  res.json({ success: true, votes: state.votes });
});

app.post('/api/comments', (req, res) => {
  const { userId, userName, text } = req.body;
  if (!userId || !text || !text.trim()) return res.status(400).json({ error: 'Mensagem vazia' });

  let user = state.users.find(u => u.id === userId);
  if (!user) {
    const fallbackName = (userName && typeof userName === 'string' && userName.trim()) || 'Jogador';
    user = {
      id: userId,
      name: fallbackName,
      avatarSeed: fallbackName.toLowerCase().replace(/\s+/g, '_'),
      createdAt: new Date().toISOString()
    };
    state.users.push(user);
  }

  const comment: Comment = {
    id: `c_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    userId,
    userName: user.name,
    text: text.trim(),
    createdAt: new Date().toISOString()
  };

  state.comments.unshift(comment);
  if (state.comments.length > 100) state.comments = state.comments.slice(0, 100);

  saveDatabase();
  res.json({ success: true, comments: state.comments });
});

app.post('/api/teams/generate', (req, res) => {
  const { dateStr, slotId } = req.body;
  const confirmedVotes = state.votes.filter(v => v.dateStr === dateStr && v.slotId === slotId && v.status === 'yes');
  const confirmedUsers = confirmedVotes.map(v => v.userName);

  const fallbackRoles = ['Entry Fragger', 'AWP Sniper', 'IGL Capitão', 'Lurker', 'Support'];
  const shuffled = [...confirmedUsers].sort(() => 0.5 - Math.random());

  const ctMembers = shuffled.slice(0, 5);
  const tMembers = shuffled.slice(5, 10);

  while (ctMembers.length < 5) ctMembers.push(`Bot Alpha ${ctMembers.length + 1}`);
  while (tMembers.length < 5) tMembers.push(`Bot Bravo ${tMembers.length + 1}`);

  const distribution: TeamDistribution = {
    dateStr,
    slotId,
    ctTeam: ctMembers.map((name, i) => ({ name, role: fallbackRoles[i % fallbackRoles.length] })),
    tTeam: tMembers.map((name, i) => ({ name, role: fallbackRoles[i % fallbackRoles.length] })),
    createdAt: new Date().toISOString()
  };

  if (!state.teams) state.teams = {};
  state.teams[`${dateStr}_${slotId}`] = distribution;
  saveDatabase();

  res.json({ success: true, distribution });
});

app.get('/api/audio/info', (_req, res) => {
  const audioPath = path.join(process.cwd(), 'public', 'audio', 'ninjas.mp3');
  try {
    if (fs.existsSync(audioPath)) {
      const stats = fs.statSync(audioPath);
      res.json({ exists: true, size: stats.size, mtime: stats.mtimeMs });
    } else {
      res.json({ exists: false });
    }
  } catch {
    res.json({ exists: false });
  }
});

app.get('/api/audio/track', (_req, res) => {
  const audioPath = path.join(process.cwd(), 'public', 'audio', 'ninjas.mp3');
  if (fs.existsSync(audioPath)) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Content-Type', 'audio/mpeg');
    fs.createReadStream(audioPath).pipe(res);
  } else {
    res.status(404).send('Audio not found');
  }
});

export default app;
