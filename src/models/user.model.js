const mongoose =require('mongoose')

const userModelSchema = new mongoose.Schema({
    name:{
        type: String,
        required: true,
    },

    email:{
        type: String,
        required: true,    
        unique:true,
        default:''
    },
    password:{
        type: String,
        required: true
    },
    role: {
        type: String,
        enum:["admin","user","manager","superadmin"],
        required: true,
        default:"user"
    },
    allowedRoutes:{
        type:[String],
        required:true,
        unique:false,
    }

},{
    timestamps:true
})

module.exports = mongoose.model('user',userModelSchema)