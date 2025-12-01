const { io } = require('socket.io-client');

(async () => {
  const SERVER = process.env.SERVER || 'http://localhost:4000';
  console.log('SERVER ->', SERVER);

  try {
    const createRes = await fetch(`${SERVER}/polls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'Integration test?', options: [{ text: 'Yes' }, { text: 'No' }] })
    });
    const j = await createRes.json();
    if (!j.ok) {
      console.error('Create poll failed', j);
      process.exit(2);
    }
    const pollId = j.poll.id;
    console.log('Created poll', pollId);

    const teacher = io(SERVER, { reconnectionDelayMax: 1000 });
    const student = io(SERVER, { reconnectionDelayMax: 1000 });

    teacher.on('connect', () => {
      console.log('teacher connected', teacher.id);
      teacher.emit('join_poll', { pollId, role: 'teacher' });
    });

    student.on('connect', () => {
      console.log('student connected', student.id);
      student.emit('join_poll', { pollId, role: 'student', name: 'Tester' });
    });

    student.on('poll_started', (data) => {
      console.log('student got poll_started', data);
      const optId = data.options && data.options[0] && data.options[0].id;
      if (optId) {
        console.log('student voting for', optId);
        student.emit('submit_vote', { pollId, optionId: optId });
      }
    });

    teacher.on('poll_update', (data) => {
      console.log('teacher poll_update', data);
    });

    teacher.on('poll_ended', (data) => {
      console.log('teacher poll_ended', data);
      process.exit(0);
    });

    setTimeout(async () => {
      console.log('Starting poll via REST');
      try {
        const sres = await fetch(`${SERVER}/polls/${pollId}/start`, { method: 'POST' });
        const txt = await sres.text();
        try {
          console.log('start result', JSON.parse(txt));
        } catch (e) {
          console.log('start returned non-json text (status', sres.status, '):');
          console.log(txt.slice(0, 1000));
        }
      } catch (err) {
        console.error('start fetch error', err);
      }
    }, 1000);

    setTimeout(() => {
      console.error('Test timed out');
      process.exit(3);
    }, 15000);
  } catch (err) {
    console.error('Test error', err);
    process.exit(4);
  }
})();
