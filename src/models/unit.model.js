const mongoose = require('mongoose')

const unitModelSchema = mongoose.Schema({
    name:{
        type: String,
        required: true,
        unique: true
    },
    multiplier:{
        type:Number,
        required: true,
        default: 1
    }
})

module.exports = mongoose.model('unit',unitModelSchema)