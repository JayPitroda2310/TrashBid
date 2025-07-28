const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
// Enable CORS for all routes with specific options
app.use(cors({
  origin: '*', // Allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.static(__dirname));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure uploads directory exists
if (!fs.existsSync('./uploads')) {
  fs.mkdirSync('./uploads');
}

// MongoDB connection string - will be overridden by environment variable
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/trashbid';

// Log connection attempt (with masked password)
console.log('Attempting to connect to MongoDB...');
console.log('Connection string (masked):', 
  MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//\\1:****@'));

// Connect to MongoDB without deprecated options
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    // Continue running the app even if MongoDB fails
    console.log('⚠️ Running without database functionality');
  });

// Expanded product schema with all required fields
const productSchema = new mongoose.Schema({
  name: String,
  description: String,
  quantity: Number,
  startingPrice: Number,
  imageUrl: String,
  biddingEndsAt: Date,
  createdAt: { type: Date, default: Date.now },
  bids: [{
    bidderName: String,
    amount: Number,
    timestamp: { type: Date, default: Date.now }
  }]
});

const Product = mongoose.model('Product', productSchema);

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Simple routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// API routes
app.get('/api/status', (req, res) => {
  res.json({
    server: 'online',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date()
  });
});

// Get all products
app.get('/api/products', async (req, res) => {
  try {
    console.log('Fetching all products...');
    
    if (mongoose.connection.readyState !== 1) {
      console.log('Database not connected, readyState:', mongoose.connection.readyState);
      return res.status(503).json({ 
        success: false, 
        message: 'Database not connected',
        readyState: mongoose.connection.readyState
      });
    }
    
    const products = await Product.find();
    console.log(`Found ${products.length} products`);
    
    // Set CORS headers explicitly for this response
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    
    res.json({ success: true, products });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create a product with image upload
app.post('/api/products', upload.single('image'), async (req, res) => {
  try {
    console.log('Product creation attempt...');
    console.log('Request body:', req.body);
    console.log('File:', req.file ? `File uploaded: ${req.file.filename}` : 'No file uploaded');
    
    if (mongoose.connection.readyState !== 1) {
      console.log('Database not connected, readyState:', mongoose.connection.readyState);
      return res.status(503).json({ 
        success: false, 
        message: 'Database not connected'
      });
    }
    
    const { name, description, quantity, startingPrice, biddingEndsAt } = req.body;
    
    // Validate required fields
    if (!name) {
      console.log('Missing required field: name');
      return res.status(400).json({ success: false, message: 'Name is required' });
    }
    
    // Check if file was uploaded
    let imageUrl = '';
    if (req.file) {
      // Generate URL for the uploaded file
      const fileName = req.file.filename;
      const baseUrl = process.env.NODE_ENV === 'production' 
        ? `https://${req.get('host')}`
        : `http://localhost:${process.env.PORT || 5000}`;
      imageUrl = `${baseUrl}/uploads/${fileName}`;
      console.log('Generated image URL:', imageUrl);
    } else {
      console.log('No image file in request');
    }
    
    console.log('Creating product with data:', {
      name,
      description,
      quantity: parseInt(quantity) || 0,
      startingPrice: parseFloat(startingPrice) || 0,
      biddingEndsAt,
      imageUrl
    });
    
    const product = new Product({
      name,
      description,
      quantity: parseInt(quantity) || 0,
      startingPrice: parseFloat(startingPrice) || 0,
      biddingEndsAt,
      imageUrl,
      bids: []
    });
    
    console.log('Saving product to database...');
    const savedProduct = await product.save();
    console.log('Product saved successfully:', savedProduct);
    
    // Set CORS headers explicitly for this response
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'POST');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    
    res.status(201).json({ success: true, product: savedProduct });
  } catch (error) {
    console.error('❌ Error creating product:', error);
    // Send detailed error information
    res.status(500).json({ 
      success: false, 
      message: 'Server error while creating product', 
      error: error.message,
      stack: process.env.NODE_ENV === 'production' ? null : error.stack
    });
  }
});

// Place a bid on a product
app.post('/api/products/:id/bid', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ 
        success: false, 
        message: 'Database not connected'
      });
    }
    
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const { bidderName, amount } = req.body;
    const now = new Date();

    if (now > new Date(product.biddingEndsAt)) {
      return res.status(400).json({ success: false, message: 'Bidding period has ended' });
    }

    const highestBid = product.bids.reduce(
      (max, bid) => bid.amount > max ? bid.amount : max, 
      product.startingPrice
    );
    
    if (amount <= highestBid) {
      return res.status(400).json({ 
        success: false, 
        message: `Bid must be higher than ₹${highestBid}` 
      });
    }

    product.bids.push({ bidderName, amount: parseFloat(amount) });
    await product.save();

    res.json({ success: true, message: 'Bid placed successfully', product });
  } catch (error) {
    console.error('Error placing bid:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get platform statistics
app.get('/api/stats', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ 
        success: false, 
        message: 'Database not connected'
      });
    }
    
    const products = await Product.find();
    const listings = products.length;

    const totalBids = products.reduce((sum, product) => {
      const maxBid = product.bids.reduce(
        (max, bid) => bid.amount > max ? bid.amount : max, 
        product.startingPrice
      );
      return sum + maxBid;
    }, 0);

    const wasteRecycled = products.reduce(
      (sum, product) => sum + product.quantity, 
      0
    );

    const greenContribution = (wasteRecycled * 0.85).toFixed(2);

    // Set CORS headers explicitly for this response
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    
    res.json({
      success: true,
      stats: {
        listings,
        totalBids,
        wasteRecycled,
        greenContribution
      }
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete a product
app.delete('/api/products/:id', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ 
        success: false, 
        message: 'Database not connected'
      });
    }
    
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Detailed MongoDB status
app.get('/api/mongodb-status', (req, res) => {
  const readyStateMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
    99: 'uninitialized'
  };
  
  res.json({
    readyState: mongoose.connection.readyState,
    status: readyStateMap[mongoose.connection.readyState] || 'unknown',
    host: mongoose.connection.host || 'none',
    name: mongoose.connection.name || 'none',
    models: Object.keys(mongoose.models),
    timestamp: new Date()
  });
});

// Test file upload endpoint
app.post('/api/test-upload', upload.single('testImage'), (req, res) => {
  try {
    console.log('Test upload attempt');
    console.log('Headers:', req.headers);
    
    if (!req.file) {
      console.log('No file received in test upload');
      return res.status(400).json({ 
        success: false, 
        message: 'No file uploaded',
        body: req.body
      });
    }
    
    console.log('Test file uploaded:', req.file);
    
    const fileName = req.file.filename;
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? `https://${req.get('host')}`
      : `http://localhost:${process.env.PORT || 5000}`;
    const imageUrl = `${baseUrl}/uploads/${fileName}`;
    
    res.json({
      success: true,
      message: 'Test file uploaded successfully',
      file: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        path: req.file.path,
        url: imageUrl
      }
    });
  } catch (error) {
    console.error('Error in test upload:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error in test upload',
      error: error.message
    });
  }
});

// Check uploads directory
app.get('/api/check-uploads', (req, res) => {
  try {
    // Check if uploads directory exists
    const uploadsExists = fs.existsSync('./uploads');
    
    let files = [];
    if (uploadsExists) {
      // Get list of files in uploads directory
      files = fs.readdirSync('./uploads').map(file => {
        const stats = fs.statSync(`./uploads/${file}`);
        return {
          name: file,
          size: stats.size,
          created: stats.birthtime,
          isDirectory: stats.isDirectory()
        };
      });
    }
    
    res.json({
      success: true,
      uploadsDirectoryExists: uploadsExists,
      files: files,
      currentDirectory: __dirname,
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    console.error('Error checking uploads directory:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error checking uploads directory',
      error: error.message
    });
  }
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
