const mongoose =require('mongoose')
const { useRef } = require('react')
const categoryModel = require('./category.model')

const productModelSchema = new mongoose.Schema({
    name:{
        type: String,
        required: true,
    },
    description:{
        type:String,
        required:false,
        trim:true
    },
    shortDescription:{
        type:String,
        trim:true,
        maxlength:200
    },
    brand:{
        type:String,
        required:true,
        trim:true
    },
    model: {
        type: String,
        required: true,
        trim: true
    },
    variant:{
        type:[Object],
        required:false
    },
    price:{
        type:Number,
        required:true
    }


},{
    timestamps:true
})

module.exports = mongoose.model('product',productModelSchema)