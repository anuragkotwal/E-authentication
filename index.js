require('dotenv').config();

const express = require('express');
const router = express.Router();
const cookieParser = require('cookie-parser');
const User = require('./Models/Register');
const otpGenerator = require('otp-generator');
let otp = otpGenerator.generate(6, { upperCaseAlphabets: false, specialChars: false, lowerCaseAlphabets: false, digits: true });
const sendOtp = require('./Email/Mailjet');
const connectDB=require('./DB/mongoose');
const session = require('express-session');
const deepai = require('deepai');
const auth = require('./middleware/auth');

connectDB();

router.use(express.static(__dirname + '/Frontend/public/')); 
router.use(cookieParser());

router.use(session({
    secret: 'admission',
    cookie: {expires: 240000},
    resave: false,
    saveUninitialized: false,
}));
router.use((req, res, next) => {
    res.locals.message = req.session.message
    delete req.session.message
    next();
})

//?Get login page
router.get('/', (req, res) => {
    res.render('loginPage');
})


//?Get register page
router.get('/registerpage', (req, res) => {
    res.render('RegisterPage');
})

//?Register User
router.post('/register',async (req,res) => {
    const user = new User({
        Firstname: req.body.fname,  
        Lastname: req.body.lname,
        email: req.body.email,
        password: req.body.password,
    });
    try{
        if(user.password.toLowerCase().includes(user.Firstname.toLowerCase()) || user.password.toLowerCase().includes(user.Lastname.toLowerCase())){
            req.session.message = {
                color: 'c23934',
                intro: 'Password cannot contain firstname or lastname',
                message: 'Please try again.',
            }
            res.redirect('/registerpage')
        }else{
            await user.save();
            const token = await user.generateAuthToken();
            req.session.userId=user._id;
            res.cookie("jwt",token,{
                expires: new Date(Date.now() + 240000),
                httpOnly: true,
            });
            res.redirect('/faceregister')
        }
    }catch(err){
        // console.log(err);
        if(err){
            if(err.keyPattern){
                req.session.message = {
                    color: 'c23934',
                    intro: 'Email already registered!!',
                    message: 'Please try again.',
                } 
                res.redirect('/registerpage');
            }else if(err.errors){
                req.session.message = {
                    color: 'c23934',
                    intro: err.errors.password.properties.message,
                    message: 'Please try again.',
                } 
                res.redirect('/registerpage');
            }
        }
    }
})

//?Login router
router.post('/login', async (req,res) => {
    try{
        const user = await User.findByCredentials(req.body.email,req.body.password);
        const token = await user.generateAuthToken();
        res.cookie("jwt",token,{
            httpOnly: true,
            expires: new Date(Date.now()+240000),
        });
        sendOtp(user.email,user.Firstname,user.Lastname,otp);
        req.session.isVerified = false;
        res.redirect('/verify');
    }catch(err){
        console.log(err.message);
        req.session.message = {
            color: 'c23934',
            intro: err.message,
            message: 'Please try again.',
        } 
        res.redirect('/');
        res.status(400);
    }
});

//?logout
router.post('/logout', auth, async (req,res) => {
    try{
        req.user.tokens = req.user.tokens.filter((token) => {
            return token.token !== req.token;
        });
        await req.user.save();
        res.redirect('/');
    }catch(err){
        res.status(500).send();
    }
})

//? FaceAuth
router.get('/faceregister',auth, (req, res) => {
    res.render('FaceRecog');
})

router.post('/faceauth',auth,async (req,res) => {
    const imageUrl = req.body.imageUrl;
    const _id=req.session.userId;
    try{
        const CurrUser = await User.findById(_id);
        CurrUser.imageURL = imageUrl;
        await CurrUser.save();
        req.session.message = {
            color: '2e844a',
            isRegistered: true,
            intro: 'Registered Successfully.',
            message: 'Redirecting to login page',
        }
        res.redirect('/faceregister');
    }catch(err){}
})

router.get('/verify',auth,async (req,res) =>{
    res.render('verification');
});

router.post('/verifyotp',auth,async (req,res) => {
    if(req.body.otp === otp){
        req.session.isVerified = false;
        res.redirect('/verifyface');
    }
    else {
            req.session.message = {
            color: 'c23934',
            intro: 'OTP Invaild',
            message: '',
        }
        res.redirect('/verify');
    }
})

router.get('/verifyface',auth,(req,res) => {
    res.render('faceVerify');
})

router.post('/verifyface',auth,async (req,res) => {
    const imageUrl = req.body.imageUrl;
    const VerifyImageUrl = req.user.imageURL;
    deepai.setApiKey(process.env.DEEP_AI);
    try{
        const faceVerify = await deepai.callStandardApi("image-similarity", {
            image1: imageUrl,
            image2: VerifyImageUrl,
        });
        const faceScore = faceVerify.output.distance ;
        console.log(parseInt(faceScore));
        if(parseInt(faceScore)>=25){
            req.session.message = {
                color: 'c23934',
                intro: 'Face not verified.',
                message: 'Please try again.',
            }
            req.session.isVerified = false;
            res.redirect('/verifyface');
        }else if(parseInt(faceScore)<25){
            req.session.isVerified = true;
            res.redirect('/dashboard');
        }
    }catch(err){
        console.log(err);
    }
})

router.get('/dashboard',auth,(req,res) => {
    if(req.session.isVerified==true){
        res.render('dashboard');
    }else{
        req.session.message = {
            color: 'c23934',
            intro: 'You are not verified.',
            message: 'Please try to login',
        }
        res.redirect('/');
    }
})

module.exports = router;