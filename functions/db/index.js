const { MongoClient } = require('mongodb');
const { logger } = require('../helpers');

let client;
let db;
let users;
let carts;
let products;
let productImages;

async function initializeDB() {
    client = new MongoClient(process.env.MONGO_URI);
    await client.connect();
    db = client.db("kyriandb");
    users = db.collection("users");
    carts = db.collection("carts");
    products = db.collection("products");
    productImages = db.collection("productImages");

    /** Create indexes */
    await users.createIndex({ email: 1 }, { unique: true });
    await users.createIndex({ userId: 1 }, { unique: true });
    await products.createIndex({ productId: 1 }, { unique: true });
    await productImages.createIndex({ productId: 1 }, { unique: true });

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
        const operations = [];

        for (const item of items) {
            operations.push({
                updateOne: {
                    filter: { userId, "products.productId": item.productId },
                    update: { $inc: { "products.$.count": item.count } }
                }
            });
            
            operations.push({
                updateOne: {
                    filter: { userId, "products.productId": { $ne: item.productId } },
                    update: { 
                        $push: { 
                            products: { productId: item.productId, count: item.count } 
                        } 
                    }
                }
            });
        }
        
        await carts.bulkWrite(operations, { ordered: true });

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

async function addProducts(productsToAdd) {
    try {
        await products.insertMany(productsToAdd, { ordered: false });
    } catch (err) {
        logger("DB").error(err);
        throw err;
    }
}

async function updateProduct(productId, updateData) {
    try {
        await products.updateOne(
            { productId },
            { $set: updateData }
        );
    } catch (err) {
        logger("DB").error(err);
        throw err;
    }
}

async function deleteProduct(productId) {
    const session = client.startSession();

    try {
        let result;
        await session.withTransaction(async () => {
            result = await products.deleteOne({ productId }, { session });
            await carts.updateMany(
                { "products.productId": productId },
                { $pull: { products: { productId: productId } } },
                { session }
            );
            
            await productImages.deleteOne({ productId }, { session });
        });
        return { success: result.deletedCount > 0 };

    } catch (err) {
        logger("DB").error(err);
        throw err;
    } finally {
        await session.endSession();
    }
}

async function updateProductImages(productId, link) {
    try {
        let flat = link.map(l => l.url);
        await products.updateOne({ productId }, { $set: { images: flat } });
        await productImages.updateOne({ productId }, { $set: { images: link } }, { upsert: true });
    } catch (err) {
        logger("DB").error(err);
        throw err;
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
        const isDefault = !filter || Object.keys(filter).length === 0;
        let items;
        const totalCount = await products.countDocuments(filter || {});

        if (isDefault) {
            items = await products.aggregate([
                { $sample: { size: limit } }
            ]).toArray();
        } else {
            items = await products.find(filter)
                .sort({ _id: -1 })
                .skip(skip)
                .limit(limit)
                .toArray();
        }

        return {
            products: items,
            total: totalCount
        };
    } catch (err) {
        logger("DB").error(err);
        throw err;
    }
}

async function sortProducts(sort, limit) {
    try {
        const topProducts = await products
            .find({})
            .sort(sort)
            .limit(limit)
            .toArray();

        return topProducts;
    } catch (err) {
        console.error("Error fetching top rated products:", err);
        throw err;
    }
}

/** UTILITY */
async function checkProductsExist(productIds) {
    try {
        const uniqueIds = [...new Set(productIds)];
        const existingCount = await products.countDocuments({
            productId: { $in: uniqueIds }
        });
        return existingCount === uniqueIds.length;
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
        updateProduct,
        deleteProduct,
        updateProductImages,
        getCartData,
        addCartItems,
        removeCartItems,
        removeCartItem,
        clearCart,

        addProducts,
        getProduct,
        filterProducts,
        sortProducts,

        checkProductsExist
    };