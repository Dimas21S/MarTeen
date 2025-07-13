const express = require('express')
const bcrypt = require('bcryptjs');
const session = require('express-session');
const fileUpload = require('express-fileupload');
const path = require('path');
const bodyParser = require('body-parser');
const connection = require('./db');

const HOST = process.env.HOST || "http://localhost";
const PORT = 5000;
const app = express();

app.use("/assets", express.static(path.join(__dirname, "public/assets")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(fileUpload());
app.use(session({
    secret: "secret_key",
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 6000
    },
}));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));