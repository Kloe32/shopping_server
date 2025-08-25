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
        enum:["admin","user","salesperson"],
        required: true,
        default:"user"
    }

},{
    timestamps:true
})

module.exports = mongoose.model('user',userModelSchema)