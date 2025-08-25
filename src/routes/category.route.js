const express = require('express')
const router = express.Router()
const {getAllCategory, createCategory, deleteCategory, updateCategory, getCategorybyName} = require('../controllers/category.controller')
router.get('/',getAllCategory)
router.post('/',createCategory)
router.delete('/:id',deleteCategory)
router.put('/:id',updateCategory)
router.get('/name',getCategorybyName)

module.exports = router