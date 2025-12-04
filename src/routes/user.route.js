const express = require('express')
const router = express.Router()
const {registerUser,loginUser,updateUser,deleteUser, getAllUsers, verifyEmail,getAllAdmin} =require('../controllers/user.controller')
const { verifyToken } = require('../middleware/authJWT')
const { upload } = require('../config/supabase')


router.get('/',getAllUsers)
router.get('/admin',getAllAdmin)
router.post('/CreateUser',registerUser)
router.post('/LoginUser',loginUser)
router.put('/UpdateUser/:id',upload.single("file"),updateUser)  
router.delete('/DeleteUser/:id',deleteUser)
router.get('/verify-email/:token',verifyEmail)
module.exports =router
