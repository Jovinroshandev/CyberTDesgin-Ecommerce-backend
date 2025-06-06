// Import required modules
const express = require("express");
const router = express.Router();
const Cart = require("../models/Cart"); // Mongoose model for Cart
const StockManage = require("../models/stockmanagement"); // Mongoose model for Product/Stock

// ----------------------------
// Route: POST /addtocart
// Purpose: Add a product to the user's cart. If the cart doesn't exist, create one.
// ----------------------------
router.post("/addtocart", async (req, res) => {
    const { UserId, productId, orderStatus } = req.body;
    const quantity = 1;

    // Find existing cart by user ID
    let cart = await Cart.findOne({ UserId });

    if (!cart) {
        // Create a new cart if none exists
        cart = new Cart({
            UserId,
            Items: [{ productId, quantity, orderStatus: false }]
        });
    } else {
        // Check if the item already exists in the cart
        const item = cart.Items.find(i => i.productId === productId);
        if (item) {
            item.quantity += 1; // Increment quantity if already in cart
        } else {
            cart.Items.push({ productId, quantity }); // Add new product to cart
        }
    }

    // Save updated or newly created cart
    await cart.save();
    res.send(cart);
});

// ----------------------------
// Route: POST /increase
// Purpose: Increase the quantity of a specific product in the user's cart
// ----------------------------
router.post("/increase", async (req, res) => {
    const { UserId, productId, quantity } = req.body;

    const cart = await Cart.findOne({ UserId });

    const item = cart.Items.find(i => i.productId === productId);
    if (item) {
        item.quantity += 1; // Increment quantity
    } else {
        cart.Items.push({ productId, quantity }); // Add product if not already present
    }

    await cart.save();
    res.send(cart);
});

// ----------------------------
// Route: GET /:UserId
// Purpose: Fetch all items in a user's cart along with full product details
// ----------------------------
router.get("/:UserId", async (req, res) => {
    const cart = await Cart.findOne({ UserId: req.params.UserId });

    // If cart is empty or doesn't exist, return an empty list
    if (!cart || cart.Items.length === 0) {
        return res.send({ items: [] });
    }

    // Extract product IDs from cart and fetch full product details from StockManage
    const productIds = cart.Items.map(i => i.productId);
    const products = await StockManage.find({ _id: { $in: productIds } });

    // Combine cart item and product info
    const detailedItems = cart.Items.map(item => {
        const product = products.find(p => p._id.toString() === item.productId);
        if (!product) return null;

        return {
            productId: item.productId,
            quantity: item.quantity,
            productName: product.productName,
            productDesc: product.productDesc,
            imageURL: product.imageURL,
            productPrice: parseFloat(product.productPrice)
        };
    }).filter(Boolean); // Remove null entries

    res.send({ items: detailedItems });
});

// ----------------------------
// Route: GET /:UserId/quantity
// Purpose: Retrieve only product IDs and their quantities for a user's cart
// ----------------------------
router.get("/:UserId/quantity", async (req, res) => {
    const cart = await Cart.findOne({ UserId: req.params.UserId });

    if (!cart || cart.Items.length === 0) {
        return res.send({ items: [] });
    }

    const productIds = cart.Items.map(i => i.productId);
    const products = await StockManage.find({ _id: { $in: productIds } });

    // Return only productId and quantity without full details
    const detailedItems = cart.Items.map(item => {
        const product = products.find(p => p._id.toString() === item.productId);
        if (!product) return null;

        return {
            productId: item.productId,
            quantity: item.quantity,
        };
    }).filter(Boolean);

    res.send({ items: detailedItems });
});

// ----------------------------
// Route: PUT /decrease-cart
// Purpose: Decrease the quantity of a specific product in the cart
// ----------------------------
router.put("/decrease-cart", async (req, res) => {
    const { UserId, productId } = req.body;

    const cart = await Cart.findOne({ UserId });
    if (!cart) return res.send({ message: "Cart not found!" });

    const item = cart.Items.find(i => i.productId === productId);

    if (item) {
        item.quantity -= 1;
        await cart.save();
        res.send(cart);
    } else {
        res.send({ message: "Item not found in cart!" });
    }
});

// ----------------------------
// Route: DELETE /remove
// Purpose: Remove a specific item from the user's cart
// ----------------------------
router.delete("/remove", async (req, res) => {
    const { UserId, productId } = req.body;

    const cart = await Cart.findOne({ UserId });
    if (!cart) return res.send({ message: "Cart not found!" });

    // Remove item by filtering out the matching productId
    cart.Items = cart.Items.filter(i => i.productId !== productId);
    await cart.save();

    res.send(cart);
});

// ----------------------------
// Route: PUT /clear-cart
// Purpose: Clear all items from the user's cart, typically after order placement
// ----------------------------
router.put('/clear-cart', async (req, res) => {
    const { UserId } = req.body;

    try {
        const cart = await Cart.findOne({ UserId });
        if (!cart) {
            return res.status(404).json({ message: "Cart not found!" });
        }

        // Empty the cart items array
        cart.Items = [];
        await cart.save();

        res.status(200).json({ message: "Cart cleared after order placed" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to clear cart" });
    }
});

// Export the router to be used in the main server file
module.exports = router;
