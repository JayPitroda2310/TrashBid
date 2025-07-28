const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure uploads directory exists
if (!fs.existsSync('./uploads')) {
  fs.mkdirSync('./uploads');
}

// MongoDB connection - use environment variable for production
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/trashbid';
console.log("Attempting to connect to MongoDB with URI:", MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//\\1:****@')); // Log masked URI for debugging

// Remove deprecated options
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    
    // Provide more helpful error information
    if (err.code === 'ENOTFOUND' && err.hostname && err.hostname.includes('_mongodb._tcp')) {
      console.error('❌❌❌ IMPORTANT: Your MongoDB connection string appears to be malformed.');
      console.error('The correct format should be: mongodb+srv://username:password@clustername.mongodb.net/trashbid');
      console.error('Please update your MONGODB_URI environment variable in the Render dashboard.');
    }
  });

// Mongoose schema
const productSchema = new mongoose.Schema({
  name: String,
  description: String,
  quantity: Number,
  startingPrice: Number,
  imageUrl: String,
  biddingEndsAt: Date,
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

// 🟢 POST: Create new product
app.post('/api/products', upload.single('image'), async (req, res) => {
  try {
    const { name, description, quantity, startingPrice, biddingEndsAt } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: '🚨 No image uploaded' });
    }
    
    // Generate URL for the uploaded file
    const fileName = req.file.filename;
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? `https://${req.get('host')}`
      : `http://localhost:${process.env.PORT || 5000}`;
    const imageUrl = `${baseUrl}/uploads/${fileName}`;

    const product = new Product({
      name,
      description,
      quantity,
      startingPrice,
      biddingEndsAt,
      imageUrl,
      bids: []
    });

    await product.save();
    res.status(201).json({ success: true, message: '✅ Product listed successfully', product });
  } catch (error) {
    console.error('❌ Error adding product:', error);
    res.status(500).json({ success: false, message: '🚨 Server error' });
  }
});

// 🟡 GET: Fetch all products
app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find();
    res.json({ success: true, products });
  } catch (error) {
    console.error('❌ Error fetching products:', error);
    res.status(500).json({ success: false, message: '🚨 Server error' });
  }
});

// 🔵 POST: Place a bid
app.post('/api/products/:id/bid', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    const { bidderName, amount } = req.body;
    const now = new Date();

    if (now > new Date(product.biddingEndsAt)) {
      return res.status(400).json({ success: false, message: 'Bidding period has ended' });
    }

    const highestBid = product.bids.reduce((max, bid) => bid.amount > max ? bid.amount : max, product.startingPrice);
    if (amount <= highestBid) {
      return res.status(400).json({ success: false, message: `Bid must be higher than ₹${highestBid}` });
    }

    product.bids.push({ bidderName, amount });
    await product.save();

    res.json({ success: true, message: '✅ Bid placed successfully', product });
  } catch (error) {
    console.error('❌ Error placing bid:', error);
    res.status(500).json({ success: false, message: '🚨 Server error' });
  }
});

// 🟣 GET: Stats endpoint
app.get('/api/stats', async (req, res) => {
  try {
    const products = await Product.find();
    const listings = products.length;

    const totalBids = products.reduce((sum, product) => {
      const maxBid = product.bids.reduce((max, bid) => bid.amount > max ? bid.amount : max, product.startingPrice);
      return sum + maxBid;
    }, 0);

    const wasteRecycled = products.reduce((sum, product) => sum + product.quantity, 0);

    const greenContribution = (wasteRecycled * 0.85).toFixed(2); // Example formula

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
    console.error('❌ Error getting stats:', error);
    res.status(500).json({ success: false, message: '🚨 Server error' });
  }
});

// 🔴 DELETE: Remove a product by ID
app.delete('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: '❌ Product not found' });
    }

    res.json({ success: true, message: '🗑️ Product deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting product:', error);
    res.status(500).json({ success: false, message: '🚨 Server error while deleting product' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'UP',
    mongodb: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    timestamp: new Date()
  });
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
