const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Schema = mongoose.Schema;

const UserSchema = new Schema({
    Firstname:{
        type: 'string',
        required: true,
    },
    Lastname:{
        type: 'string',
    },
    email:{
        type: 'string',
        required: true,
        trim: true,
        unique: true,
        lowercase: true,
    },
    password:{
        type: 'string',
        required: true,
        trim: true,
        validate(value){
            if(value.toLowerCase().includes('password'))
                throw new Error('Password cannot contain (password)!!');
        }
    },
    imageURL:{
        type:String,
    },  
    tokens: [{
        token: {
            type: String,
            required: true,
        }
    }]
},{
    timestamps: true,
})

UserSchema.statics.findByCredentials = async (email,password) => {
    const user = await register.findOne({ email: email});
    if(!user) throw new Error('Invaild email!');
    const isMatch = await bcrypt.compare(password, user.password);
    if(!isMatch) throw new Error('Invaild password!');
    return user;
}

UserSchema.methods.generateAuthToken = async function(){
    const user = this;
    const token = jwt.sign({_id: user._id.toString()}, process.env.JWT_SECRET);
    user.tokens = user.tokens.concat({token});
    await user.save();
    return token; 
}

UserSchema.pre('save', async function(next){
    const user = this;
    if(user.isModified('password'))
        user.password = await bcrypt.hash(user.password,8);
    next();
})

const register = mongoose.model('Register', UserSchema);

module.exports = register;