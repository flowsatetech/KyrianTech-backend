const { MongoClient } = require('mongodb');
const { logger } = require('../helpers');

let db;
let users;
let carts;
let products;

async function initializeDB() {
    const client = new MongoClient(process.env.MONGO_URI);
    await client.connect();
    db = client.db("kyriandb");
    users = db.collection("users");
    carts = db.collection("carts");
    products = db.collection("products");

    /** Create indexes */
    await users.createIndex({ email: 1 }, { unique: true });
    await users.createIndex({ userId: 1 }, { unique: true });
    await products.createIndex({ productId: 1 }, { unique: true });

    logger("DB").info("MongoDB initialized successfully");
}

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

async function addCartItems(userId, items) {
    try {
        for (const item of items) {
            const result = await carts.updateOne(
                {
                    userId: userId,
                    "products.productId": item.productId
                },
                {
                    $inc: { "products.$.count": item.count }
                }
            );

            if (result.matchedCount === 0) {
                await carts.updateOne(
                    { userId: userId },
                    {
                        $push: {
                            products: {
                                productId: item.productId,
                                count: item.count
                            }
                        }
                    }
                );
            }
        }
        return { success: true };
    } catch (err) {
        logger("DB").error(err);
        throw err;
    }
}

async function removeCartItems(userId, items) {
    if (!items.length) return { success: true };

    try {
        const operations = items.map(item => {
            if (item.count > 0) {
                return {
                    updateOne: {
                        filter: { userId, "products.productId": item.productId },
                        update: { $inc: { "products.$.count": item.count } }
                    }
                };
            } else {
                return {
                    updateOne: {
                        filter: { userId, "products.productId": item.productId },
                        update: { $inc: { "products.$.count": item.count } }
                    }
                };
            }
        });
        const result = await carts.bulkWrite(operations);
        const newItems = items.filter(item => item.count > 0);
        await carts.updateOne(
            { userId },
            { $pull: { products: { count: { $lte: 0 } } } }
        );

        return { success: true };
    } catch (err) {
        logger("DB").error(err);
        throw err;
    }
}

async function removeCartItem(userId, productId) {
    try {
        const result = await carts.updateOne(
            { userId: userId },
            {
                $pull: {
                    products: { productId: productId }
                }
            }
        );

        return {
            success: result.modifiedCount > 0,
            userId: userId,
            removedProductId: productId
        };
    } catch (err) {
        logger("DB").error(err);
        throw err;
    }
}

async function clearCart(userId) {
    try {
        await carts.updateOne({ userId: userId }, { $set: { products: [] } });
    } catch (e) {
        logger('DB').error(e);
        throw e;
    }
}

async function getProduct(productId) {
    try {
        const doc = await products.findOne({ productId });
        return doc;
    } catch (err) {
        logger("DB").error(err);
        throw err;
    }
}

async function filterProducts(filter, limit, skip) {
    try {
        const [items, totalCount] = await Promise.all([
            products.find(filter)
                .sort({ _id: -1 })
                .skip(skip)
                .limit(limit)
                .toArray(),
            products.countDocuments(filter)
        ]);

        return {
            products: items,
            total: totalCount
        };
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
    getCartData,
    addCartItems,
    removeCartItems,
    removeCartItem,
    clearCart,

    getProduct,
    filterProducts
};