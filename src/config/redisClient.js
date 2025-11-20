const {createClient} = require('redis')
const config = require('./config')

let client;

const connectRedis= async ()=>{
    try {
         client = createClient({
            username: config.REDIS_USERNAME,
            password: config.REDIS_PASSWORD,
            socket: {
                host: config.REDIS_HOST,
                port: config.REDIS_PORT
            }            
        });
    if(!client) return console.log("No Client Created")
    
    await client.connect();
    client.on('error', err => console.log('Redis Client Error', err));
    client.on('success', () => console.log('Redis Client Success'));

        
    } catch (error) {
        console.log("Redis Client Creation Error:", error)
    }
}

const setCache = async (key,data)=>{
    try {
        client.set(key,JSON.stringify(data),"EX",config.REDIS_TTL)
    } catch (error) {
        console.log("set cache error",error)
    }
}

const getCache = async (key)=>{
    try {
       const cachedData = await client.get(key)
        return cachedData
    } catch (error) {
        console.log("Get cache Data Error",error)
    }
}

const clearCache = async (key)=>{
    try {
        await client.del(key)
    } catch (error) {
        console.log("clear cache error",error)
    }
}

module.exports = {connectRedis,setCache,getCache,clearCache}
