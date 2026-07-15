#!/bin/bash

# ============================================
# Cloud Video Platform - AWS Deployment Script
# ============================================
# This script automates the deployment process
# for EC2 instances.
#
# Prerequisites:
# - Node.js 18+ installed
# - PM2 installed globally (npm install -g pm2)
# - Git repository cloned
# - Environment variables configured
# ============================================

echo "============================================"
echo "  Cloud Video Platform - Deployment Script"
echo "============================================"

# 1. Navigate to project root
cd /home/ec2-user/cloud-video-platform || exit

# 2. Pull latest changes
echo "[1/6] Pulling latest code from repository..."
git pull origin main

# 3. Install backend dependencies
echo "[2/6] Installing backend dependencies..."
cd backend
npm install --production

# 4. Build frontend
echo "[3/6] Building frontend application..."
cd ../frontend
npm install
npm run build

# 5. Restart backend server
echo "[4/6] Restarting backend server..."
cd ../backend
pm2 restart cloud-video-api || pm2 start server.js --name cloud-video-api

# 6. Verify deployment
echo "[5/6] Verifying deployment..."
sleep 3
curl -s http://localhost:5000/api/health | grep -q "success" && echo "API is running!" || echo "API check failed"

echo "[6/6] Deployment complete!"
echo "============================================"
echo "  Frontend: http://your-ec2-public-ip:5173"
echo "  Backend:  http://your-ec2-public-ip:5000"
echo "  API Docs: http://your-ec2-public-ip:5000/api/health"
echo "============================================"