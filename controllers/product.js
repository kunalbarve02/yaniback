const Product = require("../models/product");
const formidable = require("formidable");
const _ = require("lodash");
const fs = require("fs");

exports.getProductById = (req, res, next, id) => {
  Product.findById(id)
    .populate("category")
    .exec((err, product) => {
      if (err) {
        return res.status(400).json({
          error: "Product not found"
        });
      }
      req.product = product;
      next();
    });
};

exports.createProduct = (req, res) => {
  let form = new formidable.IncomingForm();
  form.keepExtensions = true;

  console.log(form)

  form.parse(req, (err, fields, file) => {
    if (err) {
      return res.status(400).json({
        error: "problem with image"
      });
    }
    //destructure the fields
    const { name, description, price, category, stock } = fields;

    if (!name || !description || !price || !category || !stock) {
      return res.status(400).json({
        error: "Please include all fields"
      });
    }

    console.log(fields)

    let product = new Product(fields);

    //handle file here
    if (file.photo) {
      if (file.photo.size > 3000000) {
        return res.status(400).json({
          error: "File size too big!"
        });
      }
      product.photo.data = fs.readFileSync(file.photo.path);
      product.photo.contentType = file.photo.type;
    }
    // console.log(product);

    //save to the DB
    product.save((err, product) => {
      if (err) {
        console.log(err)
        res.status(400).json({
          error: "Saving tshirt in DB failed"
        });
      }
      res.json(product);
    });
  });
};

exports.getProduct = (req, res) => {
  req.product.photo = undefined;
  return res.json(req.product);
};

//middleware
exports.photo = (req, res, next) => {
  if (req.product.photo.data) {
    res.set("Content-Type", req.product.photo.contentType);
    return res.send(req.product.photo.data);
  }
  next();
};

// delete controllers
exports.deleteProduct = (req, res) => {
  let product = req.product;
  product.remove((err, deletedProduct) => {
    if (err) {
      return res.status(400).json({
        error: "Failed to delete the product"
      });
    }
    res.json({
      message: "Deletion was a success",
      deletedProduct
    });
  });
};

// delete controllers
exports.updateProduct = (req, res) => {
  let form = new formidable.IncomingForm();
  form.keepExtensions = true;

  form.parse(req, (err, fields, file) => {
    if (err) {
      return res.status(400).json({
        error: "problem with image"
      });
    }

    //updation code
    let product = req.product;
    product = _.extend(product, fields);

    //handle file here
    if (file.photo) {
      if (file.photo.size > 3000000) {
        return res.status(400).json({
          error: "File size too big!"
        });
      }
      product.photo.data = fs.readFileSync(file.photo.path);
      product.photo.contentType = file.photo.type;
    }
    // console.log(product);

    //JSON.parse(fields.category)
    console.log(fields.category)
    Product.findByIdAndUpdate(req.params.productId,{name:fields.name,price:fields.price,description:fields.description,category:fields.category,stock:fields.stock},{new:true})
    .then(product => {
      console.log(product)
      res.json({
        message:"Product updated successfully",
        product
      });
    }
    )
    .catch(err => {
      console.log(err)
      res.status(400).json({
        message: "Failed to update the product"
      })
    })
  });
};

//product listing

exports.getAllProducts = (req, res) => {
  let limit = req.query.limit ? parseInt(req.query.limit) : 8;
  let sortBy = req.query.sortBy ? req.query.sortBy : "_id";

  Product.find()
    //.select("-photo")
    .populate("category")
    .sort([[sortBy, "asc"]])
    //.limit(limit)
    .exec((err, products) => {
      if (err) {
        return res.status(400).json({
          error: "NO product FOUND"
        });
      }
      res.json(products);
    });
};

exports.getAllUniqueCategories = (req, res) => {
  Product.distinct("category", {}, (err, category) => {
    if (err) {
      return res.status(400).json({
        error: "NO category found"
      });
    }
    res.json(category);
  });
};

exports.updateStock = (req, res, next) => {
  let myOperations = req.body.order.products.map(prod => {
    return {
      updateOne: {
        filter: { _id: prod._id },
        update: { $inc: { stock: -prod.count, sold: +prod.count } }
      }
    };
  });

  Product.bulkWrite(myOperations, {}, (err, products) => {
    if (err) {
      return res.status(400).json({
        error: "Bulk operation failed"
      });
    }
    next();
  });
};

exports.searchProduct = (req, res) => {
  let searchText = req.query.searchText;

  req.query.filter = JSON.parse(req.query.filter);
  let { minPrice, maxPrice, category, sort } = req.query.filter;

  switch (sort) {
    case "Price: High to Low":
      sort = { price: 1 };
      break;
    case "Price: Low to High":
      sort = { price: -1 };
      break;
    default:
      sort = null;
      break;
    }

  Product.find({ $text: { $search: searchText } , price: { $gte: minPrice, $lte: maxPrice }})
    .populate("category")
    .sort(sort)
    .exec((err, products) => {
      if (err) {
        console.log(err);
        return res.status(400).json({
          error: "No product found"
        });
      }
      res.json(products);
    }
    )
}

exports.filterProducts = (req, res) => {
  req.query.filter = JSON.parse(req.query.filter);
  let { minPrice, maxPrice, category, sort } = req.query.filter;

  switch (sort) {
    case "Price: High to Low":
      sort = { price: 1 };
      break;
    case "Price: Low to High":
      sort = { price: -1 };
      break;
    case "Newest item":
      sort = { createdAt: -1 };
      break;
    default:
      sort = null;
      break;
    }

  category = category.filter(cat => cat.checked);

  if (category.length > 0) {
    console.log(category);
    Product.find({ price: { $gte: minPrice, $lte: maxPrice }, category: category })
      .populate("category")
      .exec((err, products) => {
        if (err) {
          console.log(err);
          return res.status(400).json({
            error: "NO product FOUND"
          });
        }
        return res.json(products);
      }
      );
  }
  else {

    Product.find({ price: { $gte: minPrice, $lte: maxPrice } })
      .populate("category")
      .sort(sort)
      .exec((err, products) => {
        if (err) {
          return res.status(400).json({
            error: "NO product FOUND"
          });
        }
        return res.json(products);
      }
      );
  }

}