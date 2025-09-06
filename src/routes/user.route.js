const express = require('express')
const router = express.Router()
const {registerUser,loginUser,updateUser,deleteUser, getAllUsers} =require('../controllers/user.controller')
const { verifyToken } = require('../middleware/authJWT')


router.get('/',verifyToken,getAllUsers)
router.post('/CreateUser',registerUser)
router.post('/LoginUser',loginUser)
router.put('/UpdateUser/:id',verifyToken,updateUser)  
router.delete('/DeleteUser/:id',verifyToken,deleteUser)

module.exports =router
