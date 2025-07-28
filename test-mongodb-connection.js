// Simple MongoDB connection test
const mongoose = require('mongoose');

// Connection string - this will be overridden by environment variable if set
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/trashbid';

console.log('Attempting to connect to MongoDB...');
console.log('Connection string (masked):', MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//\\1:****@'));

// Connect with simple options
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ SUCCESS: Connected to MongoDB!');
    
    // Create a simple schema and model for testing
    const TestSchema = new mongoose.Schema({
      name: String,
      createdAt: { type: Date, default: Date.now }
    });
    
    const Test = mongoose.model('Test', TestSchema);
    
    // Create a test document
    return Test.create({ name: 'Test document' })
      .then(doc => {
        console.log('✅ Document created:', doc);
        return mongoose.connection.close();
      })
      .then(() => {
        console.log('Connection closed.');
        process.exit(0);
      });
  })
  .catch(err => {
    console.error('❌ ERROR: Failed to connect to MongoDB:', err);
    
    // Additional error information
    if (err.name === 'MongoServerSelectionError') {
      console.error('\nThis is typically caused by:');
      console.error('1. Wrong connection string format');
      console.error('2. Wrong username/password');
      console.error('3. IP not whitelisted in MongoDB Atlas');
      console.error('4. MongoDB Atlas cluster is not running');
      
      if (err.message.includes('authentication failed')) {
        console.error('\n⚠️ AUTHENTICATION ERROR: Your username or password is incorrect');
      }
      
      if (err.message.includes('getaddrinfo ENOTFOUND')) {
        console.error('\n⚠️ HOST ERROR: Cannot resolve the hostname in your connection string');
        console.error('Check that your cluster address is correct');
      }
    }
    
    process.exit(1);
  }); 