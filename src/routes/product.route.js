const express = require('express')
const router = express.Router()
const {getAllProducts, createProduct, deleteProduct, updateProduct} = require('../controllers/product.controller')

router.get('/',getAllProducts)
router.post('/',createProduct)
router.delete('/:id',deleteProduct)
router.put('/:id',updateProduct)

module.exports = router