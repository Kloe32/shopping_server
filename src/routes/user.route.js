const express = require('express')
const router = express.Router()
const {registerUser,loginUser,updateUser,deleteUser, getAllUsers} =require('../controllers/user.controller')

router.get('/',getAllUsers)
router.post('/CreateUser',registerUser)
router.post('/LoginUser',loginUser)
router.put('/UpdateUser/:id',updateUser)  
router.delete('/DeleteUser/:id',deleteUser)

module.exports =router
