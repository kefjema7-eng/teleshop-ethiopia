
 // ============================================================
 // TELESHOP ETHIOPIA - SECURE BACKEND
 // ============================================================

const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { MongoClient, ObjectId } = require("mongodb");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

dotenv.config();

// ============================================================
// ENVIRONMENT
// ============================================================

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET;
const PLATFORM_COMMISSION_RATE = Number(process.env.PLATFORM_COMMISSION_RATE ?? 0.05);

if (!MONGODB_URI) {
    console.error("ERROR: MONGODB_URI is missing from .env");
    process.exit(1);
}

if (!JWT_SECRET) {
    console.error("ERROR: JWT_SECRET is missing from .env");
    process.exit(1);
}

if (JWT_SECRET.length < 32) {
    console.error("ERROR: JWT_SECRET must be at least 32 characters.");
    process.exit(1);
}
if (!Number.isFinite(PLATFORM_COMMISSION_RATE) || PLATFORM_COMMISSION_RATE < 0 || PLATFORM_COMMISSION_RATE > 1) {
    console.error("ERROR: PLATFORM_COMMISSION_RATE must be between 0 and 1 (for example 0.05 for 5%).");
    process.exit(1);
}

// ============================================================
// APP
// ============================================================

const app = express();

app.use(helmet());

app.use(
    cors({
        origin: true,
        credentials: true
    })
);

app.use(express.json({ limit: "1mb" }));

// ============================================================
// RATE LIMITERS
// ============================================================

const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many requests. Please try again later."
    }
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many authentication attempts. Please try again later."
    }
});

app.use(generalLimiter);

// ============================================================
// DATABASE
// ============================================================

const client = new MongoClient(MONGODB_URI);

let db;
let users;
let products;
let orders;

async function connectDatabase() {
    await client.connect();

    db = client.db("teleshop");

    users = db.collection("users");
    products = db.collection("products");
    orders = db.collection("orders");

    await users.createIndex(
        { email: 1 },
        { unique: true }
    );

    await orders.createIndex({
        sellerId: 1,
        createdAt: -1
    });

    await orders.createIndex({
        sellerId: 1,
        customerEmail: 1
    });

    await products.createIndex({
        sellerId: 1,
        createdAt: -1
    });

    await products.createIndex({
        sellerId: 1,
        _id: 1
    });

    console.log("MongoDB connected successfully!");
}

// ============================================================
// HELPERS
// ============================================================

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function cleanString(value) {
    if (typeof value !== "string") {
        return "";
    }

    return value.trim();
}

function parsePositiveNumber(value) {
    const number = Number(value);

    if (!Number.isFinite(number) || number < 0) {
        return null;
    }

    return number;
}

function parseNonNegativeInteger(value) {
    const number = Number(value);

    if (!Number.isInteger(number) || number < 0) {
        return null;
    }

    return number;
}

function createSafeUser(user) {
    return {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role || "seller",
        createdAt: user.createdAt
    };
}

// Public product formatter.
// sellerId is deliberately included so storefronts can
// associate a product with its seller.
function createPublicProduct(product) {
    return {
        id: product._id.toString(),
        _id: product._id.toString(),
        sellerId: product.sellerId,
        name: product.name || "Unnamed Product",
        description: product.description || "",
        category: product.category || "Uncategorized",
        price: Number(product.price) || 0,
        stock: Number(product.stock) || 0,
        image: product.image || "",
        createdAt: product.createdAt || null
    };
}

// ============================================================
// JWT
// ============================================================

function createToken(user) {
    return jwt.sign(
        {
            userId: user._id.toString(),
            email: user.email
        },
        JWT_SECRET,
        {
            expiresIn: "7d"
        }
    );
}

// ============================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================

function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({
            success: false,
            message: "Authentication required."
        });
    }

    const parts = authHeader.split(" ");

    if (
        parts.length !== 2 ||
        parts[0] !== "Bearer" ||
        !parts[1]
    ) {
        return res.status(401).json({
            success: false,
            message: "Invalid authorization format."
        });
    }

    try {
        const decoded = jwt.verify(parts[1], JWT_SECRET);

        if (
            !decoded.userId ||
            !ObjectId.isValid(decoded.userId)
        ) {
            return res.status(401).json({
                success: false,
                message: "Invalid authentication."
            });
        }

        req.user = decoded;

        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Your session is invalid or has expired."
        });
    }
}

// Optional authentication for checkout: guests can order, signed-in users get order history.
function optionalAuthenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return next();
    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer" || !parts[1]) {
        return res.status(401).json({ success: false, message: "Invalid authorization format." });
    }
    try {
        const decoded = jwt.verify(parts[1], JWT_SECRET);
        if (!decoded.userId || !ObjectId.isValid(decoded.userId)) {
            return res.status(401).json({ success: false, message: "Invalid authentication." });
        }
        req.user = decoded;
        next();
    } catch {
        return res.status(401).json({ success: false, message: "Your session has expired. Sign in again or check out as a guest." });
    }
}

function requireRole(...allowedRoles) {
    return async (req, res, next) => {
        try {
            const user = await users.findOne(
                { _id: new ObjectId(req.user.userId) },
                { projection: { role: 1, disabled: 1 } }
            );
            if (!user || user.disabled) {
                return res.status(403).json({ success: false, message: "This account is unavailable." });
            }
            if (!allowedRoles.includes(user.role || "seller")) {
                return res.status(403).json({ success: false, message: "You do not have permission to access this feature." });
            }
            req.accountRole = user.role || "seller";
            next();
        } catch (error) {
            console.error("ROLE CHECK ERROR:", error);
            return res.status(500).json({ success: false, message: "Unable to verify account permissions." });
        }
    };
}

// ============================================================
// HEALTH CHECK
// ============================================================

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "TeleShop Ethiopia backend is running.",
        version: "1.1.0"
    });
});

// ============================================================
// AUTH - REGISTER
// ============================================================

app.post(
    "/api/auth/register",
    authLimiter,
    async (req, res) => {
        try {
            let { name, email, password } = req.body;
            const requestedRole = cleanString(req.body.role || "seller").toLowerCase();
            const role = ["customer", "seller"].includes(requestedRole) ? requestedRole : null;

            name = cleanString(name);
            email = cleanString(email).toLowerCase();

            if (!name || !email || !password || !role) {
                return res.status(400).json({
                    success: false,
                    message: "Name, email, password, and a valid customer or seller role are required."
                });
            }

            if (name.length < 2 || name.length > 100) {
                return res.status(400).json({
                    success: false,
                    message: "Name must be between 2 and 100 characters."
                });
            }

            if (!isValidEmail(email)) {
                return res.status(400).json({
                    success: false,
                    message: "Please enter a valid email address."
                });
            }

            if (email.length > 254) {
                return res.status(400).json({
                    success: false,
                    message: "Email address is too long."
                });
            }

            if (typeof password !== "string") {
                return res.status(400).json({
                    success: false,
                    message: "Invalid password."
                });
            }

            if (password.length < 8) {
                return res.status(400).json({
                    success: false,
                    message: "Password must be at least 8 characters."
                });
            }

            if (password.length > 128) {
                return res.status(400).json({
                    success: false,
                    message: "Password is too long."
                });
            }

            const existingUser = await users.findOne({ email });

            if (existingUser) {
                return res.status(409).json({
                    success: false,
                    message: "An account with this email already exists."
                });
            }

            const passwordHash = await bcrypt.hash(password, 12);
            const now = new Date();

            const user = {
                name,
                email,
                passwordHash,
                role,
                createdAt: now,
                updatedAt: now
            };

            const result = await users.insertOne(user);

            user._id = result.insertedId;

            return res.status(201).json({
                success: true,
                message: "Registration successful.",
                user: createSafeUser(user)
            });
        } catch (error) {
            console.error("REGISTER ERROR:", error);

            if (error.code === 11000) {
                return res.status(409).json({
                    success: false,
                    message: "An account with this email already exists."
                });
            }

            return res.status(500).json({
                success: false,
                message: "Unable to create account."
            });
        }
    }
);

// ============================================================
// AUTH - LOGIN
// ============================================================

app.post(
    "/api/auth/login",
    authLimiter,
    async (req, res) => {
        try {
            let { email, password } = req.body;

            email = cleanString(email).toLowerCase();

            if (!email || !password) {
                return res.status(400).json({
                    success: false,
                    message: "Email and password are required."
                });
            }

            const user = await users.findOne({ email });

            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: "Invalid email or password."
                });
            }

            const passwordMatches = await bcrypt.compare(
                password,
                user.passwordHash
            );

            if (!passwordMatches) {
                return res.status(401).json({
                    success: false,
                    message: "Invalid email or password."
                });
            }

            const token = createToken(user);

            return res.json({
                success: true,
                message: "Login successful.",
                token,
                user: createSafeUser(user)
            });
        } catch (error) {
            console.error("LOGIN ERROR:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to complete login."
            });
        }
    }
);

// ============================================================
// AUTH - CURRENT USER
// ============================================================

app.get(
    "/api/auth/me",
    authenticateToken,
    async (req, res) => {
        try {
            const user = await users.findOne({
                _id: new ObjectId(req.user.userId)
            });

            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: "User account no longer exists."
                });
            }

            return res.json({
                success: true,
                user: createSafeUser(user)
            });
        } catch (error) {
            console.error("ME ERROR:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to retrieve account."
            });
        }
    }
);

// ============================================================
// PRODUCTS - CREATE
// ============================================================

app.post(
    "/api/products",
    authenticateToken,
    requireRole("seller"),
    async (req, res) => {
        try {
            const name = cleanString(req.body.name);
            const description = cleanString(req.body.description);
            const category = cleanString(req.body.category);
            const image = cleanString(req.body.image);

            const price = parsePositiveNumber(req.body.price);

            const stock = parseNonNegativeInteger(
                req.body.stock ?? 0
            );

            if (!name) {
                return res.status(400).json({
                    success: false,
                    message: "Product name is required."
                });
            }

            if (name.length > 200) {
                return res.status(400).json({
                    success: false,
                    message: "Product name is too long."
                });
            }

            if (description.length > 5000) {
                return res.status(400).json({
                    success: false,
                    message: "Product description is too long."
                });
            }

            if (category.length > 100 || image.length > 2000) {
                return res.status(400).json({
                    success: false,
                    message: "Category or image field is too long."
                });
            }

            if (price === null) {
                return res.status(400).json({
                    success: false,
                    message: "Price must be a valid non-negative number."
                });
            }

            if (stock === null) {
                return res.status(400).json({
                    success: false,
                    message: "Stock must be a non-negative whole number."
                });
            }

            const now = new Date();

            const product = {
                sellerId: req.user.userId,
                name,
                description,
                price,
                stock,
                category,
                image,
                createdAt: now,
                updatedAt: now
            };

            const result = await products.insertOne(product);

            product._id = result.insertedId;

            return res.status(201).json({
                success: true,
                message: "Product created successfully.",
                product
            });
        } catch (error) {
            console.error("CREATE PRODUCT ERROR:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to create product."
            });
        }
    }
);

// ============================================================
// PRODUCTS - PUBLIC MARKETPLACE
// No login required.
// Keep this route before /api/products/:id.
// ============================================================

app.get("/api/products/public", async (req, res) => {
    try {
        const publicProducts = await products
            .find({ stock: { $gt: 0 }, isPublished: { $ne: false } })
            .sort({ createdAt: -1 })
            .limit(500)
            .toArray();

        return res.status(200).json({
            success: true,
            products: publicProducts.map(createPublicProduct)
        });
    } catch (error) {
        console.error("PUBLIC PRODUCTS ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to load marketplace products."
        });
    }
});

// ============================================================
// PRODUCTS - GET SELLER PRODUCTS
// ============================================================

app.get(
    "/api/products",
    authenticateToken,
    requireRole("seller"),
    async (req, res) => {
        try {
            const productsList = await products
                .find({
                    sellerId: req.user.userId
                })
                .sort({
                    createdAt: -1
                })
                .toArray();

            return res.json({
                success: true,
                products: productsList
            });
        } catch (error) {
            console.error("GET PRODUCTS ERROR:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to retrieve products."
            });
        }
    }
);

// ============================================================
// PRODUCTS - GET ONE
// ============================================================

app.get(
    "/api/products/:id",
    authenticateToken,
    requireRole("seller"),
    async (req, res) => {
        try {
            const { id } = req.params;

            if (!ObjectId.isValid(id)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid product ID."
                });
            }

            const product = await products.findOne({
                _id: new ObjectId(id),
                sellerId: req.user.userId
            });

            if (!product) {
                return res.status(404).json({
                    success: false,
                    message: "Product not found."
                });
            }

            return res.json({
                success: true,
                product
            });
        } catch (error) {
            console.error("GET PRODUCT ERROR:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to retrieve product."
            });
        }
    }
);

// ============================================================
// PRODUCTS - UPDATE
// ============================================================

app.put(
    "/api/products/:id",
    authenticateToken,
    requireRole("seller"),
    async (req, res) => {
        try {
            const { id } = req.params;

            if (!ObjectId.isValid(id)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid product ID."
                });
            }

            const updates = {};

            if (req.body.name !== undefined) {
                const name = cleanString(req.body.name);

                if (!name || name.length > 200) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid product name."
                    });
                }

                updates.name = name;
            }

            if (req.body.description !== undefined) {
                const description = cleanString(
                    req.body.description
                );

                if (description.length > 5000) {
                    return res.status(400).json({
                        success: false,
                        message: "Product description is too long."
                    });
                }

                updates.description = description;
            }

            if (req.body.category !== undefined) {
                const category = cleanString(req.body.category);

                if (category.length > 100) {
                    return res.status(400).json({
                        success: false,
                        message: "Category is too long."
                    });
                }

                updates.category = category;
            }

            if (req.body.image !== undefined) {
                const image = cleanString(req.body.image);

                if (image.length > 2000) {
                    return res.status(400).json({
                        success: false,
                        message: "Image field is too long."
                    });
                }

                updates.image = image;
            }

            if (req.body.price !== undefined) {
                const price = parsePositiveNumber(req.body.price);

                if (price === null) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid price."
                    });
                }

                updates.price = price;
            }

            if (req.body.stock !== undefined) {
                const stock = parseNonNegativeInteger(
                    req.body.stock
                );

                if (stock === null) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid stock quantity."
                    });
                }

                updates.stock = stock;
            }

            if (Object.keys(updates).length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "No valid fields were provided."
                });
            }

            updates.updatedAt = new Date();

            const result = await products.findOneAndUpdate(
                {
                    _id: new ObjectId(id),
                    sellerId: req.user.userId
                },
                {
                    $set: updates
                },
                {
                    returnDocument: "after"
                }
            );

            if (!result) {
                return res.status(404).json({
                    success: false,
                    message: "Product not found."
                });
            }

            return res.json({
                success: true,
                message: "Product updated successfully.",
                product: result
            });
        } catch (error) {
            console.error("UPDATE PRODUCT ERROR:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to update product."
            });
        }
    }
);

// ============================================================
// PRODUCTS - DELETE
// ============================================================

app.delete(
    "/api/products/:id",
    authenticateToken,
    requireRole("seller"),
    async (req, res) => {
        try {
            const { id } = req.params;

            if (!ObjectId.isValid(id)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid product ID."
                });
            }

            const result = await products.deleteOne({
                _id: new ObjectId(id),
                sellerId: req.user.userId
            });

            if (result.deletedCount === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Product not found."
                });
            }

            return res.json({
                success: true,
                message: "Product deleted successfully."
            });
        } catch (error) {
            console.error("DELETE PRODUCT ERROR:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to delete product."
            });
        }
    }
);

// ============================================================
// DASHBOARD - BASIC ANALYTICS
// ============================================================

app.get(
    "/api/dashboard/stats",
    authenticateToken,
    async (req, res) => {
        try {
            const sellerId = req.user.userId;

            const totalProducts = await products.countDocuments({
                sellerId
            });

            const stockResult = await products.aggregate([
                {
                    $match: { sellerId }
                },
                {
                    $group: {
                        _id: null,
                        totalStock: { $sum: "$stock" }
                    }
                }
            ]).toArray();

            const totalStock = stockResult.length > 0
                ? stockResult[0].totalStock
                : 0;

            return res.json({
                success: true,
                stats: {
                    totalProducts,
                    totalStock
                }
            });
        } catch (error) {
            console.error("DASHBOARD STATS ERROR:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to retrieve dashboard statistics."
            });
        }
    }
);

// ============================================================
// CUSTOMER CHECKOUT (cash on delivery, seller-fulfilled delivery)
// Server calculates all prices and never trusts a browser total.
// ============================================================

app.post("/api/checkout", optionalAuthenticateToken, async (req, res) => {
    const decremented = [];
    const insertedOrderIds = [];
    try {
        const customerName = cleanString(req.body.customerName);
        const customerPhone = cleanString(req.body.customerPhone);
        const customerEmail = cleanString(req.body.customerEmail).toLowerCase();
        const city = cleanString(req.body.city);
        const address = cleanString(req.body.address);
        const notes = cleanString(req.body.notes);
        const paymentMethod = cleanString(req.body.paymentMethod || "cod").toLowerCase();
        const rawItems = Array.isArray(req.body.items) ? req.body.items : [];

        if (req.user) {
            const checkoutUser = await users.findOne({ _id: new ObjectId(req.user.userId) }, { projection: { role: 1, disabled: 1 } });
            if (!checkoutUser || checkoutUser.disabled || !["customer", "seller"].includes(checkoutUser.role || "seller")) {
                return res.status(403).json({ success: false, message: "This account cannot place orders. Sign in with a customer or seller account, or check out as a guest." });
            }
        }

        if (customerName.length < 2 || customerName.length > 100) {
            return res.status(400).json({ success: false, message: "Enter your full name (2–100 characters)." });
        }
        if (customerPhone.length < 7 || customerPhone.length > 40) {
            return res.status(400).json({ success: false, message: "Enter a valid phone number." });
        }
        if (!city || city.length > 100 || !address || address.length > 500) {
            return res.status(400).json({ success: false, message: "Enter your city and delivery address." });
        }
        if (customerEmail && (!isValidEmail(customerEmail) || customerEmail.length > 254)) {
            return res.status(400).json({ success: false, message: "Enter a valid email address." });
        }
        if (notes.length > 1000) {
            return res.status(400).json({ success: false, message: "Delivery notes must be under 1,000 characters." });
        }
        if (paymentMethod !== "cod") {
            return res.status(400).json({ success: false, message: "Cash on delivery is the only payment method currently enabled." });
        }
        if (!rawItems.length || rawItems.length > 50) {
            return res.status(400).json({ success: false, message: "Your cart is empty or contains too many different products." });
        }

        const quantities = new Map();
        for (const item of rawItems) {
            const id = cleanString(item.id || item.productId);
            const quantity = Number(item.quantity);
            if (!ObjectId.isValid(id) || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
                return res.status(400).json({ success: false, message: "One or more cart items are invalid. Refresh your cart and try again." });
            }
            quantities.set(id, (quantities.get(id) || 0) + quantity);
        }
        for (const quantity of quantities.values()) {
            if (quantity > 99) return res.status(400).json({ success: false, message: "A product quantity cannot exceed 99." });
        }

        const ids = [...quantities.keys()].map(id => new ObjectId(id));
        const found = await products.find({ _id: { $in: ids } }).toArray();
        if (found.length !== ids.length) {
            return res.status(409).json({ success: false, message: "A product in your cart is no longer available. Refresh the marketplace." });
        }
        const productById = new Map(found.map(product => [product._id.toString(), product]));
        const grouped = new Map();
        for (const [id, quantity] of quantities.entries()) {
            const product = productById.get(id);
            const price = Number(product.price);
            const stock = Number(product.stock);
            if (!product.sellerId || product.isPublished === false || !Number.isFinite(price) || price < 0 || !Number.isInteger(stock) || stock < quantity) {
                return res.status(409).json({ success: false, message: `Not enough stock is available for ${product.name || "one product"}. Please update your cart.` });
            }
            const sellerId = String(product.sellerId);
            if (!grouped.has(sellerId)) grouped.set(sellerId, []);
            grouped.get(sellerId).push({
                productId: id,
                name: String(product.name || "Product"),
                image: String(product.image || ""),
                unitPrice: price,
                quantity,
                lineTotal: Math.round(price * quantity * 100) / 100
            });
        }

        // Atomically reserve each quantity. Roll back all reservations if any step fails.
        for (const [id, quantity] of quantities.entries()) {
            const update = await products.updateOne(
                { _id: new ObjectId(id), stock: { $gte: quantity }, isPublished: { $ne: false } },
                { $inc: { stock: -quantity }, $set: { updatedAt: new Date() } }
            );
            if (update.modifiedCount !== 1) {
                for (const reserved of decremented) await products.updateOne({ _id: new ObjectId(reserved.id) }, { $inc: { stock: reserved.quantity } });
                return res.status(409).json({ success: false, message: "Stock changed while checking out. Please review your cart and try again." });
            }
            decremented.push({ id, quantity });
        }

        const now = new Date();
        const orderSummaries = [];
        for (const [sellerId, items] of grouped.entries()) {
            const total = Math.round(items.reduce((sum, item) => sum + item.lineTotal, 0) * 100) / 100;
            const order = {
                sellerId,
                ...(req.user ? { customerId: req.user.userId } : {}),
                customerName,
                customerEmail,
                customerPhone,
                city,
                address,
                notes,
                items,
                total,
                status: "pending",
                paymentMethod: "cod",
                source: "marketplace",
                currency: "ETB",
                createdAt: now,
                updatedAt: now
            };
            const result = await orders.insertOne(order);
            insertedOrderIds.push(result.insertedId);
            orderSummaries.push({ orderId: result.insertedId.toString(), sellerId, total });
        }
        return res.status(201).json({
            success: true,
            message: "Order placed. The seller will contact you to confirm delivery.",
            orders: orderSummaries,
            total: Math.round(orderSummaries.reduce((sum, order) => sum + order.total, 0) * 100) / 100
        });
    } catch (error) {
        console.error("CUSTOMER CHECKOUT ERROR:", error);
        if (insertedOrderIds.length) await orders.deleteMany({ _id: { $in: insertedOrderIds } }).catch(() => {});
        for (const reserved of decremented) await products.updateOne({ _id: new ObjectId(reserved.id) }, { $inc: { stock: reserved.quantity } }).catch(() => {});
        return res.status(500).json({ success: false, message: "We could not place your order. Your cart has been kept; please try again." });
    }
});

// Customer order history: returns only orders created while this account was signed in.
app.get("/api/customer/orders", authenticateToken, requireRole("customer", "seller"), async (req, res) => {
    try {
        const list = await orders.find({ customerId: req.user.userId }).sort({ createdAt: -1 }).limit(200).toArray();
        return res.json({ success: true, orders: list });
    } catch (error) {
        console.error("CUSTOMER ORDER HISTORY ERROR:", error);
        return res.status(500).json({ success: false, message: "Unable to retrieve your orders." });
    }
});

// ============================================================
// ORDERS - LIST
// ============================================================

app.get(
    "/api/orders",
    authenticateToken,
    requireRole("seller"),
    async (req, res) => {
        try {
            const list = await orders
                .find({ sellerId: req.user.userId })
                .sort({ createdAt: -1 })
                .limit(500)
                .toArray();

            return res.json({
                success: true,
                orders: list
            });
        } catch (error) {
            console.error("GET ORDERS ERROR:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to retrieve orders."
            });
        }
    }
);

// ============================================================
// ORDERS - CREATE
// ============================================================

app.post(
    "/api/orders",
    authenticateToken,
    requireRole("seller"),
    async (req, res) => {
        try {
            const customerName = cleanString(req.body.customerName);
            const customerEmail = cleanString(
                req.body.customerEmail
            ).toLowerCase();
            const customerPhone = cleanString(req.body.customerPhone);
            const notes = cleanString(req.body.notes);
            const total = parsePositiveNumber(req.body.total);
            const status = cleanString(req.body.status) || "pending";

            const allowedStatuses = [
                "pending",
                "processing",
                "shipped",
                "completed",
                "cancelled"
            ];

            if (!customerName || customerName.length > 100) {
                return res.status(400).json({
                    success: false,
                    message: "A valid customer name is required."
                });
            }

            if (customerEmail.length > 254) {
                return res.status(400).json({
                    success: false,
                    message: "Customer email is too long."
                });
            }

            if (customerPhone.length > 40 || notes.length > 2000) {
                return res.status(400).json({
                    success: false,
                    message: "Customer phone or notes field is too long."
                });
            }

            if (total === null) {
                return res.status(400).json({
                    success: false,
                    message: "Total must be zero or a positive number."
                });
            }

            if (!allowedStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid order status."
                });
            }

            if (customerEmail && !isValidEmail(customerEmail)) {
                return res.status(400).json({
                    success: false,
                    message: "Enter a valid customer email."
                });
            }

            const now = new Date();

            const order = {
                sellerId: req.user.userId,
                customerName,
                customerEmail,
                customerPhone,
                notes,
                total,
                status,
                currency: "ETB",
                createdAt: now,
                updatedAt: now
            };

            const result = await orders.insertOne(order);

            order._id = result.insertedId;

            return res.status(201).json({
                success: true,
                message: "Order created.",
                order
            });
        } catch (error) {
            console.error("CREATE ORDER ERROR:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to create order."
            });
        }
    }
);

// ============================================================
// ORDERS - UPDATE STATUS
// Seller ownership is enforced. Cancelling an unshipped marketplace order
// restores reserved stock exactly once.
// ============================================================

app.patch(
    "/api/orders/:id/status",
    authenticateToken,
    requireRole("seller"),
    async (req, res) => {
        try {
            if (!ObjectId.isValid(req.params.id)) {
                return res.status(400).json({ success: false, message: "Invalid order ID." });
            }
            const status = cleanString(req.body.status);
            const allowedStatuses = ["pending", "processing", "shipped", "completed", "cancelled"];
            if (!allowedStatuses.includes(status)) {
                return res.status(400).json({ success: false, message: "Invalid order status." });
            }
            const orderId = new ObjectId(req.params.id);
            const existing = await orders.findOne({ _id: orderId, sellerId: req.user.userId });
            if (!existing) return res.status(404).json({ success: false, message: "Order not found." });
            if (existing.status === status) return res.json({ success: true, order: existing, message: "Order status is unchanged." });
            if (["completed", "cancelled"].includes(existing.status)) {
                return res.status(409).json({ success: false, message: "Completed or cancelled orders cannot be changed." });
            }
            if (status === "pending") {
                return res.status(400).json({ success: false, message: "An order cannot be moved back to pending." });
            }
            if (status === "cancelled" && existing.status === "shipped") {
                return res.status(409).json({ success: false, message: "A shipped order cannot be cancelled from the seller dashboard." });
            }
            const updated = await orders.findOneAndUpdate(
                { _id: orderId, sellerId: req.user.userId, status: existing.status },
                { $set: { status, updatedAt: new Date() } },
                { returnDocument: "after" }
            );
            if (!updated) return res.status(409).json({ success: false, message: "This order changed in another request. Refresh and try again." });
            if (status === "cancelled" && existing.source === "marketplace" && Array.isArray(existing.items)) {
                for (const item of existing.items) {
                    if (ObjectId.isValid(item.productId) && Number.isInteger(Number(item.quantity)) && Number(item.quantity) > 0) {
                        await products.updateOne({ _id: new ObjectId(item.productId) }, { $inc: { stock: Number(item.quantity) }, $set: { updatedAt: new Date() } });
                    }
                }
            }
            return res.json({ success: true, order: updated, message: "Order status updated." });
        } catch (error) {
            console.error("UPDATE ORDER ERROR:", error);
            return res.status(500).json({ success: false, message: "Unable to update order." });
        }
    }
);

// ============================================================
// CUSTOMERS - DERIVED FROM SELLER'S ORDERS
// ============================================================

app.get(
    "/api/customers",
    authenticateToken,
    requireRole("seller"),
    async (req, res) => {
        try {
            const customersList = await orders.aggregate([
                {
                    $match: {
                        sellerId: req.user.userId
                    }
                },
                {
                    $group: {
                        _id: {
                            email: "$customerEmail",
                            name: "$customerName"
                        },
                        customerName: {
                            $first: "$customerName"
                        },
                        customerEmail: {
                            $first: "$customerEmail"
                        },
                        customerPhone: {
                            $first: "$customerPhone"
                        },
                        orderCount: {
                            $sum: 1
                        },
                        totalSpent: {
                            $sum: {
                                $cond: [
                                    { $ne: ["$status", "cancelled"] },
                                    "$total",
                                    0
                                ]
                            }
                        },
                        lastOrderAt: {
                            $max: "$createdAt"
                        }
                    }
                },
                {
                    $sort: {
                        lastOrderAt: -1
                    }
                }
            ]).toArray();

            return res.json({
                success: true,
                customers: customersList
            });
        } catch (error) {
            console.error("GET CUSTOMERS ERROR:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to retrieve customers."
            });
        }
    }
);

// ============================================================
// STORE PROFILE - GET
// ============================================================

app.get(
    "/api/store",
    authenticateToken,
    requireRole("seller"),
    async (req, res) => {
        try {
            const user = await users.findOne({
                _id: new ObjectId(req.user.userId)
            });

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "Account not found."
                });
            }

            return res.json({
                success: true,
                store: {
                    storeName: user.storeName || `${user.name}'s Store`,
                    storeDescription: user.storeDescription || "",
                    storePhone: user.storePhone || "",
                    storeAddress: user.storeAddress || "",
                    telegramUsername: user.telegramUsername || ""
                }
            });
        } catch (error) {
            console.error("GET STORE ERROR:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to retrieve store profile."
            });
        }
    }
);

// ============================================================
// STORE PROFILE - UPDATE
// ============================================================

app.put(
    "/api/store",
    authenticateToken,
    requireRole("seller"),
    async (req, res) => {
        try {
            const storeName = cleanString(req.body.storeName);
            const storeDescription = cleanString(
                req.body.storeDescription
            );
            const storePhone = cleanString(req.body.storePhone);
            const storeAddress = cleanString(req.body.storeAddress);

            const telegramUsername = cleanString(
                req.body.telegramUsername
            ).replace(/^@/, "");

            if (!storeName) {
                return res.status(400).json({
                    success: false,
                    message: "Store name is required."
                });
            }

            if (
                storeName.length > 100 ||
                storeDescription.length > 1000 ||
                storePhone.length > 40 ||
                storeAddress.length > 200 ||
                telegramUsername.length > 64
            ) {
                return res.status(400).json({
                    success: false,
                    message: "One or more fields are too long."
                });
            }

            const result = await users.updateOne(
                {
                    _id: new ObjectId(req.user.userId)
                },
                {
                    $set: {
                        storeName,
                        storeDescription,
                        storePhone,
                        storeAddress,
                        telegramUsername,
                        storeUpdatedAt: new Date()
                    }
                }
            );

            if (result.matchedCount === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Account not found."
                });
            }

            return res.json({
                success: true,
                message: "Store profile saved.",
                store: {
                    storeName,
                    storeDescription,
                    storePhone,
                    storeAddress,
                    telegramUsername
                }
            });
        } catch (error) {
            console.error("SAVE STORE ERROR:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to save store profile."
            });
        }
    }
);

// ============================================================
// PUBLIC STORE - GET SELLER PROFILE AND PRODUCTS
// No login required.
//
// GET /api/stores/:sellerId
//
// Returns only public store fields and the seller's in-stock
// products. Never return the seller's email, password hash,
// JWT, or private account fields from this endpoint.
// ============================================================

app.get(
    "/api/stores/:sellerId",
    async (req, res) => {
        try {
            const { sellerId } = req.params;

            if (!ObjectId.isValid(sellerId)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid store link."
                });
            }

            const seller = await users.findOne(
                {
                    _id: new ObjectId(sellerId),
                    role: "seller"
                },
                {
                    projection: {
                        name: 1,
                        role: 1,
                        storeName: 1,
                        storeDescription: 1,
                        storePhone: 1,
                        storeAddress: 1,
                        telegramUsername: 1,
                        createdAt: 1
                    }
                }
            );

            if (!seller) {
                return res.status(404).json({
                    success: false,
                    message: "This store could not be found."
                });
            }

            const storeProducts = await products
                .find({
                    sellerId: seller._id.toString(),
                    stock: { $gt: 0 },
                    isPublished: { $ne: false }
                })
                .sort({ createdAt: -1 })
                .limit(500)
                .toArray();

            return res.status(200).json({
                success: true,

                store: {
                    id: seller._id.toString(),
                    storeName:
                        seller.storeName ||
                        `${seller.name}'s Store`,
                    storeDescription: seller.storeDescription || "",
                    storePhone: seller.storePhone || "",
                    storeAddress: seller.storeAddress || "",
                    telegramUsername: seller.telegramUsername || "",
                    createdAt: seller.createdAt || null
                },

                products: storeProducts.map(createPublicProduct)
            });
        } catch (error) {
            console.error("PUBLIC STORE ERROR:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to load this store."
            });
        }
    }
);

// ============================================================
// ANALYTICS - REAL DATA FROM PRODUCTS AND ORDERS
// ============================================================

app.get(
    "/api/analytics",
    authenticateToken,
    requireRole("seller"),
    async (req, res) => {
        try {
            const sellerId = req.user.userId;

            const [
                totalProducts,
                productStock,
                orderList
            ] = await Promise.all([
                products.countDocuments({ sellerId }),

                products.aggregate([
                    {
                        $match: { sellerId }
                    },
                    {
                        $group: {
                            _id: null,
                            stock: { $sum: "$stock" },
                            catalogueValue: {
                                $sum: {
                                    $multiply: ["$price", "$stock"]
                                }
                            }
                        }
                    }
                ]).toArray(),

                orders
                    .find({ sellerId })
                    .sort({ createdAt: -1 })
                    .toArray()
            ]);

            const activeOrders = orderList.filter(
                order => order.status !== "cancelled"
            );

            const completedOrders = orderList.filter(
                order => order.status === "completed"
            );

            const revenue = completedOrders.reduce(
                (sum, order) => sum + (Number(order.total) || 0),
                0
            );

            const monthly = {};

            for (const order of activeOrders) {
                const date = new Date(order.createdAt || Date.now());

                const key = `${date.getFullYear()}-${String(
                    date.getMonth() + 1
                ).padStart(2, "0")}`;

                monthly[key] ||= {
                    month: key,
                    orders: 0,
                    revenue: 0
                };

                monthly[key].orders += 1;

                if (order.status === "completed") {
                    monthly[key].revenue += Number(order.total) || 0;
                }
            }

            return res.json({
                success: true,
                analytics: {
                    totalProducts,
                    totalStock: productStock[0]?.stock || 0,
                    catalogueValue: productStock[0]?.catalogueValue || 0,
                    totalOrders: orderList.length,
                    activeOrders: activeOrders.length,
                    completedOrders: completedOrders.length,
                    cancelledOrders: orderList.filter(
                        order => order.status === "cancelled"
                    ).length,
                    revenue,
                    monthly: Object.values(monthly)
                        .sort((a, b) => a.month.localeCompare(b.month))
                        .slice(-6)
                }
            });
        } catch (error) {
            console.error("ANALYTICS ERROR:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to retrieve analytics."
            });
        }
    }
);

// ============================================================
// TELEGRAM - CONNECTION STATUS
// ============================================================

app.get(
    "/api/telegram/status",
    authenticateToken,
    requireRole("seller"),
    async (req, res) => {
        try {
            const user = await users.findOne(
                {
                    _id: new ObjectId(req.user.userId)
                },
                {
                    projection: {
                        telegramUsername: 1
                    }
                }
            );

            return res.json({
                success: true,
                telegram: {
                    username: user?.telegramUsername || "",
                    botConfigured: Boolean(
                        process.env.TELEGRAM_BOT_TOKEN
                    ),
                    connected: false,
                    note: process.env.TELEGRAM_BOT_TOKEN
                        ? "A bot token is configured on the server. Full bot/webhook activation still requires setup."
                        : "No bot token is configured. Add TELEGRAM_BOT_TOKEN to backend/.env to begin setup."
                }
            });
        } catch (error) {
            console.error("TELEGRAM STATUS ERROR:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to retrieve Telegram status."
            });
        }
    }
);

// ============================================================
// ADMIN API — access requires an administrator role set in MongoDB.
// ============================================================
app.get("/api/admin/overview", authenticateToken, requireRole("admin"), async (req, res) => {
    try {
        const [userCount, sellerCount, customerCount, productCount, orderCount, salesAgg, completedAgg, recentOrders] = await Promise.all([
            users.countDocuments({ disabled: { $ne: true } }),
            users.countDocuments({ role: "seller", disabled: { $ne: true } }),
            users.countDocuments({ role: "customer", disabled: { $ne: true } }),
            products.countDocuments({}),
            orders.countDocuments({}),
            orders.aggregate([{ $match: { status: { $nin: ["cancelled"] } } }, { $group: { _id: null, total: { $sum: "$total" } } }]).toArray(),
            orders.aggregate([{ $match: { status: "completed", source: "marketplace" } }, { $group: { _id: null, total: { $sum: "$total" } } }]).toArray(),
            orders.find({}).sort({ createdAt: -1 }).limit(10).toArray()
        ]);
        return res.json({ success: true, overview: { userCount, sellerCount, customerCount, productCount, orderCount, grossOrderValue: salesAgg[0]?.total || 0, completedOrderValue: completedAgg[0]?.total || 0, commissionRate: PLATFORM_COMMISSION_RATE, estimatedCommission: (completedAgg[0]?.total || 0) * PLATFORM_COMMISSION_RATE, recentOrders } });
    } catch (error) {
        console.error("ADMIN OVERVIEW ERROR:", error);
        return res.status(500).json({ success: false, message: "Unable to load admin overview." });
    }
});

app.get("/api/admin/users", authenticateToken, requireRole("admin"), async (req, res) => {
    try {
        const list = await users.find({}, { projection: { passwordHash: 0 } }).sort({ createdAt: -1 }).limit(500).toArray();
        return res.json({ success: true, users: list.map(user => ({ id: user._id.toString(), name: user.name, email: user.email, role: user.role || "seller", disabled: Boolean(user.disabled), createdAt: user.createdAt })) });
    } catch (error) {
        console.error("ADMIN USERS ERROR:", error);
        return res.status(500).json({ success: false, message: "Unable to load users." });
    }
});

app.get("/api/admin/products", authenticateToken, requireRole("admin"), async (req, res) => {
    try {
        const list = await products.find({}).sort({ createdAt: -1 }).limit(1000).toArray();
        return res.json({ success: true, products: list.map(product => ({ id: product._id.toString(), name: product.name || "Unnamed product", category: product.category || "Uncategorized", price: Number(product.price) || 0, stock: Number(product.stock) || 0, sellerId: product.sellerId || "", isPublished: product.isPublished !== false, createdAt: product.createdAt || null })) });
    } catch (error) {
        console.error("ADMIN PRODUCTS ERROR:", error);
        return res.status(500).json({ success: false, message: "Unable to load marketplace products." });
    }
});

app.patch("/api/admin/products/:id", authenticateToken, requireRole("admin"), async (req, res) => {
    try {
        if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false, message: "Invalid product ID." });
        if (typeof req.body.isPublished !== "boolean") return res.status(400).json({ success: false, message: "isPublished must be true or false." });
        const result = await products.updateOne({ _id: new ObjectId(req.params.id) }, { $set: { isPublished: req.body.isPublished, moderatedAt: new Date(), moderatedBy: req.user.userId, updatedAt: new Date() } });
        if (!result.matchedCount) return res.status(404).json({ success: false, message: "Product not found." });
        return res.json({ success: true, message: req.body.isPublished ? "Product published." : "Product hidden from the public marketplace." });
    } catch (error) {
        console.error("ADMIN MODERATE PRODUCT ERROR:", error);
        return res.status(500).json({ success: false, message: "Unable to update product visibility." });
    }
});

app.get("/api/admin/orders", authenticateToken, requireRole("admin"), async (req, res) => {
    try {
        const list = await orders.find({}).sort({ createdAt: -1 }).limit(500).toArray();
        return res.json({ success: true, orders: list });
    } catch (error) {
        console.error("ADMIN ORDERS ERROR:", error);
        return res.status(500).json({ success: false, message: "Unable to load marketplace orders." });
    }
});

app.patch("/api/admin/users/:id", authenticateToken, requireRole("admin"), async (req, res) => {
    try {
        if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false, message: "Invalid user ID." });
        const changes = {};
        if (typeof req.body.disabled === "boolean") changes.disabled = req.body.disabled;
        if (req.body.role && ["customer", "seller"].includes(req.body.role)) changes.role = req.body.role;
        if (!Object.keys(changes).length) return res.status(400).json({ success: false, message: "Provide a valid role or disabled value." });
        if (req.params.id === req.user.userId && changes.disabled === true) return res.status(400).json({ success: false, message: "You cannot disable your own administrator account." });
        changes.updatedAt = new Date();
        const targetUserId = req.params.id;
        const result = await users.updateOne({ _id: new ObjectId(targetUserId) }, { $set: changes });
        if (!result.matchedCount) return res.status(404).json({ success: false, message: "User not found." });
        if (changes.disabled === true || changes.role === "customer") {
            await products.updateMany({ sellerId: targetUserId }, { $set: { isPublished: false, updatedAt: new Date() } });
        }
        return res.json({ success: true, message: "Account updated. Seller products were hidden where applicable; an administrator must republish them if appropriate." });
    } catch (error) {
        console.error("ADMIN UPDATE USER ERROR:", error);
        return res.status(500).json({ success: false, message: "Unable to update account." });
    }
});

// ============================================================
// 404 HANDLER
// ============================================================

app.use((req, res) => {
    return res.status(404).json({
        success: false,
        message: "Endpoint not found."
    });
});

// ============================================================
// GLOBAL ERROR HANDLER
// ============================================================

app.use((error, req, res, next) => {
    console.error("UNHANDLED ERROR:", error);

    return res.status(500).json({
        success: false,
        message: "Internal server error."
    });
});

// ============================================================
// START SERVER
// ============================================================

async function startServer() {
    try {
        await connectDatabase();

        app.listen(PORT, () => {
            console.log(
                `TeleShop server running on http://localhost:${PORT}`
            );
        });
    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
}

startServer();

// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================

async function shutdown(signal) {
    console.log(`${signal} received. Shutting down server...`);

    try {
        await client.close();
        process.exit(0);
    } catch (error) {
        console.error("Shutdown error:", error);
        process.exit(1);
    }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
