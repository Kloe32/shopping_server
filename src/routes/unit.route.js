const express = require('express')
const { getAllUnit, createUnit, deleteUnit, updateUnit } = require('../controllers/unit.controller')
const router = express.Router()

router.get('/',getAllUnit)
router.post('/',createUnit)
router.delete('/:id',deleteUnit)
router.put('/:id',updateUnit)

module.exports = router
