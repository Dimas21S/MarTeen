const { name } = require("ejs");
const connection = require("../db");

const getMenu = async (req, res) => {
    const user = req.session.user || { name: "Stranger" };
    const query = `
      SELECT m.id AS itemId, m.nama_menu, m.harga, m.gambar, m.deskripsi, k.nama_kantin 
      FROM menu m 
      JOIN kantin k ON m.kantin_id = k.id
    `;

    const [menu] = await connection.promise().execute(query);
    const menuGrouped = menu.reduce((acc, item) => {
        if (!acc[item.nama_kantin]) {
            acc[item.nama_kantin] = [];
        }
        acc[item.nama_kantin].push(item);
        return acc;
    }, {});

    res.render("menu", {
        user,
        menuGrouped,
        currentUrl: "/menu"
    })
}

const postMenu = async (req, res) => {
    const { itemId, bodyUserId } = req.body;
    const userId = bodyUserId || req.session.user?.id;

    const query = "SELECT harga FROM menu WHERE id = ?";
    const [itemRows] = await connection.promise().execute(query, [itemId]);

    if (itemRows.length === 0) {
        console.error("Item not found in database with id: ", itemId);
        return res.status(404).send("Item tidak ditemukan");
    }

    const hargaItem = itemRows[0].harga;

    // Periksa item di keranjang
    const queryCheckCart = "SELECT quantity FROM keranjang WHERE user_id = ? AND item_id = ?";
    const [cartRows] = await connection.promise().execute(queryCheckCart, [userId, itemId]);

    if (cartRows.length > 0) {
        const updateQty = cartRows[0].quantity + 1;
        const updateTotalHarga = updateQty * hargaItem;

        await connection.promise().execute("UPDATE keranjang SET quantity = ?, total_harga = ? WHERE user_id = ? AND item_id = ?",
            [newQuantity, newTotalHarga, userId, itemId]
        );
    } else {
        const totalHarga = hargaItem;

        await connection.promise().execute("INSERT INTO keranjang (user_id, item_id, quantity, total_harga) VALUES (?, ?, 1, ?)",
            [userId, itemId, totalHarga])
    };

    res.send("Item berhasil ditambahkan ke keranjang");
}

module.exports = {
    getMenu,
    postMenu
}