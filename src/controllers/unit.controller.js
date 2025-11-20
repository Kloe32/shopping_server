const unitModel = require('../models/unit.model')
const config = require("../config/config")
const {getCache, setCache, clearCache} =require("../config/redisClient")

const createUnit = async (req,res) =>{
    try {
        const unit =await unitModel.create(req.body)
        clearCache(config.REDIS_UNIT_KEY)
        res.status(200).json({message:"Unit Added Successfully",success:true,data:unit})
    } catch (error) {
        console.log(error)
        res.status(500).json({message:'Internal Server Error'})
    }
}

const getAllUnit = async (req,res)=>{
    try {

        const cachedData = await getCache(config.REDIS_UNIT_KEY)
        if(cachedData){
            const jsonData = JSON.parse(cachedData)
            return res.status(200).json({
                success:true,
                message:`Total ${jsonData.length} units fetched!`,
                data:jsonData 
            })
        }
        const unit = await unitModel.find()
        await setCache(config.REDIS_UNIT_KEY,unit)
        return res.status(200).json({data:unit, message:"Unit Fetched Successfully", success:true})
    } catch (error) {
        console.log(error)
        res.status(500).json({message:"Internal Server Error"})
    }
}

const deleteUnit = async (req,res)=>{
    try {
        const id = req.params.id
        const deletedUnit = await unitModel.findByIdAndDelete(id)
        if(!deletedUnit){
            return res.status(403).json({message: "Fail to Delete"})
        }
        clearCache(config.REDIS_UNIT_KEY)
        res.status(200).json({message:"Successfully Deleted",success:true, data:deletedUnit.name})
    } catch (error) {
        console.log(error)
        res.status(500).json({message:"Internal Server Error"})           
    }
}
const updateUnit = async (req,res)=>{
    try {
        const id = req.params.id
        const updatedUnit = await unitModel.findByIdAndUpdate(id,req.body,{new:true})
        if(!updatedUnit){
            res.status(403).json({message: "Fail to Update"})
        }
        clearCache(config.REDIS_UNIT_KEY)
        res.status(200).json({message:"Updated Successfully.",success:true,data:updatedUnit})
    } catch (error) {
        console.log(error)
        res.status(500).json({message:"Internal Server Error"})           
    }
}

module.exports = {
    getAllUnit,
    createUnit,
    deleteUnit,
    updateUnit
}