const mongoose =require('mongoose')
const categoryModel = require('./category.model')
const unitModel = require('./unit.model')
const productModelSchema = new mongoose.Schema({
    name:{
        type: String,
        required: true,
        unique: false
    },
    description:{
        type:String,
        required:false,
        trim:true
    },
    shortDescription:{
        type:String,
        trim:true,
        maxlength:200,
        required:false  
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
    },
    unit:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'Unit',
        required:false,
        default:"68aa8b954e1f4644df9dfd0f"
    },
    category:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'Category',
        required:false
    }

},{
    timestamps:true
})

module.exports = mongoose.model('product',productModelSchema)