const productModel = require('../models/product.model')

const getAllProducts = async (req,res)=>{
    try {
        const products = await productModel.find({})
        res.status(200).json(products)
    } catch (error) {
        console.log(error)
        res.status(500).json({message:"Internal Server Error"})
    }   
}

const createProduct = async (req,res) =>{
    try {
        const response = await productModel.create(req.body)
        res.status(200).json({message:"Successfully Created!", data:response})
    } catch (error) {
        console.log(error)
        res.status(500).json({message:"Internal Server Error"})        
    }
}

const deleteProduct = async (req,res)=>{
    try {
        const id = req.params.id
        const deletedProduct = await productModel.findByIdAndDelete(id)
        if(!deleteProduct){
            res.status(403).json({message: "Fail to Delete"})
        }
        res.status(200).json({message:"Successfully Deleted"})
    } catch (error) {
        console.log(error)
        res.status(500).json({message:"Internal Server Error"})           
    }
}
const updateProduct = async (req,res)=>{
    try {
        const id = req.params.id
        const updatedProduct = await productModel.findByIdAndUpdate(id,req.body,{new:true})
        if(!updatedProduct){
            res.status(403).json({message: "Fail to Update"})
        }
        res.status(200).json({updatedProduct})
    } catch (error) {
        console.log(error)
        res.status(500).json({message:"Internal Server Error"})           
    }
}

module.exports = {
    deleteProduct,
    getAllProducts,
    createProduct,
    updateProduct
}