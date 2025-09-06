const express = require('express')
const router = express.Router()
const {getAllCategory, createCategory, deleteCategory, updateCategory, getCategorybyName, updateCategoryByName} = require('../controllers/category.controller')
const { verifyToken } = require('../middleware/authJWT')
router.get('/',getAllCategory)
router.post('/',verifyToken,createCategory)
router.delete('/:id',verifyToken,deleteCategory)
router.put('/:id',verifyToken,updateCategory)
router.get('/name',getCategorybyName)
router.put('/name/:name',verifyToken,updateCategoryByName)

module.exports = router