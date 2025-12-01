const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const PollManager = require("./PollManager");
const registerSocketHandlers = require("./SocketHandlers");

console.log("DEBUG: index.js started");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

function sanitizePoll(p) {
  if (!p) return null;
  return {
    id: p.id,
    question: p.question,
    options: p.options,
    duration: p.duration,
    started: p.started,
    ended: p.ended,
    endTime: p.endTime,
    totalStudents: p.students ? Object.keys(p.students).length : 0,
    answeredCount: p.students ? Object.values(p.students).filter(s => s.answeredOptionId).length : 0
  };
}

// REST: Create a poll
app.post('/polls', (req, res) => {
  const { pollId, question, options, duration } = req.body;
  if (!question || !Array.isArray(options) || options.length < 2) {
    return res.status(400).json({ ok: false, reason: 'invalid-poll' });
  }
  const p = PollManager.createPoll({ pollId, question, options, duration });
  return res.json({ ok: true, poll: sanitizePoll(p) });
});

// REST: Join a poll (adds a student)
app.post('/polls/:pollId/join', (req, res) => {
  const { pollId } = req.params;
  const { socketId, name } = req.body;
  if (!socketId) return res.status(400).json({ ok: false, reason: 'missing-socketId' });
  const p = PollManager.addStudent(pollId, socketId, name || 'Anonymous');
  if (!p) return res.status(404).json({ ok: false, reason: 'poll-not-found' });
  return res.json({ ok: true, poll: sanitizePoll(p) });
});

// REST: Start a poll
app.post('/polls/:pollId/start', (req, res) => {
  const { pollId } = req.params;
  const p = PollManager.startPoll(pollId);
  if (!p) return res.status(400).json({ ok: false, reason: 'cannot-start' });
  return res.json({ ok: true, poll: sanitizePoll(p) });
});

// REST: Submit a vote
app.post('/polls/:pollId/vote', (req, res) => {
  const { pollId } = req.params;
  const { socketId, optionId } = req.body;
  if (!socketId || !optionId) return res.status(400).json({ ok: false, reason: 'missing-params' });
  const result = PollManager.submitVote(pollId, socketId, optionId);
  if (!result.ok) return res.status(400).json(result);
  // return updated poll status
  const p = PollManager.getPoll(pollId);
  return res.json({ ...result, poll: sanitizePoll(p) });
});

// REST: Get poll
app.get('/polls/:pollId', (req, res) => {
  const { pollId } = req.params;
  const p = PollManager.getPoll(pollId);
  if (!p) return res.status(404).json({ ok: false, reason: 'not-found' });
  return res.json({ ok: true, poll: sanitizePoll(p) });
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// attach io to PollManager so timers can emit
PollManager._setIO(io);

io.on("connection", (socket) => {
  console.log("🟢 Client connected:", socket.id);
  registerSocketHandlers(io, socket, PollManager);

  socket.on("disconnect", () => {
    console.log("🔴 Client disconnected:", socket.id);
    PollManager.removeStudentBySocket(socket.id);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`);
});
