require('dotenv').config();

const express = require('express');
const router = express.Router();
const cookieParser = require('cookie-parser');
const User = require('./Models/Register');
const otpGenerator = require('otp-generator');
const otp = function(){return otpGenerator.generate(6, { upperCaseAlphabets: false, specialChars: false, lowerCaseAlphabets: false, digits: true })};
const sendOtp = require('./Email/Mailjet');
const connectDB=require('./DB/mongoose');
const session = require('express-session');
const auth = require('./middleware/auth');
const AWS = require('aws-sdk');
const { response } = require('express');
const bucket = process.env.BUCKET;
let OTPgen;
const S3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
});
const client = new AWS.Rekognition({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
});


//? Connecting to DB
connectDB();    

router.use(express.static(__dirname + '/Frontend/public/')); 
router.use(cookieParser());

router.use(session({
    secret: 'admission',
    cookie: {expires: 480000},
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

//?Get Register page
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

//?Login Verification
router.post('/login', async (req,res) => {
    try{
        const user = await User.findByCredentials(req.body.email,req.body.password);
        const token = await user.generateAuthToken();
        res.cookie("jwt",token,{
            httpOnly: true,
            expires: new Date(Date.now()+240000),
        });
        OTPgen = otp()
        sendOtp(user.email,user.Firstname,user.Lastname,OTPgen);
        req.session.isVerified = false;
        req.session.userId=user._id;
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

//?Get FaceAuth
router.get('/faceregister',auth, (req, res) => {
    res.render('FaceRecog');
})

//?Registering face to S3 Buckets
router.post('/faceauth',auth,async (req,res) => {
    const imageUrl = req.body.imageUrl;
    const _id=req.session.userId;
    const BufImg = new Buffer.from(imageUrl.replace(/^data:image\/\w+;base64,/, ""), 'base64');
    try{
        const data = {
            Bucket: bucket,
            Key: _id,
            Body: BufImg,
            ContentEncoding: 'base64',
            ContentType: 'image/jpeg'
        }       
        S3.putObject(data, (err, data) => {
            if(err){
                console.log(err);
            }else{
                console.log("saved photo to s3 bucket");
            }
        });
        const params={
            Image: {
                S3Object: {
                  Bucket: bucket,
                  Name: _id
                },
              },
              Attributes: ['ALL']
        }
        setTimeout(() => {
            client.detectFaces(params, function(err, data) {
                if(err){
                    console.log(err);
                }
                else if(data.FaceDetails.length>0){
                        req.session.message = {
                            color: '2e844a',
                            isRegistered: true,
                            intro: 'Registered Successfully.',
                            message: 'Redirecting to login page',
                        }
                        res.redirect('/faceregister');
                }else{
                    const paramsForS3 = {  Bucket: bucket, Key: _id };
                    S3.deleteObject(paramsForS3, function(err, data) {
                        if (err) 
                            console.log(err, err.stack); 
                        else{
                            req.session.message = {
                                color: 'c23934',
                                isRegistered: false,
                                intro: 'Face not found.',
                                message: 'Please try again.',
                            }
                            res.redirect('/faceregister');
                        }             
                    });
                }
            })
        }, 500);
    }catch(err){}
})

//?Get OTP verification page
router.get('/verify',auth,async (req,res) =>{
    res.render('verification');
});

//? verifing OTP
router.post('/verifyotp',auth,async (req,res) => {
    if(req.body.otp === OTPgen){
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

//?Resend OTP
router.post('/resendotp',auth,(req, res) => {
    OTPgen = otp();
    sendOtp(req.user.email,req.user.Firstname,req.user.Lastname,OTPgen);
    req.session.message = {
        color: '2e844a',
        intro: 'OTP Sended',
        message: '',
    }
    res.redirect('/verify');
})

//? Get Face Verification Page
router.get('/verifyface',auth,(req,res) => {
    res.render('faceVerify');
})

//? Verify face
router.post('/verifyface',auth,async (req,res) => {
    const imageUrl = req.body.imageUrl;
    const BufImg = new Buffer.from(imageUrl.replace(/^data:image\/\w+;base64,/, ""), 'base64');
    const _id = req.user._id.toString();
    try{
        const _key = "verify-"+_id;
        const data = {
            Bucket: bucket,
            Key: _key,
            Body: BufImg,
            ContentEncoding: 'base64',
            ContentType: 'image/jpeg'
        }    
        S3.putObject(data, (err, data) => {
            if(err){
                console.log("error occur to upload image");
            }else{
                console.log("saved to bucket");
            }
        });
        const paramsForDetectFace={
            Image: {
                S3Object: {
                  Bucket: bucket,
                  Name: _key
                },
              },
              Attributes: ['ALL']
        }
        setTimeout(() => {
            client.detectFaces(paramsForDetectFace, function(err, data) {
                if(err){
                    console.log("hello from face detect")
                    console.log(err);
                }
                else if(data.FaceDetails.length>0){
                    const params = {
                        SourceImage: {
                            S3Object: {
                                Bucket: bucket,
                                Name: _id,
                            },
                        },
                        TargetImage: {
                            S3Object: {
                                Bucket: bucket,
                                Name: _key,
                            },
                        },
                    }
                    client.compareFaces(params, function(err, response) {
                        if (err) {
                            console.log("hello from compare face");
                            console.log(err);
                        } else if(response.FaceMatches.length === 0){
                            req.session.message = {
                                color: 'c23934',
                                intro: 'Face not verified.',
                                message: 'Please try again.',
                            }
                            req.session.isVerified = false;
                            res.redirect('/verifyface');      
                        }else{
                            response.FaceMatches.forEach(data => {
                                const similarity = data.Similarity;
                                if(similarity>90){
                                    const params = {  Bucket: bucket, Key: _key };
                                    S3.deleteObject(params, function(err, data) {
                                        if (err) 
                                            console.log(err, err.stack); 
                                        else{
                                            req.session.isVerified = true;
                                            res.redirect('/dashboard');
                                        }             
                                    });
                                }
                            })
                        } 
                    });
                }else{
                    const paramsForS3 = {  Bucket: bucket, Key: _key };
                    S3.deleteObject(paramsForS3, function(err, data) {
                        if (err) 
                            console.log(err, err.stack); 
                        else{
                            req.session.message = {
                                color: 'c23934',
                                intro: 'Face not found.',
                                message: 'Please try again.',
                            }
                            res.redirect('/verifyface');
                        }             
                    });
                }
            })
        }, 500);
    }catch(err){
        console.log(err);
    }
})


//? Get Dashboard
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