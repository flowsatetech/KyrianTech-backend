const { MongoClient } = require('mongodb');
const { logger } = require('../helpers');

let db;
let users;
let carts;

async function initializeDB() {
    const client = new MongoClient(process.env.MONGO_URI);
    await client.connect();
    db = client.db("kyriandb");
    users = db.collection("users");
    carts = db.collection("carts");

    // Create indexes
    await users.createIndex({ email: 1 }, { unique: true });
    await users.createIndex({ userId: 1 }, { unique: true });

    logger("DB").info("MongoDB initialized successfully");
}

// ============================================
// USER FETCH FUNCTIONS
// ============================================

async function addUser(userData) {
    try {
        const result = await users.insertOne(userData);
        await carts.insertOne({
            userId: userData.userId,
            products: []
        });
        return { ...userData, _id: result.insertedId };
    } catch (err) {
        logger("DB").error(err);
        throw err;
    }
}

async function getUserByEmail(email) {
    try {
        const doc = await users.findOne({ email });
        return doc;
    } catch (err) {
        logger("DB").error(err);
        throw err;
    }
}

async function getUserById(userId) {
    try {
        const doc = await users.findOne({ userId });
        return doc;
    } catch (err) {
        logger("DB").error(err);
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
        logger("DB").error(err);
        throw err;
    }
}

async function getCart(userId) {
    try {
        const doc = await carts.findOne({ userId });
        return doc;
    } catch (err) {
        logger("DB").error(err);
        throw err;
    }
}

async function getCartData(userId) {
    try {
        const [cart] = await carts.aggregate([
            { $match: { userId } },
            {
                $lookup: {
                    from: "products",
                    localField: "products.productId",
                    foreignField: "productId",
                    as: "fullProducts"
                }
            },
            {
                $project: {
                    _id: 0,
                    products: {
                        $map: {
                            input: "$fullProducts",
                            as: "p",
                            in: {
                                productId: "$$p.productId",
                                name: "$$p.name",
                                slug: "$$p.slug",
                                price: "$$p.price",
                                count: {
                                    $let: {
                                        vars: {
                                            match: {
                                                $first: {
                                                    $filter: {
                                                        input: "$products",
                                                        as: "cp",
                                                        cond: { $eq: ["$$cp.productId", "$$p.productId"] }
                                                    }
                                                }
                                            }
                                        },
                                        in: "$$match.count"
                                    }
                                }
                            }
                        }
                    }
                }
            }
        ]).toArray();

        return cart || { products: [] };
    } catch (err) {
        logger("DB").error(err);
        throw err;
    }
}

module.exports = {
    initializeDB,

    addUser,
    getUserByEmail,
    getUserById,
    updateUser,

    getCart,
    getCartData
};