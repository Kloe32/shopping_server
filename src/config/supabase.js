import { createClient } from "@supabase/supabase-js";
import config from "./config.js";
import multer from "multer";

const supabaseClient = createClient(
  config.PROJECT_URL,
  config.SUPABASE_SERVICE_ROLE,
);
const upload = multer({ storage: multer.memoryStorage() });

const uploadFile = async (file, bucket = "image-storage") => {
  try {
    const fileName = `${Date.now()}-${file.originalname}`;
    const fileStorage = supabaseClient.storage.from(bucket);
    const { data, error } = await fileStorage.upload(fileName, file.buffer, {
      contentType: file.mimetype,
      upsert: true,
    });
    if (error) {
      console.log("Failed to upload image to supabase:", error);
      throw error;
    }

    const { data: publicUrl } = fileStorage.getPublicUrl(fileName);

    return publicUrl.publicUrl;
  } catch (error) {
    console.log("File Upload Error:::", error);
    throw error;
  }
};

const deleteFile = async (fileUrl, bucket = "image-storage") => {
  try {
    const fileNameOnly = fileUrl.split("/").pop();
    const fileStorage = supabaseClient.storage.from(bucket);
    const { data, error } = await fileStorage.remove([fileNameOnly]);
    if (error) {
      console.log("Failed to delete image from supabase:", error);
      throw error;
    }
    return data;
  } catch (error) {
    console.log("File Delete Error:::", error);
    throw error;
  }
};

export { upload, uploadFile, deleteFile };
