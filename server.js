const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

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

// Simple product schema
const productSchema = new mongoose.Schema({
  name: String,
  description: String,
  createdAt: { type: Date, default: Date.now }
});

const Product = mongoose.model('Product', productSchema);

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
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ 
        success: false, 
        message: 'Database not connected',
        readyState: mongoose.connection.readyState
      });
    }
    
    const products = await Product.find();
    res.json({ success: true, products });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create a product
app.post('/api/products', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ 
        success: false, 
        message: 'Database not connected'
      });
    }
    
    const { name, description } = req.body;
    const product = new Product({ name, description });
    await product.save();
    res.status(201).json({ success: true, product });
  } catch (error) {
    console.error('Error creating product:', error);
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

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
