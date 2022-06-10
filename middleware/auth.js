const jwt = require('jsonwebtoken');
const register = require('../Models/Register');

const auth = async (req,res,next) =>{
    try{
        const token = req.cookies.jwt;
        const verifyUser = jwt.verify(token,process.env.JWT_SECRET);
        const user = await register.findOne({_id:verifyUser._id, 'tokens.token':token});
        if(!user)
            throw new Error();
        req.token = token;
        req.user = user;
        next();
    }catch(err){
        req.session.message = {
            color: 'c23934',
            intro: 'You are not verified.',
            message: 'Please try to login.',
        }
        res.redirect('/');
    }
}

module.exports = auth;