const connection = require("../db");

const getPesanan = async (req, res) => {
    const user = req.session.user || { name: 'Guest' };
    const userId = req.session.IdUser;

    const query = `SELECT 
          k.*, 
          kantin.nama_kantin, 
          m.harga, 
          m.nama_menu,
          m.id
        FROM 
          keranjang k 
        JOIN 
          menu m ON k.item_id = m.id 
        JOIN 
          kantin ON m.kantin_id = kantin.id 
        WHERE 
          k.user_id = ?
      `;

    const [pesanan] = await connection.execute(query, [user.id]);

    const totalHarga = pesanan.reduce((sum, item) => sum + item.harga * item.quantity, 0);

    const queryTransaksi = `SELECT metode_pembayaran FROM transaksi WHERE user_id = ?`;
    const [transaksi] = await connection.execute(queryTransaksi, [user.id]);

    res.render("pesanan", {
        user,
        currentUrl: "/pesanan",
        pesanan,
        totalHarga,
        transaksi,
        userId
    })
}

const postPesanan = async (req, res) => {
    const { IdUser: bodyUserId, totalHarga, metodePembayaran } = req.body;

    const userId = bodyUserId || req.session.user?.id;

    if (!userId) {
        return res.status(400).json({ error: "Data user tidak valid" });
    }
    if (!totalHarga || isNaN(totalHarga) || totalHarga <= 0) {
        return res.status(400).json({ error: "Total harga tidak valid" });
    }
    if (!metodePembayaran || !["CASH", "CARD", "VOUCHER"].includes(metodePembayaran)) {
        return res.status(400).json({ error: "Metode pembayaran tidak valid" });
    }

    const query = `SELECT k.*, m.harga, m.nama_menu AS menu, kantin.nama_kantin AS Kantin 
                 FROM keranjang k 
                 JOIN kantin ON k.item_id = kantin.id 
                 JOIN menu m ON m.kantin_id = kantin.id 
                 WHERE k.user_id = ?`;

    const [pesanan] = await connection.execute(query, [userId]);

    if (pesanan.length === 0) {
        return res.status(404).json({ error: "Keranjang kosong" });
    }

    const queryResult = `INSERT INTO transaksi (user_id, total_harga, metode_pembayaran, tanggal) VALUES (?, ?, ?, NOW())`;
    const [result] = await connection.execute(queryResult, [userId, totalHarga, metodePembayaran]);
    const transaksiId = result.insertId;

    for (const item of pesanan) {
        await connection.promise().execute(
            "INSERT INTO detail_transaksi (transaksi_id, item_id, quantity, harga) VALUES (?, ?, ?, ?)",
            [transaksiId, item.item_id, item.quantity, item.harga]
        );
    }

    await connection.execute("DELETE FROM keranjang WHERE user_id = ?", [userId]);

    res.status(201).json({ message: "Pesanan berhasil dibuat", transaksiId, totalHarga });

}

const deletePesanan = async (req, res) => {
    const { IdUser: bodyUserId } = req.body;
    const userId = bodyUserId || req.session.user?.id;

    if (!userId) {
        return res.status(400).json({ error: "Data user tidak valid" });
    }

    const query = "SELECT COUNT(*) AS count FROM keranjang WHERE user_id = ?";
    const [rows] = await connection.execute(query, [userId]);

    if (rows[0].count === 0) {
        return res.status(400).json({ error: "Keranjang sudah kosong" });
    }
}

module.exports = {
    getPesanan,
    postPesanan,
    deletePesanan
}