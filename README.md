# Cloud Video Platform

A production-ready, cloud-based video streaming platform built with React, Node.js, MongoDB Atlas, and AWS cloud services. This project demonstrates practical implementation of cloud computing concepts using AWS infrastructure.

## Architecture Overview

```
User → React Frontend (Vite) → Express REST API → MongoDB Atlas
                                    ↓
                              Amazon S3 (Storage)
                                    ↓
                          Amazon CloudFront (CDN)
```

## AWS Services Used

### 1. Amazon EC2
- **Purpose**: Hosts the Express.js backend API server
- **Configuration**: t2.medium or larger, Amazon Linux 2
- **Features**: Auto-scaling groups, Elastic IP, Security Groups
- **Why**: Provides scalable compute capacity for the API server

### 2. Amazon S3 (Simple Storage Service)
- **Purpose**: Stores video files and thumbnails
- **Configuration**: Private bucket with server-side encryption
- **Features**: 99.999999999% durability, lifecycle policies
- **Why**: Highly durable, scalable object storage for media files

### 3. Amazon CloudFront (CDN)
- **Purpose**: Global content delivery for video streaming
- **Configuration**: Origin pointing to S3 bucket
- **Features**: Edge caching, DDoS protection, HTTPS termination
- **Why**: Low-latency video delivery worldwide

### 4. AWS IAM (Identity and Access Management)
- **Purpose**: Secure access management for AWS resources
- **Configuration**: Least-privilege policies
- **Features**: Fine-grained permissions, access keys
- **Why**: Ensures secure service-to-service communication

### 5. Amazon CloudWatch
- **Purpose**: Monitoring and logging
- **Configuration**: Application logs, metrics, alarms
- **Features**: Real-time monitoring, log aggregation
- **Why**: Operational visibility and troubleshooting

## Tech Stack

### Frontend
- **React.js** (Vite) - UI framework
- **Tailwind CSS** - Utility-first CSS framework
- **React Router** - Client-side routing
- **Axios** - HTTP client

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB Atlas** - NoSQL database
- **JWT + bcrypt** - Authentication
- **Multer** - File upload handling
- **AWS SDK** - AWS service integration

## Project Structure

```
cloud-video-platform/
├── backend/
│   ├── config/
│   │   ├── db.js              # MongoDB connection
│   │   └── aws.js             # AWS S3 & CloudFront config
│   ├── controllers/
│   │   ├── authController.js   # Authentication logic
│   │   ├── videoController.js  # Video CRUD & S3 upload
│   │   ├── commentController.js# Comments management
│   │   └── adminController.js  # Admin operations
│   ├── middleware/
│   │   ├── auth.js            # JWT verification
│   │   ├── errorHandler.js    # Global error handler
│   │   └── upload.js          # Multer configuration
│   ├── models/
│   │   ├── User.js            # User schema
│   │   ├── Video.js           # Video schema
│   │   └── Comment.js         # Comment schema
│   ├── routes/
│   │   ├── auth.js            # Auth endpoints
│   │   ├── videos.js          # Video endpoints
│   │   ├── comments.js        # Comment endpoints
│   │   └── admin.js           # Admin endpoints
│   ├── validators/
│   │   ├── authValidator.js   # Auth validation rules
│   │   └── videoValidator.js  # Video validation rules
│   ├── utils/
│   │   └── errorResponse.js   # Custom error class
│   ├── server.js              # Entry point
│   ├── package.json
│   └── .env                   # Environment variables
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── axios.js       # Axios configuration
│   │   ├── components/
│   │   │   ├── Navbar.jsx     # Navigation bar
│   │   │   └── VideoCard.jsx  # Video card component
│   │   ├── context/
│   │   │   └── AuthContext.jsx # Authentication context
│   │   ├── pages/
│   │   │   ├── HomePage.jsx       # Video browsing
│   │   │   ├── LoginPage.jsx      # User login
│   │   │   ├── RegisterPage.jsx   # User registration
│   │   │   ├── WatchPage.jsx      # Video player
│   │   │   ├── SearchPage.jsx     # Video search
│   │   │   ├── ProfilePage.jsx    # User profile
│   │   │   ├── WatchHistoryPage.jsx # Watch history
│   │   │   ├── AdminDashboard.jsx # Admin panel
│   │   │   └── AdminUploadPage.jsx # Video upload
│   │   ├── App.jsx            # Main app with routing
│   │   ├── main.jsx           # Entry point
│   │   └── index.css          # Tailwind styles
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
├── deploy.sh                  # EC2 deployment script
└── README.md
```

## Role System

| Role | Default | Permissions |
|------|---------|-------------|
| **Viewer** | ✅ (new users) | Browse, search, watch videos, view comments |
| **Creator** | Upgrade from Viewer | All viewer permissions + upload, edit, delete own videos, Creator Studio |
| **Admin** | Manual assignment | All permissions + user management, system settings |

### Upgrade Flow
```
Register → Viewer → Become a Creator (Profile page) → Creator
```

## Features

### Guest Features (No Login Required)
- ✅ Browse home page with video grid
- ✅ Search videos by title, description, tags
- ✅ Watch videos with HTML5 player (served via CloudFront CDN)
- ✅ View video details (title, description, views, tags)
- ✅ Read comments
- ✅ View related videos

### Viewer Features (Logged In - Default)
- ✅ All guest features
- ✅ Like/unlike videos
- ✅ Comment on videos
- ✅ Watch history tracking
- ✅ Profile management
- ✅ Password change

### Creator Features
- ✅ All viewer features
- ✅ Upload videos via S3 Presigned URLs
- ✅ Edit video metadata
- ✅ Delete own videos (removes from S3 + CloudFront)
- ✅ Creator Studio dashboard (`/admin/studio`)
- ✅ My Videos management with stats

### Admin Features
- ✅ All creator features
- ✅ Manage all users (role assignment, deletion)
- ✅ Manage all videos
- ✅ Dashboard with analytics
- ✅ System-wide settings

## API Endpoints

### Authentication
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/api/auth/register` | Register user | Public |
| POST | `/api/auth/login` | Login user | Public |
| POST | `/api/auth/logout` | Logout user | Private |
| GET | `/api/auth/me` | Get current user | Private |
| PUT | `/api/auth/updatedetails` | Update profile | Private |
| PUT | `/api/auth/updatepassword` | Change password | Private |

### Videos
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/videos` | List videos | Public |
| GET | `/api/videos/:id` | Get video | Public |
| POST | `/api/videos` | Upload video | Admin, Creator |
| PUT | `/api/videos/:id` | Update video | Admin, Creator |
| DELETE | `/api/videos/:id` | Delete video | Admin, Creator |
| POST | `/api/videos/:id/like` | Toggle like | Private |
| POST | `/api/videos/:id/watch` | Track watch | Private |

### Comments
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/videos/:videoId/comments` | Get comments | Public |
| POST | `/api/videos/:videoId/comments` | Add comment | Private |
| PUT | `/api/comments/:id` | Update comment | Private |
| DELETE | `/api/comments/:id` | Delete comment | Private |

### Admin
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/admin/stats` | Dashboard stats | Admin |
| GET | `/api/admin/users` | List users | Admin |
| GET | `/api/admin/users/:id` | Get user | Admin |
| PUT | `/api/admin/users/:id/role` | Update role | Admin |
| DELETE | `/api/admin/users/:id` | Delete user | Admin |

## Setup Instructions

### Prerequisites
- Node.js 18+
- MongoDB Atlas account
- AWS account with S3 and CloudFront access
- npm or yarn

### 1. Clone and Install

```bash
git clone <repository-url>
cd cloud-video-platform

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Configure Environment Variables

Edit `backend/.env`:

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/cloud-video-platform
JWT_SECRET=your-super-secret-key-change-this
JWT_EXPIRE=7d
JWT_COOKIE_EXPIRE=7
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET_NAME=your-video-bucket
CLOUDFRONT_DOMAIN=your-cloudfront-domain.cloudfront.net
CLIENT_URL=http://localhost:5173
```

### 3. AWS Setup

#### S3 Bucket
```bash
aws s3 mb s3://your-video-bucket --region us-east-1
aws s3api put-public-access-block --bucket your-video-bucket --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
```

#### CloudFront Distribution
1. Create CloudFront distribution with S3 origin
2. Enable HTTPS, restrict bucket access via Origin Access Control (OAC)
3. Note the CloudFront domain name

#### IAM User
Create IAM user with:
- `AmazonS3FullAccess`
- `CloudFrontFullAccess`
- Programmatic access keys

### 4. Run Locally

```bash
# Terminal 1: Start backend
cd backend
npm run dev

# Terminal 2: Start frontend
cd frontend
npm run dev
```

Access:
- Frontend: http://localhost:5173
- Backend API: http://localhost:5000
- Health Check: http://localhost:5000/api/health

### 5. Create Admin User

```bash
# Register via API
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","email":"admin@example.com","password":"password123"}'

# Update role to admin via MongoDB shell or create a seed script
```

## EC2 Deployment

### 1. Launch EC2 Instance
- AMI: Amazon Linux 2
- Instance type: t2.medium (minimum)
- Security Group: Allow ports 22 (SSH), 5000 (API), 5173 (Frontend)

### 2. Install Dependencies on EC2
```bash
sudo yum update -y
curl -sL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs git
sudo npm install -g pm2
```

### 3. Deploy Application
```bash
git clone <your-repo-url> /home/ec2-user/cloud-video-platform
cd /home/ec2-user/cloud-video-platform
chmod +x deploy.sh
./deploy.sh
```

### 4. Configure Nginx (Optional - for production)
```bash
sudo yum install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

## Security Best Practices

1. **JWT Tokens**: Stored in httpOnly cookies to prevent XSS
2. **Password Hashing**: bcrypt with 12 salt rounds
3. **S3 Security**: Private buckets with presigned URLs
4. **Input Validation**: Server-side validation with express-validator
5. **CORS**: Restricted to specific origins
6. **Rate Limiting**: Implement via express-rate-limit (optional)
7. **HTTPS**: Enforced via CloudFront in production
8. **Environment Variables**: All secrets stored in .env

## Monitoring with CloudWatch

The application logs are structured for CloudWatch integration:

```javascript
// Log format for CloudWatch
console.log(JSON.stringify({
  level: 'info',
  timestamp: new Date().toISOString(),
  service: 'cloud-video-api',
  message: 'Request processed',
  method: req.method,
  path: req.originalUrl,
  statusCode: res.statusCode,
  duration: `${duration}ms`
}));
```

## License

MIT