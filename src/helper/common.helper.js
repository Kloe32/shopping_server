const jwt = require ("jsonwebtoken")
const config = require('../config/config')


const createToken = (payload,expireTime ='1d')=>{
    return jwt.sign(payload,config.SECRET_KEY,{
        expiresIn:expireTime,
    });
};

module.exports = {
    createToken
}