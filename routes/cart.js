const express = require("express");
const router = express.Router();
const Cart = require("../models/Cart");
const StockManage = require("../models/stockmanagement"); // Import Stock model

// ----------------------------
// Add to Cart
// ----------------------------
router.post("/addtocart", async (req, res) => {
    const { UserId, productId } = req.body;
    const quantity = 1
    let cart = await Cart.findOne({ UserId });
    if (!cart) {
        // Create new cart
        cart = new Cart({
            UserId,
            Items: [{ productId, quantity }]
        });
    } else {
        const item = cart.Items.find(i => i.productId === productId);
        if (item) {
            item.quantity += 1;
        } else {
            cart.Items.push({ productId, quantity });
        }
    }

    await cart.save();
    res.send(cart);
});

// ----------------------------
// Increase Quantity
// ----------------------------
router.post("/add", async (req, res) => {
    const { UserId, productId, quantity } = req.body;
    let cart = await Cart.findOne({ UserId });
    const item = cart.Items.find(i => i.productId === productId);
    if (item) {
        item.quantity += 1;
    } else {
        cart.Items.push({ productId, quantity });
    }
    await cart.save();
    res.send(cart);
});


// ----------------------------
// Get Cart with Product Info
// ----------------------------
router.get("/:UserId", async (req, res) => {
    const cart = await Cart.findOne({ UserId: req.params.UserId });

    if (!cart || cart.Items.length === 0) {
        return res.send({ items: [] });
    }

    const productIds = cart.Items.map(i => i.productId);
    const products = await StockManage.find({ _id: { $in: productIds } });

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
    }).filter(Boolean); // remove nulls

    res.send({ items: detailedItems });
});
// ----------------------------
// Get Quantity
// ----------------------------
router.get("/:UserId/quantity", async (req, res) => {
    const cart = await Cart.findOne({ UserId: req.params.UserId });

    if (!cart || cart.Items.length === 0) {
        return res.send({ items: [] });
    }

    const productIds = cart.Items.map(i => i.productId);
    const products = await StockManage.find({ _id: { $in: productIds } });

    const detailedItems = cart.Items.map(item => {
        const product = products.find(p => p._id.toString() === item.productId);
        if (!product) return null;
        return {
            productId: item.productId,
            quantity: item.quantity,
        };
    }).filter(Boolean); // remove nulls

    res.send({ items: detailedItems });
});


// ----------------------------
// Update Quantity
// ----------------------------
router.put("/descrease-cart", async (req, res) => {
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
// Remove Item from Cart
// ----------------------------
router.delete("/remove", async (req, res) => {
    const { UserId, productId } = req.body;
    const cart = await Cart.findOne({ UserId });
    if (!cart) return res.send({ message: "Cart not found!" });

    cart.Items = cart.Items.filter(i => i.productId !== productId);
    await cart.save();

    res.send(cart);
});

module.exports = router;
