const express = require('express');
const router = express.Router();
const menuController = require('../Controllers/MenuController');

router.get("/menu", menuController.getMenu);
router.post("/menu", menuController.postMenu);