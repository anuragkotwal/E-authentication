require("dotenv").config();

const express = require('express');
const port = process.env.PORT || 5000;
require('colors');
const app = express();
const path = require('path');
const router = require("./index");

app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.set('view engine', 'ejs');
app.set('views',path.join(__dirname, './Frontend/views'));
app.use(router);


app.listen(port,() =>{
    console.log(`Server is running on port ${port}`.blue.inverse);
})

