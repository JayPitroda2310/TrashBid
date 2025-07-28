const { MongoClient } = require('mongodb');

// Replace this with your connection string from MongoDB Atlas
const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/trashbid";

console.log("Attempting to connect with URI:", uri.replace(/\/\/([^:]+):([^@]+)@/, '//\\1:****@'));

async function testConnection() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log("✅ Connected successfully to MongoDB");
    
    // List databases as a test
    const adminDb = client.db().admin();
    const dbList = await adminDb.listDatabases();
    console.log("Databases:");
    dbList.databases.forEach(db => console.log(` - ${db.name}`));
    
  } catch (err) {
    console.error("❌ Connection error:", err);
  } finally {
    await client.close();
    console.log("Connection closed");
  }
}

testConnection().catch(console.error); 