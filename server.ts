import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import type { AppState, User, Vote, Comment, DaySchedule, TeamDistribution } from "./src/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.raw({ type: ["audio/*", "image/*", "application/octet-stream"], limit: "50mb" }));

const DB_FILE = path.join(__dirname, "data", "database.json");

// Generate upcoming 42 days for calendar month view
function generateInitialDays(): DaySchedule[] {
  const days: DaySchedule[] = [];
  const baseDate = new Date();
  
  const ptWeekdays = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  const ptMonths = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  // Start from the beginning of current week or month
  const startDay = new Date(baseDate);
  // Shift back to the first day of the current month
  startDay.setDate(1);

  // Generate 60 days to comfortably cover current month and next month
  for (let i = 0; i < 60; i++) {
    const d = new Date(startDay);
    d.setDate(startDay.getDate() + i);
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const dateStr = `${year}-${month}-${day}`;
    
    const dayIdx = d.getDay();
    const isWeekend = dayIdx === 5 || dayIdx === 6 || dayIdx === 0; // Fri, Sat, Sun

    days.push({
      dateStr,
      dayOfWeek: ptWeekdays[dayIdx],
      formattedDate: `${d.getDate()} de ${ptMonths[d.getMonth()]}`,
      isWeekend,
      slots: [
        { id: "night_cs", label: "Noite de CS (21h30)", time: "21:30" }
      ]
    });
  }
  return days;
}

// Initial state with ONLY Flávio as requested by the user
function getInitialState(): AppState {
  const days = generateInitialDays();
  
  const defaultUsers: User[] = [
    { id: "u_flavio", name: "Flávio", avatarSeed: "flavio", createdAt: new Date().toISOString() }
  ];

  const defaultVotes: Vote[] = [];

  const defaultComments: Comment[] = [
    {
      id: "c1",
      userId: "u_flavio",
      userName: "Flávio",
      text: "Boas marretas! Vamos juntar os 10 para recordar as noites de CS! Votem no calendário em quando podem!",
      createdAt: new Date().toISOString()
    }
  ];

  return {
    users: defaultUsers,
    days,
    votes: defaultVotes,
    comments: defaultComments,
    teams: {}
  };
}

// Load or initialize state
let state: AppState = getInitialState();

function loadDatabase() {
  try {
    const dataDir = path.join(__dirname, "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, "utf-8");
      const loaded = JSON.parse(raw);
      // Merge with newly calculated days if needed
      if (loaded.votes && loaded.users) {
        state = {
          ...loaded,
          days: loaded.days && loaded.days.length > 0 ? loaded.days : generateInitialDays()
        };
      }
    } else {
      saveDatabase();
    }
  } catch (err) {
    console.error("Error loading database:", err);
  }
}

function saveDatabase() {
  try {
    const dataDir = path.join(__dirname, "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving database:", err);
  }
}

loadDatabase();

// --- API Endpoints ---

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

// Get current state
app.get("/api/state", (_req, res) => {
  res.json(state);
});

// Login or register user (Login is name, password is the same name)
app.post("/api/auth/login", (req, res) => {
  const { name, password } = req.body;
  
  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "O nome é obrigatório" });
  }

  const cleanName = name.trim();
  
  // Rule: password must be the same as name
  if (password && password.trim().toLowerCase() !== cleanName.toLowerCase()) {
    return res.status(401).json({ error: "A password deve ser igual ao teu nome!" });
  }

  // Find existing user or create
  let user = state.users.find(u => u.name.toLowerCase() === cleanName.toLowerCase());
  if (!user) {
    user = {
      id: `u_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: cleanName,
      avatarSeed: cleanName.toLowerCase(),
      createdAt: new Date().toISOString()
    };
    state.users.push(user);
    saveDatabase();
  }

  return res.json({ success: true, user });
});

// Submit / Toggle a vote
app.post("/api/votes", (req, res) => {
  const { userId, userName, dateStr, slotId, status } = req.body;
  
  if (!userId || !dateStr || !slotId) {
    return res.status(400).json({ error: "Parâmetros em falta" });
  }

  let user = state.users.find(u => u.id === userId);
  if (!user) {
    const fallbackName = (userName && typeof userName === "string" && userName.trim()) || "Jogador";
    user = {
      id: userId,
      name: fallbackName,
      avatarSeed: fallbackName.toLowerCase().replace(/\s+/g, "_"),
      createdAt: new Date().toISOString()
    };
    state.users.push(user);
  }

  // Find existing vote
  const existingIdx = state.votes.findIndex(
    v => v.userId === userId && v.dateStr === dateStr && v.slotId === slotId
  );

  if (!status || status === "none") {
    // Remove vote
    if (existingIdx !== -1) {
      state.votes.splice(existingIdx, 1);
    }
  } else {
    const voteData: Vote = {
      id: existingIdx !== -1 ? state.votes[existingIdx].id : `v_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId,
      userName: user.name,
      dateStr,
      slotId,
      status,
      updatedAt: new Date().toISOString()
    };

    if (existingIdx !== -1) {
      state.votes[existingIdx] = voteData;
    } else {
      state.votes.push(voteData);
    }
  }

  saveDatabase();
  res.json({ success: true, votes: state.votes });
});

// Bulk vote (e.g. "Posso todas as sextas", "Limpar tudo")
app.post("/api/votes/bulk", (req, res) => {
  const { userId, userName, updates } = req.body;
  
  if (!userId || !Array.isArray(updates)) {
    return res.status(400).json({ error: "Parâmetros inválidos" });
  }

  let user = state.users.find(u => u.id === userId);
  if (!user) {
    const fallbackName = (userName && typeof userName === "string" && userName.trim()) || "Jogador";
    user = {
      id: userId,
      name: fallbackName,
      avatarSeed: fallbackName.toLowerCase().replace(/\s+/g, "_"),
      createdAt: new Date().toISOString()
    };
    state.users.push(user);
  }

  updates.forEach(({ dateStr, slotId, status }: { dateStr: string; slotId: string; status: "yes" | "maybe" | "no" | "none" }) => {
    const existingIdx = state.votes.findIndex(
      v => v.userId === userId && v.dateStr === dateStr && v.slotId === slotId
    );

    if (status === "none") {
      if (existingIdx !== -1) {
        state.votes.splice(existingIdx, 1);
      }
    } else {
      const voteData: Vote = {
        id: existingIdx !== -1 ? state.votes[existingIdx].id : `v_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        userId,
        userName: user.name,
        dateStr,
        slotId,
        status,
        updatedAt: new Date().toISOString()
      };

      if (existingIdx !== -1) {
        state.votes[existingIdx] = voteData;
      } else {
        state.votes.push(voteData);
      }
    }
  });

  saveDatabase();
  res.json({ success: true, votes: state.votes });
});

// Add comment to shoutbox
app.post("/api/comments", (req, res) => {
  const { userId, userName, text, dateStr } = req.body;
  
  if (!userId || !text || !text.trim()) {
    return res.status(400).json({ error: "Mensagem vazia" });
  }

  let user = state.users.find(u => u.id === userId);
  if (!user) {
    const fallbackName = (userName && typeof userName === "string" && userName.trim()) || "Jogador";
    user = {
      id: userId,
      name: fallbackName,
      avatarSeed: fallbackName.toLowerCase().replace(/\s+/g, "_"),
      createdAt: new Date().toISOString()
    };
    state.users.push(user);
  }

  const newComment: Comment = {
    id: `c_${Date.now()}`,
    userId,
    userName: user.name,
    text: text.trim().slice(0, 300),
    createdAt: new Date().toISOString(),
    dateStr
  };

  state.comments.unshift(newComment);
  // keep max 50 comments
  if (state.comments.length > 50) {
    state.comments = state.comments.slice(0, 50);
  }

  saveDatabase();
  res.json({ success: true, comments: state.comments });
});

// Generate 5v5 balanced / randomized teams for a slot
app.post("/api/teams/generate", (req, res) => {
  const { dateStr, slotId } = req.body;
  
  if (!dateStr || !slotId) {
    return res.status(400).json({ error: "Data e horário necessários" });
  }

  // Get all 'yes' voters
  const confirmedVotes = state.votes.filter(
    v => v.dateStr === dateStr && v.slotId === slotId && v.status === "yes"
  );

  const playerNames = confirmedVotes.map(v => v.userName);
  
  // Shuffle players
  const shuffled = [...playerNames].sort(() => 0.5 - Math.random());
  
  const roles = ["AWPer", "Entry Fragger", "IGL (Capitão)", "Lurker", "Support"];
  
  const ctPlayers = shuffled.slice(0, 5).map((name, idx) => ({
    name,
    role: roles[idx] || "Rifler"
  }));

  const tPlayers = shuffled.slice(5, 10).map((name, idx) => ({
    name,
    role: roles[idx] || "Rifler"
  }));

  const teamKey = `${dateStr}_${slotId}`;
  const distribution: TeamDistribution = {
    dateStr,
    slotId,
    ctTeam: ctPlayers,
    tTeam: tPlayers,
    createdAt: new Date().toISOString()
  };

  state.teams[teamKey] = distribution;
  saveDatabase();

  res.json({ success: true, distribution });
});

// Serve the current audio track with strict no-cache headers so browser always gets the latest file
app.get("/api/audio/track", (_req, res) => {
  const audioPath = path.join(__dirname, "public", "audio", "ninjas.mp3");
  if (fs.existsSync(audioPath)) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Content-Type", "audio/mpeg");
    return res.sendFile(audioPath);
  }
  res.status(404).send("Audio not found");
});

// Audio file metadata
app.get("/api/audio/info", (_req, res) => {
  const audioPath = path.join(__dirname, "public", "audio", "ninjas.mp3");
  if (fs.existsSync(audioPath)) {
    const stats = fs.statSync(audioPath);
    return res.json({
      exists: true,
      size: stats.size,
      mtime: stats.mtimeMs
    });
  }
  res.json({ exists: false });
});

// Upload and replace custom MP3 file on server
app.post("/api/audio/upload", (req, res) => {
  try {
    const audioDir = path.join(__dirname, "public", "audio");
    if (!fs.existsSync(audioDir)) {
      fs.mkdirSync(audioDir, { recursive: true });
    }
    const targetFile = path.join(audioDir, "ninjas.mp3");

    if (Buffer.isBuffer(req.body) && req.body.length > 0) {
      fs.writeFileSync(targetFile, req.body);
    } else if (req.body && req.body.base64) {
      const buffer = Buffer.from(req.body.base64, "base64");
      fs.writeFileSync(targetFile, buffer);
    } else {
      return res.status(400).json({ error: "Ficheiro áudio vazio ou inválido" });
    }

    const distAudioDir = path.join(__dirname, "dist", "audio");
    if (fs.existsSync(distAudioDir)) {
      fs.copyFileSync(targetFile, path.join(distAudioDir, "ninjas.mp3"));
    }

    const stats = fs.statSync(targetFile);
    console.log("Updated ninjas.mp3 successfully, size:", stats.size);
    res.json({
      success: true,
      message: "Música guardada com sucesso no servidor!",
      mtime: stats.mtimeMs,
      size: stats.size
    });
  } catch (err) {
    console.error("Audio save error:", err);
    res.status(500).json({ error: "Falha ao gravar ficheiro" });
  }
});

// Upload and replace custom banner image on server
app.post("/api/banner/upload", (req, res) => {
  try {
    const targetPublicFile = path.join(__dirname, "public", "banner.jpg");

    if (Buffer.isBuffer(req.body) && req.body.length > 0) {
      fs.writeFileSync(targetPublicFile, req.body);
    } else if (req.body && req.body.base64) {
      const buffer = Buffer.from(req.body.base64, "base64");
      fs.writeFileSync(targetPublicFile, buffer);
    } else {
      return res.status(400).json({ error: "Ficheiro de imagem vazio ou inválido" });
    }

    const distDir = path.join(__dirname, "dist");
    if (fs.existsSync(distDir)) {
      fs.copyFileSync(targetPublicFile, path.join(distDir, "banner.jpg"));
    }

    console.log("Updated banner.jpg successfully via upload endpoint");
    res.json({ success: true, message: "Banner atualizado com sucesso!" });
  } catch (err) {
    console.error("Banner upload error:", err);
    res.status(500).json({ error: "Falha ao atualizar imagem do banner" });
  }
});

// Vite middleware for development vs Production static serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`GAJDVEQCSAN Server running on http://localhost:${PORT}`);
  });
}

startServer();
