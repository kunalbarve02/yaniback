const { Order, ProductCart } = require("../models/order");
const Product = require("../models/product");
const User = require("../models/user");
const { transporter } = require('../mail/transporter');
const razorpay = require('razorpay');

const razorpayInstance = new razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
}); 

exports.addToCart = (req, res) => {

  User.findByIdAndUpdate(req.auth._id, { $push: { cart: { product: req.body.productId, quantity: req.body.quantity } } }, { new: true }, (err, user) => {
    if (err) {
      console.log(err);
      return res.status(400).json({
        error: "Failed to add to cart"
      });
    }

    res.status(200).json(user);
  } );

}

exports.deleteFromCart = (req, res) => {
  User.findByIdAndUpdate(req.auth._id, { $pull: { cart: { product: req.body.productId } } }, { new: true }, async(err, user) => {
    if (err) {
      return res.status(400).json({
        error: "Failed to delete from cart"
      });
    }
    cart = user.cart;
    cart = await Product.populate(cart, { path: "product", select: "name price" });
    res.status(200).json(cart);
  } )
}

exports.getUserCart = async (req, res) => {
  let cart 
  console.log(typeof process.env.PASSWORD);
  User.findById(req.auth._id) 
  .exec(async(err, user) => {
    if (err) {
      return res.status(400).json({
        error: "Failed to get cart"
      });
    }

    cart = user.cart;
    cart = await Product.populate(cart, { path: "product", select: "name price" });
    console.log(cart);
    res.json(cart);
  }
  )
}

exports.updateQuantity = (req, res) => {
  console.log(req.body);
  /*User.findByIdAndUpdate(req.auth._id, { $set: { "cart.$[elem].quantity": req.body.quantity } }, { arrayFilters: [{ "elem.product": req.body.productId,useFindAndModify:false }] }, (err, user) => {
    if (err) {
      return res.status(400).json({
        error: "Failed to update quantity"
      });
    }
    res.status(200).json(user.cart);
  } )*/
  User.updateOne({_id:req.auth._id, 'cart.product': req.body.productId }, { $set:{ 'cart.$.quantity': req.body.quantity } }, { new: true }, (err, user) => {
    if (err) {
      return res.status(400).json({
        error: "Failed to increment quantity"
      });
    }
    console.log(user.cart)
    res.status(200).json(user.cart);
  } )
}
exports.getOrderById = (req, res, next, id) => {
  Order.findById(id)
    .populate("products.product", "name price")
    .exec((err, order) => {
      if (err) {
        return res.status(400).json({
          error: "NO order found in DB"
        });
      }
      req.order = order;
      next();
    });
};

exports.createOrder = (req, res) => {

  console.log(req.body.order.products);

  products = req.body.order.products;

  req.body.order.user = req.profile;

  const order = new Order(req.body.order);
  order.save(async(err, order) => {
    let razorpayOrder
    if (err) {
      console.log(err);
      return res.status(400).json({
        error: "Failed to save your order in DB"
      });
    }
    if(
      order.paymentMethod === "Online Payment"
    )
    {
      await razorpayInstance.orders.create({
        amount: (order.amount * 100).toString(),
        currency: "INR",
        receipt: (order._id).toString(),
        payment_capture: 1 
      },(err, order) => {
        if (err) {
          console.log(err);
          return res.status(400).json({
            error: "Failed to create razorpay order"
          });
        }
        razorpayOrder = order;
        console.log("127",order);
      })
    }
    console.log("130",razorpayOrder);
    res.json({order, razorpayOrder});
    products = await Product.populate(products, { path: "productId", select: "name" });
    console.log(products);
    transporter.sendMail({
      to: req.profile.email,
      from: 'info.yanistore@gmail.com',
      subject: "Order Placed !",
      text:'Hello,\n\n' +'You have successfully placed an order.\n\n' + 'Your order id is ' + order._id + '\n\n' + 'Thank you for shopping with us.\n\n' + 'Team Yani'
    },(err,info)=>{
      if(err){
        console.log(err);
      }
      else{
        console.log('Email sent: ' + info.response);
      }
    })
    transporter.sendMail({
      to: 'info.yanistore@gmail.com',
      from: 'info.yanistore@gmail.com',
      subject: "New Order!!",
      text:'Hello,\n\n' +'You have received a new order.\n\n' + 'Order id is ' + order._id + '\n\n' + 'Customer Info :' + '\n\n' +
      'Name: '+req.profile.name+' ' + req.profile.lastname+'\n' + 'Eamil : ' + req.profile.email + '\n' + 'Address : ' + req.profile.address
      +'\n Products Ordered : '+products.map(p=>{
        return '\n'+p.productId.name+'\n'+'Quantity: '+p.quantity+'\n'
      })
    },(err,info)=>{
      if(err){
        console.log(err);
      }
      else{
        console.log('Email sent: ' + info.response);
      }
    })
  })

  User.findByIdAndUpdate(req.auth._id,{ cart:[] })
  .then(user => {
    console.log(user);
  }
  )
};

exports.getAllOrders = (req, res) => {
  Order.find()
    .populate("user")
    .populate("products.productId")
    .sort({createdAt: -1})
    .exec((err, order) => {
      if (err) {
        console.log(err);
        return res.status(400).json({
          error: "No orders found in DB"
        });
      }
      res.json(order);
    });
};

exports.getOrderStatus = (req, res) => {
  res.json(Order.schema.path("status").enumValues);
};

exports.updateStatus = (req, res) => {
  Order.update(
    { _id: req.body.orderId },
    { $set: { status: req.body.status } },
    (err, order) => {
      if (err) {
        return res.status(400).json({
          error: "Cannot update order status"
        });
      }
      res.json(order);
    }
  );
}

exports.updatePayment = (req,res)=>{
  Order.update(
    { _id: req.body.orderId },
    { $set: { transaction: { paid:true, paymentId:req.body.paymentId }} },
    (err, order) => {
      if (err) {
        return res.status(400).json({
          error: "Cannot update order payment"
        });
      }
      console.log(order);
      res.json(order);
    }
  );
}






