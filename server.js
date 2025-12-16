const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { google } = require('googleapis');
const admin = require('firebase-admin');
const { Readable } = require('stream');
require('dotenv').config();

// Initialize Firebase Admin from service account key
let serviceAccount;
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  } else {
    // Fallback to individual variables for development
    serviceAccount = {
      type: "service_account",
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
    };
  }
} catch (error) {
  console.error('Error parsing FIREBASE_SERVICE_ACCOUNT_KEY:', error);
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id
});

const db = admin.firestore();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'https://nhixinhne.vercel.app', 'https://nhixinhne-a39e2.web.app'],
  credentials: true
}));

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Google Drive authentication using OAuth
async function getDriveClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'urn:ietf:wg:oauth:2.0:oob' // For desktop apps
  );

  // Set refresh token
  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN
  });

  // Refresh access token
  await oauth2Client.refreshAccessToken();

  const drive = google.drive({ version: 'v3', auth: oauth2Client });
  return drive;
}

// Upload image to Google Drive
async function uploadToGoogleDrive(fileBuffer, fileName, mimeType) {
  console.log('🔄 Starting Google Drive upload...');
  console.log('📁 File details:', { fileName, mimeType, bufferSize: fileBuffer.length });

  try {
    console.log('🔗 Getting Google Drive client...');
    const drive = await getDriveClient();
    console.log('✅ Google Drive client obtained');

    // Create file metadata
    const fileMetadata = {
      name: fileName,
      parents: [process.env.GOOGLE_DRIVE_FOLDER_ID || 'root'], // Optional: specify folder
    };
    console.log('📄 File metadata:', fileMetadata);

    // Create media for upload - convert buffer to readable stream
    const media = {
      mimeType: mimeType,
      body: Readable.from(fileBuffer),
    };

    console.log('⬆️ Uploading file to Google Drive...');
    // Upload file
    const response = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id',
    });

    const fileId = response.data.id;
    console.log('✅ File uploaded successfully, File ID:', fileId);

    console.log('🔓 Setting public permissions...');
    // Make file publicly accessible
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });
    console.log('✅ Public permissions set');

    // Get Google Drive hosting URL (more reliable for images)
    const hostingUrl = `https://lh3.googleusercontent.com/d/${fileId}?authuser=0`;
    console.log('🎉 Upload complete! Hosting URL:', hostingUrl);

    return {
      fileId,
      publicUrl: hostingUrl, // Use Google Drive hosting URL
      success: true
    };

  } catch (error) {
    console.error('❌ Error uploading to Google Drive:', error);
    console.error('❌ Error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      status: error.status
    });
    throw error;
  }
}

// Add JSON parsing middleware after multer routes to avoid conflicts
app.use(express.json());

// Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Get site data (profile + background)
app.get('/api/site-data', async (req, res) => {
  try {
    // Get profile data
    const profileDoc = await db.collection('config').doc('profile').get();
    const backgroundDoc = await db.collection('config').doc('background').get();

    const profile = profileDoc.exists ? profileDoc.data() : {
      name: "Mẹ Bỉm Sữa Review",
      bio: "Chia sẻ kinh nghiệm nuôi dạy con & săn deal hot cho bé yêu 🍼 Follow để nhận voucher mỗi ngày nhé!",
      avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuD4-4nseipxqo0kUCZE9uFM44MdTSYdXZK7Ip6KdlyymxoMUAFfS7Ve06-Q9hHGxjPluC6X1APdZdN4rucbf81eaxjkm_YhmgvFAXw4pcASA-ix8llEXZC5nUN6SacEV2XF_k-dtb9Yva94yHVEtkau6hvENT-rlCm-EdLda-wSIKp47tOJkZDAYu-1VrHNM-2ra5qRFgsaqhl86noxOuc2f75yKQwk7z-_QUC1XkJ0rEhR3XHAN6BLxLkkhAlcI2nDPjqbfeDSZ3h2"
    };

    const background = backgroundDoc.exists ? backgroundDoc.data() : {
      imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuC8aAcLjxpyVZyPCmL72kiLClze8F-26nZRzXjNA-qmY4h-RzSJhNeTrZLXfhEr5bEkoErKSv2uzqv6I_Z1c0WGToWBBo8lmLUNeAu_LDe-B6S3W7w34pYYpdPQrqxAz8xq3TpZqdZYGIbp69Ua_oGY5QBQh5-87_vbnvnV7ZBjOqxAz-WTUZIAhSwh7ZlLA7pHlcbVbQ-UyX1jMuk4iQ_-RC6DX9nJz-Q_qINfaQcsZmJBDXDCP-yJdKV9S66Jyooe_Tw2Che6pEPO"
    };

    res.json({
      profile: profile,
      backgroundImage: background.imageUrl
    });
  } catch (error) {
    console.error('Error getting site data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get categories data
app.get('/api/categories', async (req, res) => {
  try {
    const categoriesSnapshot = await db.collection('categories').get();
    const categories = [];

    categoriesSnapshot.forEach(doc => {
      categories.push({
        id: doc.id,
        ...doc.data()
      });
    });

    // Sort by created date or custom order if available
    categories.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

    res.json({ categories });
  } catch (error) {
    console.error('Error getting categories:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Save site data (config + categories)
app.post('/api/site-data', async (req, res) => {
  console.log('🚀 [POST /api/site-data] ===== ENDPOINT CALLED =====');
  try {
    console.log('📥 [POST /api/site-data] Request received');
    console.log('📋 Request headers:', {
      'content-type': req.headers['content-type'],
      'content-length': req.headers['content-length'],
      'user-agent': req.headers['user-agent']
    });
    console.log('📋 Request body keys:', Object.keys(req.body || {}));
    console.log('� Raw request body size:', JSON.stringify(req.body || {}).length, 'characters');

    const { profile, backgroundImage, categories } = req.body;
    const timestamp = new Date().toISOString();

    console.log('💾 [POST /api/site-data] Saving site data...');
    console.log('�📊 Data to save:', {
      hasProfile: !!profile,
      hasBackground: !!backgroundImage,
      categoriesCount: categories?.length || 0
    });

    // Save profile config
    if (profile) {
      console.log('📝 Saving profile config...');
      await db.collection('config').doc('profile').set({
        ...profile,
        updatedAt: timestamp
      });
    }

    // Save background config
    if (backgroundImage) {
      console.log('🖼️ Saving background config...');
      await db.collection('config').doc('background').set({
        imageUrl: backgroundImage,
        updatedAt: timestamp
      });
    }

    // Save categories
    if (categories && Array.isArray(categories)) {
      console.log(`📂 Saving ${categories.length} categories...`);

      // Delete existing categories first
      const existingCategories = await db.collection('categories').get();
      const deletePromises = existingCategories.docs.map(doc => doc.ref.delete());
      await Promise.all(deletePromises);

      // Save new categories
      const categoryPromises = categories.map(async (category, index) => {
        const categoryData = {
          ...category,
          createdAt: timestamp,
          order: index
        };
        return db.collection('categories').doc(category.id).set(categoryData);
      });

      await Promise.all(categoryPromises);
      console.log('✅ All categories saved');
    }

    console.log('🎉 Site data saved successfully');
    res.json({
      success: true,
      message: 'Site data saved successfully',
      timestamp: timestamp
    });

  } catch (error) {
    console.error('❌ Error saving site data:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Upload avatar
app.post('/api/upload/avatar', upload.single('avatar'), async (req, res) => {
  console.log('📥 Avatar upload request received');
  console.log('📋 Request headers:', req.headers);
  console.log('📋 Request body:', req.body);

  try {
    if (!req.file) {
      console.log('❌ No file in request');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = req.file;
    const fileName = `avatar-${Date.now()}.${file.mimetype.split('/')[1]}`;

    console.log('📁 Avatar file details:', {
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      generatedName: fileName
    });

    const uploadResult = await uploadToGoogleDrive(
      file.buffer,
      fileName,
      file.mimetype
    );

    console.log('✅ Avatar upload completed successfully');
    res.json({
      success: true,
      fileId: uploadResult.fileId,
      publicUrl: uploadResult.publicUrl,
      message: 'Avatar uploaded successfully'
    });

  } catch (error) {
    console.error('❌ Error in avatar upload endpoint:', error);
    res.status(500).json({ error: 'Failed to upload avatar', details: error.message });
  }
});

// Upload background image
app.post('/api/upload/background', upload.single('background'), async (req, res) => {
  console.log('📥 Background upload request received');
  console.log('📋 Request headers:', req.headers);
  console.log('📋 Request body:', req.body);

  try {
    if (!req.file) {
      console.log('❌ No file in request');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = req.file;
    const fileName = `background-${Date.now()}.${file.mimetype.split('/')[1]}`;

    console.log('📁 Background file details:', {
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      generatedName: fileName
    });

    const uploadResult = await uploadToGoogleDrive(
      file.buffer,
      fileName,
      file.mimetype
    );

    console.log('✅ Background upload completed successfully');
    res.json({
      success: true,
      fileId: uploadResult.fileId,
      publicUrl: uploadResult.publicUrl,
      message: 'Background uploaded successfully'
    });

  } catch (error) {
    console.error('❌ Error in background upload endpoint:', error);
    res.status(500).json({ error: 'Failed to upload background', details: error.message });
  }
});

// Upload product image
app.post('/api/upload/product-image', upload.single('productImage'), async (req, res) => {
  console.log('📥 Product image upload request received');
  console.log('📋 Request headers:', req.headers);
  console.log('📋 Request body:', req.body);

  try {
    if (!req.file) {
      console.log('❌ No file in request');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = req.file;
    const fileName = `product-${Date.now()}.${file.mimetype.split('/')[1]}`;

    console.log('📁 Product image file details:', {
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      generatedName: fileName
    });

    const uploadResult = await uploadToGoogleDrive(
      file.buffer,
      fileName,
      file.mimetype
    );

    console.log('✅ Product image upload completed successfully');
    res.json({
      success: true,
      fileId: uploadResult.fileId,
      publicUrl: uploadResult.publicUrl,
      message: 'Product image uploaded successfully'
    });

  } catch (error) {
    console.error('❌ Error in product image upload endpoint:', error);
    res.status(500).json({ error: 'Failed to upload product image', details: error.message });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
    }
  }

  if (error.message === 'Only image files are allowed!') {
    return res.status(400).json({ error: 'Only image files are allowed!' });
  }

  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
