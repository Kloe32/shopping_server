const express = require('express')
const router = express.Router()
const {createRole,getAllRole,deleteRole} =require('../controllers/role.controller')
const { verifyToken } = require('../middleware/authJWT')

router.get("/",getAllRole)
router.post("/",createRole)
router.delete('/:id',deleteRole)

module.exports = router