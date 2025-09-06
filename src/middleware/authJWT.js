const jwt = require('jsonwebtoken')
const config = require('../config/config')

const verifyToken= (req,res,next)=>{
    const token = req.headers['x-access-token']
    if(!token) {
        return res.status(403).send({message:'Token not provided!'})
    }
    
    jwt.verify(token,config.SECRET_KEY,async (err, decoded)=>{
        if(err){
            console.log(err)
            return res.status(401).send({message:"Unauthorized",success:false})
        }
        req.name = decoded.name
        req.email = decoded.email
        req.role = decoded.role
        if(req.role !=='superadmin'){
            return res.status(401).send({message:"You are not authorized user!",success:false})
        }
        next()
    })
}

module.exports = {
    verifyToken
}