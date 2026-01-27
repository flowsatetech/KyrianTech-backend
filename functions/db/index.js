const { MongoClient } = require('mongodb');

let db;
let users;

async function initializeDB() {
    const client = new MongoClient(process.env.MONGO_URI);
    await client.connect();
    db = client.db("kyriandb");
    users = db.collection("users");

    // Create indexes
    await users.createIndex({ email: 1 }, { unique: true });

    console.log("MongoDB initialized successfully");
}


// ============================================
// USER AUTHENTICATION FUNCTIONS
// ============================================

async function addUser(userData) {
    try {
        const result = await users.insertOne(userData);
        return { ...userData, _id: result.insertedId };
    } catch (err) {
        console.error("Error adding user:", err);
        throw err;
    }
}

async function getUserByEmail(email) {
    try {
        const doc = await users.findOne({ email });
        return doc;
    } catch (err) {
        console.error("Error retrieving user by email:", err);
        throw err;
    }
}

async function getUserById(userId) {
    try {
        const doc = await users.findOne({ userId });
        return doc;
    } catch (err) {
        console.error("Error retrieving user by ID:", err);
        throw err;
    }
}

async function updateUser(userId, updateData) {
    try {
        const result = await users.updateOne(
            { userId },
            { $set: updateData }
        );
        return { changes: result.modifiedCount };
    } catch (err) {
        console.error("Error updating last login:", err);
        throw err;
    }
}

module.exports = {
    initializeDB,
    addUser,
    getUserByEmail,
    getUserById,
    updateUser
};