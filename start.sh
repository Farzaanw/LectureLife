#!/bin/bash

NGROK_URL="https://lining-quintet-flock.ngrok-free.dev"

echo "Starting LectureLife..."

# Kill any existing processes on ports
kill $(lsof -ti:3001) 2>/dev/null
kill $(lsof -ti:3333) 2>/dev/null
kill $(lsof -ti:5173) 2>/dev/null
kill $(lsof -ti:4040) 2>/dev/null

sleep 2

# 1. Start server
echo "Starting server..."
cd ~/Hack/PhysioAI/server
NGROK_URL=$NGROK_URL node index.js &
SERVER_PID=$!
sleep 3

# 2. Start agent workflow (reads ANTHROPIC_API_KEY from AgentWorkflow/.env)
echo "Starting agent workflow..."
cd ~/Hack/PhysioAI/AgentWorkflow
npx tsx src/api/server.ts &
AGENT_PID=$!
sleep 4

# 3. Start ngrok
echo "Starting ngrok..."
ngrok http --url=lining-quintet-flock.ngrok-free.dev 3001 &
NGROK_PID=$!
sleep 2

# 4. Start frontend
echo "Starting frontend..."
cd ~/Hack/PhysioAI/frontend
npm run dev &
FRONTEND_PID=$!

echo ""
echo "All services running!"
echo "   Teacher app:  http://localhost:5173"
echo "   Student view: $NGROK_URL/student"
echo ""
echo "Press Ctrl+C to stop everything."

trap "echo 'Stopping...'; kill $SERVER_PID $AGENT_PID $NGROK_PID $FRONTEND_PID 2>/dev/null; exit" INT
wait
