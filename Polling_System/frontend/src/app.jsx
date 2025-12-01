import React, { useEffect, useState, useRef } from 'react'
import { io } from 'socket.io-client'

const SERVER = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000'

function useSocket() {
  const socketRef = useRef(null)
  useEffect(() => {
    const s = io(SERVER)
    socketRef.current = s
    return () => s.disconnect()
  }, [])
  return socketRef
}

// Ensure the socket is connected before emitting events
async function ensureConnected(socket) {
  if (!socket) throw new Error('no-socket')
  if (socket.connected) return
  await new Promise((resolve) => socket.once('connect', resolve))
}

function Home({ onChoose }) {
  return (
    <div style={{ padding: 20 }}>
      <h1>Polling System</h1>
      <button onClick={() => onChoose('teacher')}>I'm a teacher</button>
      <button onClick={() => onChoose('student')} style={{ marginLeft: 8 }}>
        I'm a student
      </button>
    </div>
  )
}

function Teacher({ socketRef }) {
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState('Red,Blue,Green')
  const [poll, setPoll] = useState(null)
  const [status, setStatus] = useState(null)

  useEffect(() => {
    const s = socketRef.current
    if (!s) return
    s.on('poll_update', (data) => setStatus(data))
    s.on('poll_status', (data) => setStatus(data))
    s.on('poll_ended', (data) => setStatus({ ended: true, results: data.results }))
    return () => {
      s.off('poll_update')
      s.off('poll_status')
      s.off('poll_ended')
    }
  }, [socketRef])

  async function createPoll() {
    const opts = options.split(',').map((t) => ({ text: t.trim() }))
    const res = await fetch(`${SERVER}/polls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, options: opts })
    })
    const j = await res.json()
    if (j.ok) {
      setPoll(j.poll)
      // have teacher join socket room - wait for socket connection first
      try {
        await ensureConnected(socketRef.current)
        socketRef.current.emit('join_poll', { pollId: j.poll.id, role: 'teacher' })
      } catch (e) {
        console.warn('Socket not connected; teacher will not join room immediately', e)
      }
    } else {
      alert('Error creating poll: ' + (j.reason || 'unknown'))
    }
  }

  async function startPoll() {
    if (!poll) return
    const res = await fetch(`${SERVER}/polls/${poll.id}/start`, { method: 'POST' })
    const j = await res.json()
    if (!j.ok) alert('Could not start poll')
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Teacher</h2>
      <div>
        <label>Question</label>
        <br />
        <input value={question} onChange={(e) => setQuestion(e.target.value)} style={{ width: 400 }} />
      </div>
      <div style={{ marginTop: 8 }}>
        <label>Options (comma separated)</label>
        <br />
        <input value={options} onChange={(e) => setOptions(e.target.value)} style={{ width: 400 }} />
      </div>
      <div style={{ marginTop: 8 }}>
        <button onClick={createPoll}>Create Poll</button>
        {poll && <button onClick={startPoll} style={{ marginLeft: 8 }}>Start Poll</button>}
      </div>

      {poll && (
        <div style={{ marginTop: 12 }}>
          <div><strong>Poll ID:</strong> {poll.id}</div>
          <div><strong>Question:</strong> {poll.question}</div>
          <div>
            <strong>Options:</strong>
            <ul>
              {poll.options.map((o) => (
                <li key={o.id}>{o.text} — votes: {o.votes}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {status && (
        <div style={{ marginTop: 12 }}>
          <h3>Live status</h3>
          <pre>{JSON.stringify(status, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}

function Student({ socketRef }) {
  const [pollId, setPollId] = useState('')
  const [name, setName] = useState('Student')
  const [joined, setJoined] = useState(false)
  const [poll, setPoll] = useState(null)
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState(null)

  useEffect(() => {
    const s = socketRef.current
    if (!s) return
    s.on('poll_started', (data) => {
      setPoll({ id: data.pollId, question: data.question, options: data.options })
      setRunning(true)
    })
    s.on('poll_update', (data) => {
      setPoll((p) => p ? { ...p, options: data.options } : p)
    })
    s.on('poll_ended', (data) => {
      setResults(data.results)
      setRunning(false)
    })
    return () => {
      s.off('poll_started')
      s.off('poll_update')
      s.off('poll_ended')
    }
  }, [socketRef])

  async function join() {
    // connect and emit join_poll
    try {
      await ensureConnected(socketRef.current)
      socketRef.current.emit('join_poll', { pollId, name, role: 'student' })
    } catch (e) {
      console.warn('Socket not connected; join_poll may not be received', e)
    }
    setJoined(true)
    // fetch current poll state
    const res = await fetch(`${SERVER}/polls/${pollId}`)
    const j = await res.json()
    if (j.ok) setPoll(j.poll)
  }

  function vote(optionId) {
    socketRef.current.emit('submit_vote', { pollId, optionId })
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Student</h2>
      {!joined ? (
        <div>
          <div>
            <label>Poll ID</label>
            <br />
            <input value={pollId} onChange={(e) => setPollId(e.target.value)} />
          </div>
          <div style={{ marginTop: 8 }}>
            <label>Name</label>
            <br />
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div style={{ marginTop: 8 }}>
            <button onClick={join}>Join Poll</button>
          </div>
        </div>
      ) : (
        <div>
          {poll ? (
            <div>
              <h3>{poll.question}</h3>
              <ul>
                {poll.options.map((o) => (
                  <li key={o.id}>
                    {o.text} — votes: {o.votes} <button onClick={() => vote(o.id)} disabled={!running}>Vote</button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div>Waiting for poll to start...</div>
          )}
          {results && (
            <div>
              <h4>Results</h4>
              <pre>{JSON.stringify(results, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function App() {
  const [role, setRole] = useState(null)
  const socketRef = useSocket()

  if (!role) return <Home onChoose={setRole} />
  if (role === 'teacher') return <Teacher socketRef={socketRef} />
  return <Student socketRef={socketRef} />
}
