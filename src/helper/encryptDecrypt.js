const crypto = require("crypto")
const {v4: uuidv4} =require('uuid')
const config = require('../config/config')

const encodeBase64 =(data) => Buffer.from(data).toString("base64");
const decodeBase64 = (data) =>Buffer.from(data,"base64").toString("utf8");
const generateRandomString= (length =32 ) =>crypto.randomBytes(length).toString("hex")
const generateRandomNumber =()=>Math.floor(Math.random() * 1_000_000);
const generateUUID =()=>uuidv4();

const deriveKey =(salt)=>
    crypto.pbkdf2Sync(config.SECRET_KEY,salt,100_000,32,"sha512");

const encryption = (plainText)=>{
    const iv=crypto.randomBytes(16);
    const salt = crypto.randomBytes(16);
    const key =deriveKey(salt);
    
    const cipher = crypto.createCipheriv("aes-256-cbc",key,iv);
    let encrypted = cipher.update(plainText,"utf-8","hex") //read the plaintext with utf-8 and encrypt to hex
    encrypted += cipher.final("hex")
    
    return `${salt.toString('hex')}:${iv.toString('hex')}:${encrypted}`
}

const decryption = (encrytpedText) =>{
    const [saltHex,ivHex,encryptedHex] = encrytpedText.split(':')
    const salt = Buffer.from(saltHex,"hex")
    const iv =Buffer.from(ivHex,"hex")
    const key = deriveKey(salt)

    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
    let decrypted = decipher.update(encryptedHex,'hex','utf8')
    decrypted += decipher.final('utf8')

    return decrypted
}


const comparison = (plainPassword,encryptedPassword) =>{
    try {
        // console.log("Plain",plainPassword ,"Encrypted Password",encryptedPassword)
        const decrypted = decryption(encryptedPassword)
        // console.log("decrypted",decrypted)
        return crypto.timingSafeEqual(Buffer.from(plainPassword),Buffer.from(decrypted))
    } catch (_) {
        return false
    }
}

module.exports ={
    encodeBase64,
    decodeBase64,
    generateRandomString,
    generateRandomNumber,
    generateUUID,
    encryption,
    decryption,
    comparison
}