const express = require("express");
const router = express.Router();
const { isSignedIn, isAuthenticated, isAdmin } = require("../controllers/auth");
const { getUserById, pushOrderInPurchaseList } = require("../controllers/user");
const { updateStock } = require("../controllers/product");

const {
  getOrderById,
  createOrder,
  getAllOrders,
  getOrderStatus,
  updateStatus,
  addToCart,
  deleteFromCart,
  getUserCart,
  updateQuantity,
  updatePayment,
} = require("../controllers/order");

//params
router.param("userId", getUserById);
router.param("orderId", getOrderById);

//Actual routes
//create

router.post(
  "/cart/add",
  isSignedIn,
  addToCart
)

router.put(
  "/cart/delete",
  isSignedIn, 
  deleteFromCart  
)

router.put(
  "/cart/updateQuantity", 
  isSignedIn, 
  updateQuantity
)
 
router.get(
  "/cart/get",
  isSignedIn,
  getUserCart
)

router.post(
  "/order/create/:userId",
  isSignedIn,
  isAuthenticated,
  //updateStock,
  createOrder
);
//read
router.get(
  "/order/all/:userId",
  isSignedIn,
  isAuthenticated,
  isAdmin,
  getAllOrders
);

//status of order
router.get(
  "/order/status/:userId",
  isSignedIn,
  isAuthenticated,
  isAdmin,
  getOrderStatus
);
router.put(
  "/order/:orderId/status/:userId",
  isSignedIn,
  isAuthenticated,
  isAdmin,
  updateStatus
);

router.put(
  "/order/updateTransactionId/:userId",
  isSignedIn,
  isAuthenticated,
  isAdmin,
  updatePayment
)

module.exports = router;