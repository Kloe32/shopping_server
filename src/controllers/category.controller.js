import { uploadFile, deleteFile } from "../config/supabase.js";
import categoryModel from "../models/category.model.js";
import config from "../config/config.js";
const getCategory = async (req, res) => {
  try {
    const categories = await categoryModel.find();
    return res.status(200).json({
      message: "Category Fetched Successfully",
      success: true,
      data: categories,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const getCategorybyName = async (req, res) => {
  try {
    const name = req.params.name;
    const foundCategory = await categoryModel.findOne({ name: name });
    if (!foundCategory) {
      return res.status(403).json("Category Not Found");
    }
    return res.status(200).json(foundCategory);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const createCategory = async (req, res) => {
  let imageUrl = "";
  try {
    const duplicateCategory = await categoryModel.findOne({
      name: req.body.name,
    });

    if (duplicateCategory) {
      return res.status(403).json({ message: "Category Name Already Exists" });
    }
    if (req.file) {
      imageUrl = await uploadFile(req.file, config.PRODUCT_IMAGE_BUCKET);
    }
    const slug = req.body.name.toLowerCase().replace(/\s+/g, "-");
    const category = await categoryModel.create({
      ...req.body,
      slug,
      image: imageUrl,
    });
    if (!category) {
      return res.status(403).json({ message: "Fail to Create Category" });
    }
    res.status(200).json({
      data: category,
      message: `Category Successfully Created`,
      success: true,
    });
  } catch (error) {
    await deleteFile(imageUrl, config.PRODUCT_IMAGE_BUCKET);
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const deleteCategory = async (req, res) => {
  try {
    const id = req.params.id;

    const hasChildern = await categoryModel.exists({ parentCategory: id });
    if (hasChildern) {
      return res.status(403).json({
        message:
          "Cannot delete category with subcategories. Please delete subcategories first.",
        success: false,
      });
    }
    const deletedCategory = await categoryModel.findByIdAndDelete(id);
    if (!deletedCategory) {
      res.status(403).json({ message: "Fail to Delete" });
    }
    const imageUrl = deletedCategory.image;
    if (imageUrl) {
      try {
        await deleteFile(imageUrl, config.PRODUCT_IMAGE_BUCKET);
      } catch (error) {
        return console.log(
          "Error deleting category image from storage after category deletion: ",
          error,
        );
      }
    }
    res.status(200).json({
      message: `${deletedCategory.name} has been deleted!`,
      data: deletedCategory,
      success: true,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
const updateCategory = async (req, res) => {
  let imageUrl = "";
  try {
    const id = req.params.id;
    if (req.file) {
      imageUrl = await uploadFile(req.file, config.PRODUCT_IMAGE_BUCKET);
      req.body.image = imageUrl;
    }

    const updatedCategory = await categoryModel.findByIdAndUpdate(
      id,
      req.body,
      { new: true },
    );
    if (!updatedCategory) {
      res.status(403).json({
        message: "Fail to Update",
        data: updateCategory,
        success: false,
      });
    }
    res.status(200).json({
      message: "Successfully Updated!",
      data: updateCategory,
      success: true,
    });
  } catch (error) {
    try {
      imageUrl && (await deleteFile(imageUrl, config.PRODUCT_IMAGE_BUCKET));
    } catch (error) {
      throw new Error(
        "Error deleting uploaded image after update failure: " + error,
      );
    }
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export {
  getCategory,
  createCategory,
  deleteCategory,
  updateCategory,
  getCategorybyName,
};
