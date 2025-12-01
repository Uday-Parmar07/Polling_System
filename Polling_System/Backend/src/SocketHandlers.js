/**
 * Socket event handlers. Exports a function that registers handlers for a socket.
 */

module.exports = function(io, socket, PollManager) {

  // student or teacher joins a poll room
  socket.on('join_poll', ({ pollId, name, role }) => {
    if (!pollId) {
      socket.emit('error', { reason: 'missing-pollId' });
      return;
    }
    socket.join(pollId);
    // add student only if role is 'student'
    if (role === 'student') {
      PollManager.addStudent(pollId, socket.id, name || 'Anonymous');
    }
    // ack join
    socket.emit('joined_poll', { pollId });
    // broadcast status
    // PollManager will emit status internally on addStudent
  });

  // teacher creates a poll
  socket.on('create_poll', ({ pollId, question, options, duration }) => {
    if (!question || !Array.isArray(options) || options.length < 2) {
      socket.emit('error', { reason: 'invalid-poll' });
      return;
    }
    const p = PollManager.createPoll({ pollId, question, options, duration });
    // teacher socket joins room for ease
    socket.join(p.id);
    socket.emit('poll_created', { pollId: p.id });
  });

  // teacher starts poll
  socket.on('start_poll', ({ pollId }) => {
    const p = PollManager.startPoll(pollId);
    if (!p) {
      socket.emit('error', { reason: 'cannot-start' });
    }
  });

  // student submits a vote
  socket.on('submit_vote', ({ pollId, optionId }) => {
    const res = PollManager.submitVote(pollId, socket.id, optionId);
    socket.emit('vote_ack', res);
  });

  // optional: teacher can force end
  socket.on('end_poll', ({ pollId }) => {
    PollManager.endPoll(pollId);
  });
};
