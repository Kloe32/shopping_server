const { createToken } = require('../helper/common.helper')
const { encryption, comparison } = require('../helper/encryptDecrypt')
const userModel =require('../models/user.model')

const registerUser = async (req,res) =>{
    try {
        // const foundUser = await userModel.findOne(req.body.email)
        // if (foundUser){
        //     res.status(401).json({message:"User already Exist!"})
        // }
        const response =await userModel.create(
            {...req.body,
            password: encryption(req.body.password)}
        )
        const {name,email,role} = response
        const token = createToken({name,email,role},'1d')

        res.status(200).json({message: "Registered Successfully", data: response,token: token,success:true})
    } catch (error) {
        res.status(500).json(error)
    }
}
const getAllUsers = async (req, res) => {
    try {
        const users = await userModel.find({});
        res.status(200).json({users});
    } catch (error) {
        res.status(500).json(error);
    }
}

const loginUser = async (req,res) =>{
    try{
        const {email,password} = req.body
        const foundUser = await userModel.findOne({email: email})
        
        if (!foundUser){
            return res.status(404).json({message: "User Do Not Exist."})
        }

        
        if (!comparison(password,foundUser.password)){
            return res.status(403).json({message:"User not Authorized."})
        }
        return res.status(200).json({
            data: foundUser,
            token: createToken({name:foundUser.name, email:foundUser.email, role:foundUser.role}),
            message:"Login Successful!",
            success:true
        })

    }catch(error){
        console.log(error)
        res.status(500).json(error)
    }
}


const updateUser = async (req,res)=>{
    try {
        const updatedUser = await   userModel.findByIdAndUpdate(req.params.id,req.body,{new:true})
        res.status(200).json({message: "Updated", data:updatedUser})  // Fixed: updatedUser instead of updateUser
    } catch (error) {
        console.log(error)
        res.status(500).json({message:'Internal Server Error'})
    }
}

const deleteUser = async (req,res)=>{
    try {
        const id = req.params.id
        console.log(id)
        const deletedUser = await userModel.findByIdAndDelete(id)
        if(!deletedUser) {
            return res.status(400).json({error:"User Deletion failed."})
        }
        return res.status(200).json({message:"user successfully deleted."})
    } catch (error) {
        console.log(error)
        res.status(500).json({message: 'Internal Server Error'})
    }
}

module.exports={
    registerUser,
    loginUser,
    updateUser,
    deleteUser,
    getAllUsers
}