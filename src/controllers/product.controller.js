import config from "../config/config.js";
import { uploadFile } from "../config/supabase.js";
import productModel from "../models/product.model.js";

const getAllProducts = async (req, res) => {
  try {
    const products = await productModel.find({}).populate(["unit", "category"]);
    res.status(200).json(products);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const createProduct = async (req, res) => {
  const imageUrls = [];
  try {
    try {
      for (const file of req.files || []) {
        imageUrls.push(await uploadFile(file, config.PRODUCT_IMAGE_BUCKET));
      }
    } catch (uploadError) {
      console.log(uploadError);
      return res
        .status(500)
        .json({ message: "Failed to upload product images" });
    }
    const slug = req.body.name.toLowerCase().replace(/\s+/g, "-");
    const payload = {
      ...req.body,
      slug,
      images: imageUrls,
      price: Number(req.body.price),
    };
    const response = await productModel.create(payload);

    res.status(200).json({ message: "Successfully Created!", data: response });
  } catch (error) {
    try {
      for (const imageUrl of imageUrls) {
        await deleteFile(imageUrl, config.PRODUCT_IMAGE_BUCKET);
      }
    } catch (error) {
      console.log(
        "errorl deleting images after product creation failure: ",
        error,
      );
    }
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const id = req.params.id;
    const deletedProduct = await productModel.findByIdAndDelete(id);
    if (!deleteProduct) {
      res.status(403).json({ message: "Fail to Delete" });
    }
    res.status(200).json({ message: "Successfully Deleted" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
const updateProduct = async (req, res) => {
  try {
    const id = req.params.id;
    const updatedProduct = await productModel.findByIdAndUpdate(id, req.body, {
      new: true,
    });
    if (!updatedProduct) {
      res.status(403).json({ message: "Fail to Update" });
    }
    res.status(200).json({ updatedProduct });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export { deleteProduct, getAllProducts, createProduct, updateProduct };
