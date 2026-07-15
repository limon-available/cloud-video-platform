const mongoose = require('mongoose');

const VideoSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Video title is required'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters'],
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      required: [true, 'Video description is required'],
      maxlength: [5000, 'Description cannot exceed 5000 characters'],
    },
    thumbnailUrl: {
      type: String,
      default: '',
    },
    videoUrl: {
      type: String,
      default: '',
    },
    s3VideoKey: {
      type: String,
      required: true,
    },
    s3ThumbnailKey: {
      type: String,
      default: '',
    },
    duration: {
      type: Number,
      default: 0,
    },
    views: {
      type: Number,
      default: 0,
    },
    likes: {
      type: Number,
      default: 0,
    },
    category: {
      type: String,
      trim: true,
      default: 'Uncategorized',
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    visibility: {
      type: String,
      enum: ['public', 'private', 'unlisted'],
      default: 'public',
    },
    status: {
      type: String,
      enum: ['processing', 'ready', 'failed'],
      default: 'processing',
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for search functionality
VideoSchema.index({ title: 'text', description: 'text', tags: 'text' });
VideoSchema.index({ category: 1, createdAt: -1 });
VideoSchema.index({ user: 1, createdAt: -1 });

// Increment view count
VideoSchema.methods.incrementViews = async function () {
  this.views += 1;
  return this.save();
};

// Increment like count
VideoSchema.methods.incrementLikes = async function () {
  this.likes += 1;
  return this.save();
};

// Decrement like count
VideoSchema.methods.decrementLikes = async function () {
  if (this.likes > 0) {
    this.likes -= 1;
  }
  return this.save();
};

module.exports = mongoose.model('Video', VideoSchema);