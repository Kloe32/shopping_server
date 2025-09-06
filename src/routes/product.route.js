const express = require('express')
const router = express.Router()
const {getAllProducts, createProduct, deleteProduct, updateProduct} = require('../controllers/product.controller')
const { verifyToken } = require('../middleware/authJWT')

router.get('/',getAllProducts)
router.post('/',verifyToken, createProduct)
router.delete('/:id',verifyToken, deleteProduct)
router.put('/:id',verifyToken, updateProduct)

module.exports = router