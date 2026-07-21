#!/bin/bash
# Restart backend server (for EC2/PM2 or local dev)
cd "$(dirname "$0")/backend"

if command -v pm2 &> /dev/null; then
  echo "Restarting with PM2..."
  pm2 restart all
else
  echo "PM2 not found. Please restart your backend server manually."
  echo "If running locally: Ctrl+C then npm start"
fi