import config from "../config/config.js";
import { uploadFile, deleteFile } from "../config/supabase.js";
import productModel from "../models/product.model.js";
import { parseStringArray } from "../helper/common.helper.js";
const getAllProducts = async (req, res) => {
  try {
    const products = await productModel
      .find({ isDeleted: false })
      .populate("category");
    res.status(200).json({
      success: true,
      message: `Total ${products.length} products fetched!`,
      data: products,
    });
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
    const deletedProduct = await productModel.findByIdAndUpdate(
      id,
      { status: "INACTIVE", isDeleted: true, deletedAt: new Date() },
      { new: true },
    );
    if (!deletedProduct) {
      res.status(403).json({ message: "Fail to Delete", success: false });
    }
    res.status(200).json({ message: "Successfully Deleted", success: true });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error", success: false });
  }
};

const updateProduct = async (req, res) => {
  let retainedImageUrls = parseStringArray(req.body.retainedImageUrls);
  let removedImageUrls = parseStringArray(req.body.removedImageUrls);
  let imageUrls = [];
  const id = req.params.id;
  try {
    if (removedImageUrls.length > 0) {
      for (const i of removedImageUrls) {
        await deleteFile(i, config.PRODUCT_IMAGE_BUCKET);
      }
    }
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        imageUrls.push(await uploadFile(file, config.PRODUCT_IMAGE_BUCKET));
      }
    }
    imageUrls = [...retainedImageUrls, ...imageUrls];
    req.body.images = imageUrls;

    const updatedProduct = await productModel.findByIdAndUpdate(id, req.body, {
      new: true,
    });
    if (!updatedProduct) {
      res.status(403).json({ message: "Fail to Update" });
    }
    res.status(200).json({ updatedProduct });
  } catch (error) {
    try {
      if (imageUrls.length > 0) {
        for (const imageUrl of imageUrls) {
          await deleteFile(imageUrl, config.PRODUCT_IMAGE_BUCKET);
        }
      }
    } catch (error) {
      console.log(
        "Error deleting uploaded images after update failure: ",
        error,
      );
    }
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const updateProductStatus = async (req, res) => {
  try {
    const id = req.params.id;
    const { status } = req.body;
    if (!["ACTIVE", "INACTIVE", "DRAFT"].includes(status)) {
      return res.status(400).json({
        message:
          "Invalid status value. Must be 'ACTIVE' or 'INACTIVE' or 'DRAFT'.",
        success: false,
      });
    }
    const updatedProduct = await productModel.findByIdAndUpdate(
      id,
      { status },
      { new: true },
    );
    if (!updatedProduct) {
      return res
        .status(403)
        .json({ message: "Fail to Update", success: false });
    }
    res.status(200).json({
      message: "Status Updated Successfully.",
      data: updatedProduct,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error", success: false });
  }
};

export {
  deleteProduct,
  getAllProducts,
  createProduct,
  updateProduct,
  updateProductStatus,
};
