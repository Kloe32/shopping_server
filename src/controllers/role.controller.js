const roleModel = require('../models/role.model')

const createRole = async (req,res) =>{
    try {
        const role = await roleModel.create(req.body)
        res.status(200).json({success:true, message:`${req.body.name} Role Successfully Added.`, data:role})
    } catch (error) {
        console.log("createRole() Error:",error )
        res.status(500).json({message:"Internal Server Error"})
    }
}

const deleteRole =async (req,res) =>{
    try {
        const id = req.params.id
        const deletedRole = await roleModel.findByIdAndDelete(id)
        if(deleteRole){
            res.status(200).json({success:true,message:`${deletedRole.name} Role Successfully Deleted`,data:deletedRole})
        }
    } catch (error) {
        console.log("deleteRole() Error:",error )
        res.status(500).json({message:"Internal Server Error"})        
    }
}

const getAllRole = async (req,res)=>{
    try {
        const roles = await roleModel.find()
        return res.status(200).json({message:"Role Fetched Successfully",success:true,data:roles})
    } catch (error) {
        console.log("getAllRole() Error: ",error)
        res.status(500).json({message:"Internal Server Error"})
    }
}

module.exports = {
    createRole,
    getAllRole,
    deleteRole
}