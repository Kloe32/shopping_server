const unitModel = require('../models/unit.model')

const createUnit = async (req,res) =>{
    try {
        const unit =await unitModel.create(req.body)
        res.status(200).json({data:unit})
    } catch (error) {
        console.log(error)
        res.status(500).json({message:'Internal Server Error'})
    }
}

const getAllUnit = async (req,res)=>{
    try {
        const unit = await unitModel.find()
        return res.status(200).json(unit)
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
        res.status(200).json({message:"Successfully Deleted", data:deletedUnit.name})
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
        res.status(200).json({updatedUnit})
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