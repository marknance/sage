#!/bin/bash
set -e

echo "=============================="
echo "  Setting up Sage..."
echo "=============================="
echo ""

# Check Node.js 20+
if ! command -v node &> /dev/null; then
  echo "Error: Node.js is not installed. Please install Node.js 20 or higher."
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo "Error: Node.js 20+ is required. Found version $(node -v)."
  exit 1
fi

echo "Node.js $(node -v) detected."
echo ""

# Install backend dependencies
echo "Installing backend dependencies..."
cd server && npm install && cd ..
echo ""

# Install frontend dependencies
echo "Installing frontend dependencies..."
cd client && npm install && cd ..
echo ""

# Start backend in background
echo "Starting backend server..."
cd server && npx tsx src/index.ts &
BACKEND_PID=$!
cd ..

# Wait for backend to start
sleep 3

# Start frontend in background
echo "Starting frontend dev server..."
cd client && npx vite --host &
FRONTEND_PID=$!
cd ..

echo ""
echo "=============================="
echo "  Sage is running!"
echo "=============================="
echo ""
echo "  Backend:  http://localhost:3001"
echo "  Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

# Cleanup on exit
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" SIGINT SIGTERM

wait
