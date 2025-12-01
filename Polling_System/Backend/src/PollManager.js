/**
 * Simple in-memory Poll Manager.
 * For production use persistent storage or Redis for multi-instance.
 */

const { v4: uuidv4 } = require('uuid');

let IO = null;
const polls = {}; // pollId -> poll object

module.exports = {
  _setIO(io) {
    IO = io;
  },
  
  createPoll({ pollId, question, options, duration = 60 }) {
    const id = pollId || uuidv4();
    polls[id] = {
      id,
      question,
      options: options.map((opt, idx) => ({ id: opt.id || `opt${idx+1}`, text: opt.text, votes: 0 })),
      duration,
      started: false,
      ended: false,
      students: {}, // socketId -> { name, answeredOptionId }
      votesHistory: [], // [{ socketId, name, optionId, ts }]
      timer: null,
      endTime: null
    };
    return polls[id];
  },

  getPoll(pollId) {
    return polls[pollId];
  },

  addStudent(pollId, socketId, name) {
    const p = polls[pollId];
    if (!p) return null;
    p.students[socketId] = { name, answeredOptionId: null };
    // broadcast updated counts to teacher/room
    this._broadcastStatus(pollId);
    return p;
  },

  removeStudentBySocket(socketId) {
    for (const pid of Object.keys(polls)) {
      const p = polls[pid];
      if (p.students && p.students[socketId]) {
        delete p.students[socketId];
        this._broadcastStatus(pid);
      }
    }
  },

  startPoll(pollId) {
    const p = polls[pollId];
    if (!p || p.started) return null;
    p.started = true;
    p.ended = false;
    p.endTime = Date.now() + p.duration * 1000;

    // schedule end
    p.timer = setTimeout(() => {
      this.endPoll(pollId);
    }, p.duration * 1000);

    // emit to room
    if (IO) {
      IO.to(pollId).emit('poll_started', {
        pollId: p.id,
        question: p.question,
        options: p.options,
        endTime: p.endTime
      });
    }
    return p;
  },

  submitVote(pollId, socketId, optionId) {
    const p = polls[pollId];
    if (!p || !p.started || p.ended) return { ok: false, reason: 'poll-not-running' };
    const student = p.students[socketId];
    if (!student) return { ok: false, reason: 'student-not-joined' };
    if (student.answeredOptionId) return { ok: false, reason: 'already-answered' };

    // increment vote
    const opt = p.options.find(o => o.id === optionId);
    if (!opt) return { ok: false, reason: 'invalid-option' };
    opt.votes += 1;
    student.answeredOptionId = optionId;
    student.answeredAt = Date.now();

    // record history for audit
    p.votesHistory.push({ socketId, name: student.name, optionId, ts: student.answeredAt });

    // emit live update
    this._broadcastUpdate(pollId);

    // check early finish
    const total = Object.keys(p.students).length;
    const answered = Object.values(p.students).filter(s => s.answeredOptionId).length;
    if (total > 0 && answered >= total) {
      // end early
      this.endPoll(pollId);
    }

    return { ok: true };
  },

  endPoll(pollId) {
    const p = polls[pollId];
    if (!p || p.ended) return;
    p.ended = true;
    p.started = false;
    if (p.timer) {
      clearTimeout(p.timer);
      p.timer = null;
    }
    if (IO) {
      IO.to(pollId).emit('poll_ended', {
        pollId: p.id,
        results: p.options
      });
      this._broadcastStatus(pollId);
    }
  },

  _broadcastUpdate(pollId) {
    const p = polls[pollId];
    if (!p || !IO) return;
    IO.to(pollId).emit('poll_update', {
      pollId: p.id,
      options: p.options,
      answeredCount: Object.values(p.students).filter(s => s.answeredOptionId).length,
      totalStudents: Object.keys(p.students).length
    });
  },

  _broadcastStatus(pollId) {
    const p = polls[pollId];
    if (!p || !IO) return;
    IO.to(pollId).emit('poll_status', {
      pollId: p.id,
      started: p.started,
      ended: p.ended,
      answeredCount: Object.values(p.students).filter(s => s.answeredOptionId).length,
      totalStudents: Object.keys(p.students).length
    });
  }
};
