const mongoose =require('mongoose')
const {encryption} = require("../helper/encryptDecrypt")
const userModelSchema = new mongoose.Schema({
    imageUrl:{
        type:String,
        required:false
    },
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
        type:mongoose.Schema.Types.ObjectId,
        ref:'role',
        required:true 
    },
    allowedRoutes:{
        type:[String],
        required:true,
        unique:false,
    },
    emailVerificationToken: {
      type: String,
    },
    emailVerificationExpiry: {
      type: Date,
    },
    isEmailVerified:{
        type:Boolean,
        default:false
    }

},{
    timestamps:true
})

//pre hook for encryption
userModelSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  this.password = encryption(this.password);
  next();
});


module.exports = mongoose.model('user',userModelSchema)