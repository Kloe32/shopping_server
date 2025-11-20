const mongoose = require('mongoose')

const roleModelSchema = mongoose.Schema({
    name:{
        type:String,
        require: true,
        unique:true
    },
    description:{
        type:String
    },
    allowedRoutes:{
        type:[String],
        require: true
    }
},{
    timestamps:true
})

module.exports = mongoose.model('role',roleModelSchema)