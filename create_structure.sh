#!/usr/bin/env bash
set -e

PROJECT_NAME=${1:-Polling_System}
ROOT_DIR=$(pwd)/${PROJECT_NAME}

echo "Creating project at: ${ROOT_DIR}"
mkdir -p "$ROOT_DIR"
cd "$ROOT_DIR"

###########################################
# FRONTEND
###########################################

echo "Setting up FRONTEND..."

mkdir -p frontend
cd frontend
npm init -y

npm install react react-dom react-router-dom socket.io-client @reduxjs/toolkit react-redux
npm install -D vite tailwindcss postcss autoprefixer @vitejs/plugin-react eslint prettier

npx tailwindcss init -p

# index.html
cat > index.html << EOF
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Live Polling System</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
EOF

mkdir -p src/{components,pages,hooks,styles,slices,services}

# main.jsx
cat > src/main.jsx << EOF
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/tailwind.css';

createRoot(document.getElementById('root')).render(<App />);
EOF

# App.jsx
cat > src/App.jsx << EOF
import React from 'react';
export default function App() {
  return (
    <div style={{color:'white'}}>
      Frontend scaffold works!
    </div>
  );
}
EOF

# tailwind.css
cat > src/styles/tailwind.css << EOF
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --purple-1: #7765DA;
  --purple-2: #5767D0;
  --purple-3: #4F0DCE;
  --bg: #F2F2F2;
  --text-dark: #373737;
  --muted: #6E6E6E;
}
EOF

# vite.config.js
cat > vite.config.js << EOF
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
EOF

# update package.json scripts
node -e "let p=require('./package.json'); p.scripts={dev:'vite', build:'vite build', preview:'vite preview'}; require('fs').writeFileSync('package.json', JSON.stringify(p,null,2));"

cd "$ROOT_DIR"

###########################################
# BACKEND
###########################################

echo "Setting up BACKEND..."

mkdir -p backend
cd backend
npm init -y

npm install express socket.io cors
npm install -D nodemon

mkdir -p src

cat > src/index.js << EOF
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

io.on('connection', (socket) => {
  console.log('socket connected', socket.id);

  socket.on('join_poll', (data) => {
    console.log('join_poll', data);
  });
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log("Backend running on PORT", PORT));
EOF

node -e "let p=require('./package.json'); p.scripts={dev:'nodemon src/index.js', start:'node src/index.js'}; require('fs').writeFileSync('package.json', JSON.stringify(p,null,2));"

cd "$ROOT_DIR"

###########################################
# REQUIREMENTS
###########################################
cat > requirements.txt << EOF
gunicorn==20.1.0
pre-commit==2.20.0
EOF

echo "✔ Project setup complete!"
echo "➡ Frontend: cd $PROJECT_NAME/frontend && npm install && npm run dev"
echo "➡ Backend:  cd $PROJECT_NAME/backend && npm install && npm run dev"
