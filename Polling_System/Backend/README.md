# Polling Backend

This backend exposes basic REST endpoints and Socket.IO handlers for a simple in-memory polling system.

Run:

```bash
cd Backend
npm install
npm run dev
# or
node src/index.js
```

Health check:

```bash
curl http://localhost:4000/health
```

Create a poll (example):

```bash
curl -s -X POST http://localhost:4000/polls \
  -H "Content-Type: application/json" \
  -d '{ "question": "Favorite color?", "options": [{"text":"Red"},{"text":"Blue"}] }'
```

Join a poll (adds a student with a synthetic socket id for testing):

```bash
curl -s -X POST http://localhost:4000/polls/<POLL_ID>/join \
  -H "Content-Type: application/json" \
  -d '{ "socketId": "test-student-1", "name": "Alice" }'
```

Start a poll:

```bash
curl -s -X POST http://localhost:4000/polls/<POLL_ID>/start
```

Submit a vote:

```bash
curl -s -X POST http://localhost:4000/polls/<POLL_ID>/vote \
  -H "Content-Type: application/json" \
  -d '{ "socketId": "test-student-1", "optionId": "opt1" }'
```

Get poll state:

```bash
curl http://localhost:4000/polls/<POLL_ID>
```
