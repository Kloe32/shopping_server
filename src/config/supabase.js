const {createClient} = require("@supabase/supabase-js")
const config = require("./config.js")
const multer = require("multer")

const supabaseClient = createClient(config.PROJECT_URL,config.SUPABASE_SERVICE_ROLE)
const upload = multer({storage:multer.memoryStorage()})

const uploadFile = async (file,bucket = "user-profile") => {
    try {
        const fileName = `${Date.now()}-${file.originalname}`
        const fileStorage = supabaseClient.storage.from(bucket)
        const {data, error} = await fileStorage.upload(fileName,file.buffer,{
            contentType : file.mimetype,
            upsert:true            
        })
        if(error){
            console.log("Failed to upload image to supabase:", error)
            throw error
        }

        const {data: publicUrl} = fileStorage.getPublicUrl(fileName)
        console.log(publicUrl)
        return publicUrl.publicUrl

    } catch (error) {
        console.log("File Upload Error:::",error)
        throw error
    }
}

module.exports = {
    upload, uploadFile
}