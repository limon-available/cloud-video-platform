/**
 * PM2 Ecosystem Configuration for EC2 Deployment
 * 
 * This file configures the Node.js application for production
 * deployment on Amazon EC2 using PM2 process manager.
 * 
 * Architecture:
 * - EC2 hosts the Express API server
 * - PM2 ensures auto-restart on failure
 * - Nginx (optional) can be used as reverse proxy
 */
module.exports = {
  apps: [
    {
      name: 'cloud-video-api',
      script: 'server.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      watch: false,
      max_memory_restart: '1G',
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
    },
  ],
};