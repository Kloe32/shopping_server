const mongoose = require('mongoose')

const unitModelSchema = mongoose.Schema({
    name:{
        type: String,
        required: true,
        unique: true
    }
})

module.exports = mongoose.model('unit',unitModelSchema)