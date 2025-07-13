const express = require('express');
const router = express.Router();
const pesananController = require('../controllers/PesananController');

router.get("/pesanan", pesananController.getPesanan);
router.post("/pesanan", pesananController.postPesanan);
router.delete("/pesanan", pesananController.deletePesanan);

module.exports = router;