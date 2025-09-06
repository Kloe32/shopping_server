const express = require('express')
const { getAllUnit, createUnit, deleteUnit, updateUnit } = require('../controllers/unit.controller')
const { verifyToken } = require('../middleware/authJWT')
const router = express.Router()

router.get('/',getAllUnit)
router.post('/',verifyToken,createUnit)
router.delete('/:id',verifyToken,deleteUnit)
router.put('/:id',verifyToken,updateUnit)

module.exports = router
