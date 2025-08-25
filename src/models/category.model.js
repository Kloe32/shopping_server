const mongoose = require('mongoose')

const categoryModelSchema = mongoose.Schema({
    name:{
        type:String,
        unique:true,
        trim:true
    }
})

module.exports = mongoose.model('category',categoryModelSchema)