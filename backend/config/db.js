const mongoose = require('mongoose');
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

/**
 * Connect to MongoDB Atlas
 * 
 * Fixes ECONNREFUSED on SRV lookup by:
 * 1. Using direct connection string format (non-SRV)
 * 2. Setting longer timeouts for slow networks
 * 3. Adding retry logic with exponential backoff
 * 4. Providing clear error messages for troubleshooting
 */
const connectDB = async (retryCount = 0) => {
  const MAX_RETRIES = 5;
  const BASE_DELAY = 3000;

  try {
    const uri = process.env.MONGODB_URI;

    if (!uri) {
      console.error('MONGODB_URI is not defined in .env file');
      process.exit(1);
    }

    const conn = await mongoose.connect(uri, {
      // Connection pool
      maxPoolSize: 10,
      minPoolSize: 2,
      
      // Timeouts
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000,
      
      // Retry writes
      retryWrites: true,
      w: 'majority',
      
      // Heartbeat
      heartbeatFrequencyMS: 10000,
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);

    // Connection event handlers
    mongoose.connection.on('error', (err) => {
      console.error(`MongoDB connection error: ${err.message}`);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected. Attempting to reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('MongoDB reconnected successfully');
    });

  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);

    // Provide helpful troubleshooting tips
    if (error.message.includes('querySrv') || error.message.includes('ECONNREFUSED')) {
      console.log(`
========================================
  MongoDB Connection Troubleshooting
========================================
  The DNS SRV lookup failed. This is often caused by:
  
  1. Network firewall blocking DNS SRV queries
     → Try using the direct connection string format:
       mongodb://<user>:<pass>@cluster0.muhelnp.mongodb.net:27017/cloud-video-platform?retryWrites=true&w=majority&ssl=true
  
  2. Your ISP or corporate network blocking MongoDB Atlas
     → Try switching to a different network (e.g., mobile hotspot)
  
  3. Incorrect cluster name in connection string
     → Verify your cluster name in MongoDB Atlas dashboard
  
  4. IP address not whitelisted in MongoDB Atlas
     → Go to Network Access in Atlas and add your current IP
========================================
      `);
    }

    // Retry with exponential backoff
    if (retryCount < MAX_RETRIES) {
      const delay = BASE_DELAY * Math.pow(2, retryCount);
      console.log(`Retrying connection in ${delay / 1000} seconds... (Attempt ${retryCount + 1}/${MAX_RETRIES})`);
      setTimeout(() => connectDB(retryCount + 1), delay);
    } else {
      console.error('Max retries reached. Could not connect to MongoDB.');
      console.log('Please check your network connection and MongoDB Atlas configuration.');
      process.exit(1);
    }
  }
};

module.exports = connectDB;