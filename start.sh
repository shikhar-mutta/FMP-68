#!/bin/bash

# FMP-68 - Start Dev Servers
# Run: ./start.sh

ROOT_DIR=$(pwd)
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

echo ""
echo -e "\e[36mFMP-68 Dev Server Launcher\e[0m"
echo ""
echo -e "\e[32m  Starting Backend  -> http://localhost:4000\e[0m"
echo -e "\e[32m  Starting Frontend -> http://localhost:3000\e[0m"
echo ""

# Function to start a new terminal
start_terminal() {
    local title=$1
    local cmd=$2
    
    if command -v gnome-terminal &> /dev/null; then
        gnome-terminal --title="$title" -- bash -c "$cmd; exec bash"
    elif command -v xfce4-terminal &> /dev/null; then
        xfce4-terminal --title="$title" -x bash -c "$cmd; exec bash"
    elif command -v konsole &> /dev/null; then
        konsole --title "$title" -e bash -c "$cmd; exec bash" &
    elif command -v xterm &> /dev/null; then
        xterm -T "$title" -e bash -c "$cmd; exec bash" &
    else
        echo -e "\e[31mNo supported terminal emulator found (gnome-terminal, xfce4-terminal, konsole, xterm). Please install one.\e[0m"
        # Fallback to background processes in the same terminal
        echo "Starting in background..."
        bash -c "$cmd" &
    fi
}

echo -e "\e[32m[BACKEND] Starting NestJS...\e[0m"
start_terminal "Backend Server" "cd \"$BACKEND_DIR\" && echo -e '\e[32m[BACKEND] Starting NestJS...\e[0m' && npm run start:dev"

sleep 2

echo -e "\e[34m[FRONTEND] Starting React...\e[0m"
start_terminal "Frontend Server" "cd \"$FRONTEND_DIR\" && export DANGEROUSLY_DISABLE_HOST_CHECK=true && export HOST=localhost && export REACT_APP_API_URL=http://localhost:4000 && echo -e '\e[34m[FRONTEND] Starting React...\e[0m' && npm start"

echo -e "\e[33mBoth servers launched in separate windows (or in background if no terminal emulator was found)!\e[0m"
echo ""
