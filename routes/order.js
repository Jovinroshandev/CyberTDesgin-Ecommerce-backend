const express = require("express");
const router = express.Router();
const Order = require("../models/Orders");

//==========================================================================
// Create Order
//==========================================================================
router.post("/place-order", async (req, res) => {
  try {
    const { UsrId, Items } = req.body;
    const newOrder = new Order({ UsrId, Items });
    await newOrder.save();
    res.status(200).json({ message: "Order placed successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to place order", error });
  }
});

//==========================================================================
// Get Order History
//==========================================================================
router.get("/history/:userId", async (req, res) => {
  try {
    const orders = await Order.find({ UsrId: req.params.userId });
    res.status(200).json({ orders });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch order history", error });
  }
});


module.exports = router;