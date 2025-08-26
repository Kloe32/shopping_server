const express = require('express')
const app =express()
const mongoose =require('mongoose')
const config = require('./src/config/config')
const port = config.PORT
const cors = require('cors')
const mongodb_url = config.MONGODB_URL
const userRoute = require('./src/routes/user.route')
const categoryRoute = require('./src/routes/category.route')
const unitRoute = require('./src/routes/unit.route')
const productRoute = require('./src/routes/product.route')

app.use(express.json())
app.listen(port, ()=>{
    console.log(`Server is listening at http://localhost:${port}`)
})
app.get('/',
    (req,res)=>{
        res.send("API Start working")
    }
)  
app.use("/api/v1/user",userRoute) 
app.use("/api/v1/category",categoryRoute)
app.use("/api/v1/unit",unitRoute)
app.use("/api/v1/product",productRoute)

mongoose.connect(mongodb_url).then(()=>console.log("Mongo DB is connected")).catch((error)=>console.log('error connecting db:',error))