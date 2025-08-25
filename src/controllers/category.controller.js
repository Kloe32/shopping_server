const categoryModel = require('../models/category.model')

const getAllCategory = async (req,res)=>{
    try {
        const categories = await categoryModel.find()
        return res.status(200).json(categories)
    } catch (error) {
        console.log(error)
        res.status(500).json({message:"Internal Server Error"})
    }
}
const getCategorybyName = async (req,res)=>{
    try{
        const name = req.params.name
        const foundCategory = await categoryModel.findOne({name:name})
        if(!foundCategory){
            return res.status(403).json('Category Not Found')
        }
        return res.status(200).json(foundCategory)
    }catch(error){
        console.log(error)
        res.status(500).json({message:"Internal Server Error"})
    }
}

const createCategory = async (req,res)=>{
    try {
        const category = await categoryModel.create(req.body)
        res.status(200).json(category)
    } catch (error) {
        console.log(error)
        res.status(500).json({message:"Internal Server Error"})        
    }
}

const deleteCategory = async (req,res)=>{
    try {
        const id = req.params.id
        const deletedCategory = await categoryModel.findByIdAndDelete(id)
        if(!deleteCategory){
            res.status(403).json({message: "Fail to Delete"})
        }
        res.status(200).json({message:"Successfully Deleted"})
    } catch (error) {
        console.log(error)
        res.status(500).json({message:"Internal Server Error"})           
    }
}
const updateCategory = async (req,res)=>{
    try {
        const id = req.params.id
        const updatedCategory = await categoryModel.findByIdAndUpdate(id,req.body,{new:true})
        if(!updatedCategory){
            res.status(403).json({message: "Fail to Update"})
        }
        res.status(200).json({updatedCategory})
    } catch (error) {
        console.log(error)
        res.status(500).json({message:"Internal Server Error"})           
    }
}


module.exports = {
    getAllCategory,
    createCategory,
    deleteCategory,
    updateCategory,
    getCategorybyName  
}