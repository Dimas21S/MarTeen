const express = require("express");
const path = require("path");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const fileupload = require("express-fileupload");
const db = require("./db");
const connection = require("./db");
const bodyParser = require("body-parser");

const HOST = process.env.HOST || "http://localhost";
const PORT = 5000;

const app = express();

app.use("/assets", express.static(path.join(__dirname, "public/assets")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileupload());

app.use(
  session({
    secret: "secret_key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 60000,
    },
  })
);

function formatRupiah(angka) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(angka).replace('Rp', 'Rp ');
}

// Kirim function ini ke EJS
app.locals.formatRupiah = formatRupiah;

app.use("/aset_index", express.static(path.join(__dirname, "aset_index")));
app.use("/assets", express.static(path.join(__dirname, "assets")));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.get("/api/user", (req, res) => {
  if (req.session.user) {
    res.json({ name: req.session.user.name });
  } else {
    res.json({ name: "Pengguna" });
  }
});

app.use((req, res, next) => {
  res.locals.user = req.session.user || { name: "Stranger" };
  next();
});

app.get("/", (req, res) => {
  const user = req.session.user || { name: "Stranger" }; // Ambil dari session atau default ke "Stranger"
  res.render("index", {
    user, // Kirimkan objek user
    currentUrl: req.originalUrl, // Kirim URL yang aktif
  });
});

// Halaman Register
app.get("/register", (req, res) => {
  res.render("register");
});

app.post("/register", async (req, res) => {
  const { username, email, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  const sql =
    "INSERT INTO register (username, email, password) VALUES (?, ?, ?)";
  db.execute(sql, [username, email, hashedPassword], (err, result) => {
    if (err) {
      console.error("Error inserting data:", err);
      return res.status(500).send("Error saving user to database");
    }
    res.redirect("/login");
  });
});

// Halaman Login
app.get("/login", (req, res) => {
  res.render("login", { errorMessage: null });
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validasi input
    if (!email || !password) {
      return res.render("login", {
        errorMessage: "Email dan password harus diisi",
      });
    }

    // Query untuk mendapatkan data user berdasarkan email
    const sql = "SELECT * FROM register WHERE email = ?";
    const [results] = await connection.promise().execute(sql, [email]);

    if (results.length === 0) {
      return res.render("login", { errorMessage: "Email atau password salah" });
    }

    const user = results[0];

    // Bandingkan password menggunakan bcrypt
    const match = await bcrypt.compare(password, user.password);

    if (match) {
      // Simpan data user ke session
      req.session.user = {
        id: user.IdUser, // Pastikan `id` digunakan untuk fitur lain
        name: user.username,
      };

      // Redirect ke halaman utama
      res.redirect("/");
    } else {
      // Password tidak cocok
      res.render("login", { errorMessage: "Email atau password salah" });
    }
  } catch (error) {
    console.error("Error during login:", error.message, error.stack);
    res
      .status(500)
      .render("login", { errorMessage: "Terjadi kesalahan pada server" });
  }
});

// Halaman Menu
app.get("/menu", async (req, res) => {
  const user = req.session.user || { name: "Stranger" }; // Pastikan ada objek user
  try {
    // Query SQL untuk mengambil data menu dengan join ke tabel kantin
    const sql = `
      SELECT m.id AS itemId, m.nama_menu, m.harga, m.gambar, m.deskripsi, k.nama_kantin 
      FROM menu m 
      JOIN kantin k ON m.kantin_id = k.id
    `;

    // Eksekusi query dan ambil hasilnya
    const [menu] = await connection.promise().execute(sql);

    const menuGrouped = menu.reduce((acc, item) => {
      if (!acc[item.nama_kantin]) {
        acc[item.nama_kantin] = [];
      }
      acc[item.nama_kantin].push(item);
      return acc;
    }, {});

    // Render halaman menu dengan data dari database
    res.render("menu", {
      user,
      currentUrl: "/menu",
      menuGrouped, // Kirim data menu ke template
    });
  } catch (error) {
    console.error("Error fetching menu:", error.message);
    res.status(500).send(`Error fetching menu: ${error.message}`);
  }
});

app.post("/menu", async (req, res) => {
  try {
    const { id: itemId, IdUser: bodyUserId } = req.body;
    console.log("Received itemId:", itemId); // Debugging line

    // Ambil userId dari session jika tidak dikirim dalam body
    const userId = bodyUserId || req.session.user?.id;

    // Ambil harga item dari database
    const sqlItemData = "SELECT harga FROM menu WHERE id = ?";
    const [itemRows] = await connection
      .promise()
      .execute(sqlItemData, [itemId]);

    if (itemRows.length === 0) {
      console.error("Item not found in database for itemId:", itemId);
      return res.status(404).send("Item tidak ditemukan");
    }

    const itemHarga = itemRows[0].harga;

    // Periksa apakah item sudah ada di keranjang
    const sqlCheckCart =
      "SELECT quantity FROM keranjang WHERE user_id = ? AND item_id = ?";
    const [cartRows] = await connection
      .promise()
      .execute(sqlCheckCart, [userId, itemId]);

    if (cartRows.length > 0) {
      // Jika item sudah ada, update quantity dan total_harga
      const newQuantity = cartRows[0].quantity + 1;
      const newTotalHarga = newQuantity * itemHarga;

      await connection
        .promise()
        .execute(
          "UPDATE keranjang SET quantity = ?, total_harga = ? WHERE user_id = ? AND item_id = ?",
          [newQuantity, newTotalHarga, userId, itemId]
        );
    } else {
      // Jika item belum ada, tambahkan ke keranjang
      const totalHarga = itemHarga;

      await connection
        .promise()
        .execute(
          "INSERT INTO keranjang (user_id, item_id, quantity, total_harga) VALUES (?, ?, 1, ?)",
          [userId, itemId, totalHarga]
        );
    }

    res.status(200).send("Item berhasil ditambahkan ke keranjang");
  } catch (error) {
    console.error("Error:", error.message, error.stack);
    res.status(500).send("Terjadi kesalahan pada server");
  }
});

// Halaman Pesanan
app.get("/pesanan", async (req, res) => {
  try {
    const user = req.session.user || { name: "Guest" };
    const userId = req.session.IdUser;

    // Ambil data pesanan untuk user dari database
    const sql = `SELECT 
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

    const [pesanan] = await connection.promise().query(sql, [user.id]);

    // // Mengambil total harga yang ada di tabel keranjang
    const totalHarga = pesanan.reduce(
      (sum, item) => sum + item.harga * item.quantity,
      0
    );

    const sqlTransaksi = `SELECT metode_pembayaran FROM transaksi WHERE user_id = ?`;
    const [transaksi] = await connection
      .promise()
      .execute(sqlTransaksi, [user.id]);

    res.render("pesanan", {
      user,
      currentUrl: "/pesanan",
      pesanan,
      totalHarga,
      transaksi,
      userId,
    });
  } catch (error) {
    console.error("Error fetching pesanan:", error.message, error.stack);
    res.status(500).send("Terjadi kesalahan saat mengambil pesanan");
  }
});

app.post("/pesanan", async (req, res) => {
  try {
    const { IdUser: bodyUserId, totalHarga, metodePembayaran } = req.body;

    const userId = bodyUserId || req.session.user?.id;

    // Log data untuk debugging
    console.log("Request body:", req.body);

    // Validasi input
    if (!userId) {
      return res.status(400).json({ error: "Data user tidak valid" });
    }
    if (!totalHarga || isNaN(totalHarga) || totalHarga <= 0) {
      return res.status(400).json({ error: "Total harga tidak valid" });
    }
    if (!metodePembayaran || !["CASH", "CARD", "VOUCHER"].includes(metodePembayaran)) {
      return res.status(400).json({ error: "Metode pembayaran tidak valid" });
    }

    // Ambil data pesanan untuk user
    const sql = `SELECT k.*, m.harga, m.nama_menu AS menu, kantin.nama_kantin AS Kantin 
                 FROM keranjang k 
                 JOIN kantin ON k.item_id = kantin.id 
                 JOIN menu m ON m.kantin_id = kantin.id 
                 WHERE k.user_id = ?`;
    const [pesanan] = await connection.promise().execute(sql, [userId]);

    if (!pesanan.length) {
      return res.status(400).json({ error: "Keranjang kosong" });
    }

    // Simpan data transaksi ke tabel `transaksi`
    const sqlResult = `INSERT INTO transaksi (user_id, total_harga, metode_pembayaran, tanggal) VALUES (?, ?, ?, NOW())`;
    const [result] = await connection
      .promise()
      .execute(sqlResult, [userId, totalHarga, metodePembayaran]);
    const transaksiId = result.insertId;

    // Memindahkan pesanan dari keranjang ke tabel detail transaksi
    for (const item of pesanan) {
      await connection.promise().execute(
        "INSERT INTO detail_transaksi (transaksi_id, item_id, quantity, harga) VALUES (?, ?, ?, ?)",
        [transaksiId, item.item_id, item.quantity, item.harga]
      );
    }

    // Mengosongkan keranjang user
    await connection
      .promise()
      .execute("DELETE FROM keranjang WHERE user_id = ?", [userId]);

    res.status(200).json({
      message: "Pembayaran berhasil diproses",
      transaksiId,
      totalHarga,
    });
  } catch (error) {
    console.error("Error processing payment:", error.message, error.stack);
    res.status(500).json({ error: "Terjadi kesalahan saat memproses pembayaran" });
  }
});

app.delete("/pesanan", async (req, res) => {
  try {
    const { IdUser: bodyUserId } = req.body;

    // Ambil user ID dari body atau sesi
    const userId = bodyUserId || req.session.user?.id;

    // Validasi user ID
    if (!userId) {
      return res.status(400).json({ error: "Data user tidak valid" });
    }

    // Periksa apakah keranjang pengguna ada
    const sqlCheck = "SELECT COUNT(*) AS count FROM keranjang WHERE user_id = ?";
    const [rows] = await connection.promise().execute(sqlCheck, [userId]);

    if (rows[0].count === 0) {
      return res.status(400).json({ error: "Keranjang sudah kosong" });
    }

    // Hapus semua item dari keranjang
    const sqlDelete = "DELETE FROM keranjang WHERE user_id = ?";
    await connection.promise().execute(sqlDelete, [userId]);

    // Berikan respons sukses
    res.status(200).json({
      message: "Semua pesanan telah dihapus dari keranjang",
    });
  } catch (error) {
    console.error("Error deleting orders:", error.message, error.stack);
    res.status(500).json({
      error: "Terjadi kesalahan saat menghapus pesanan",
    });
  }
});

// Halaman Best-Seller
app.get("/best-seller", (req, res) => {
  const user = req.session.user || { name: "Guest" };
  res.render("best_seller", {
    user,
    currentUrl: "/best-seller", // Mengirim URL aktif
  });
});

// Halaman Pengaturan
app.get("/profil-pengaturan", async (req, res) => {
  try {
    const user = req.session.user || { name: "Stranger" };

    // Query SQL untuk mengambil data profil
    const sql = `SELECT email, foto_profil, role FROM register WHERE IdUser = ?`;
    const [profil] = await connection.promise().execute(sql, [user.id]);
    const role = profil[0]?.role || "pengguna"; // Default ke "pengguna" jika role kosong

    // Ambil email dari hasil query
    const email = profil[0]?.email || null; // Null jika tidak ada email


    console.log("User data:", { ...user, role }); // Debugging untuk melihat user dan role
    // Render halaman profil
    res.render("profile", {
      user,
      currentUrl: "/profil-pengaturan",
      email, // Kirimkan email langsung ke template
      fotoProfil: profil[0]?.foto_profil || null,
      role,
      isAdmin: role === "admin", // Tambahkan flag untuk admin
    });
  } catch (error) {
    console.error("Error fetching user profile:", error.message, error.stack);
    res.status(500).send("Terjadi kesalahan saat mengambil data profil");
  }
});

app.post("/profil-pengaturan", async (req, res) => {
  try {
    const user = req.session.user;

    // Validasi apakah user sudah login
    if (!user || !user.id) {
      return res.redirect("/login");
    }

    if (!req.files || !req.files.foto) {
      return res.status(400).send("Foto tidak ditemukan");
    }

    const foto = req.files.foto;
    const fileName = `uploads/${Date.now()}_${foto.name}`;

    // Simpan foto ke folder uploads
    await foto.mv(fileName);

    // Simpan path foto ke database
    const sql = `UPDATE register SET foto_profil = ? WHERE IdUser = ?`;
    await connection.promise().execute(sql, [fileName, user.id]);

    res.redirect("/profil-pengaturan");
  } catch (error) {
    console.error(
      "Error uploading profile picture:",
      error.message,
      error.stack
    );
    res.status(500).send("Terjadi kesalahan saat mengunggah foto profil");
  }
});

// Halaman Lihat Pesanan
app.get("/daftar-pesanan", async (req, res) => {
  try {
    const user = req.session.user;

    // Validasi apakah user sudah login
    if (!user) {
      return res.redirect("/login");
    }

    // Ambil daftar pesanan user dari database
    const sql = `SELECT 
           t.id AS transaksi_id, 
           t.tanggal, 
           t.total_harga, 
           t.metode_pembayaran, 
           dt.quantity, 
           m.nama_menu, 
           m.harga 
         FROM transaksi t
         JOIN detail_transaksi dt ON t.id = dt.transaksi_id
         JOIN menu m ON dt.item_id = m.id
         WHERE t.user_id = ?
         ORDER BY t.tanggal DESC`;

    const [pesanan] = await connection.promise().execute(sql, [user.id]);

    // Render halaman profil dengan data user dan daftar pesanan
    res.render("daftar-pesanan", {
      user,
      pesanan, // Daftar pesanan user
      currentUrl: "/profil-pengaturan/daftar-pesanan", // URL aktif
    });
  } catch (error) {
    console.error("Error fetching user orders:", error.message, error.stack);
    res.status(500).send("Terjadi kesalahan saat mengambil pesanan");
  }
});

// Login Admin
// app.get("/login-admin", (req, res) => {
//   res.render("login", { errorMessage: null, currentUrl: "/login-admin" });
// });

// app.post("/login-admin", async (req, res) => {
//   const { email, password } = req.body;

//   try {
//     // Query untuk mengambil data admin berdasarkan email
//     const sql = "SELECT * FROM register WHERE email = ?"; // Perbaiki query: pastikan menyebutkan nama tabel 'admin'
//     const [results] = await db.promise().query(sql, [email]);

//     if (results.length === 0) {
//       // Jika email tidak ditemukan
//       return res.render("login-admin", { errorMessage: "Email atau password salah" });
//     }

//     const admin = results[0];

//     // Periksa password menggunakan bcrypt
//     const match = await bcrypt.compare(password, admin.password);
//     if (!match) {
//       // Jika password salah
//       return res.render("login-admin", { errorMessage: "Email atau password salah" });
//     }

//     // Simpan sesi admin
//     req.session.admin = {
//       id: admin.id,
//       name: admin.username,
//       email: admin.email,
//       kantin_id: admin.kantin_id || null, // Sesuaikan dengan struktur tabel
//     };

//     // Redirect atau render halaman setelah login sukses
//     return res.redirect("/admin-index"); // Misalnya, ke halaman dashboard admin setelah login sukses
//   } catch (error) {
//     console.error("Login error:", error.message);
//     res.status(500).send("Internal server error");
//   }
// });


// app.get("/admin", async (req, res) => {
//   const user = req.session.user || { name: "Stranger" }; // Pastikan ada objek user
//   try {
//     // Query SQL untuk mengambil data menu dengan join ke tabel kantin
//     const sql = `
//       SELECT m.nama_menu, m.harga, m.gambar, k.nama_kantin 
//       FROM menu m 
//       JOIN kantin k ON m.kantin_id = k.id
//     `;

//     // Eksekusi query dan ambil hasilnya
//     const [menu] = await connection.promise().query(sql);

//     const menuGrouped = menu.reduce((acc, item) => {
//       if (!acc[item.nama_kantin]) {
//         acc[item.nama_kantin] = [];
//       }
//       acc[item.nama_kantin].push(item);
//       return acc;
//     }, {});

//     // Render halaman menu dengan data dari database
//     res.render("admin-index", {
//       user,
//       currentUrl: "/admin",
//       menuGrouped, // Kirim data menu ke template
//     });
//   } catch (error) {
//     console.error("Error fetching menu:", error.message);
//     res.status(500).send(`Error fetching menu: ${error.message}`);
//   }
// });

app.get("/admin-index", async (req, res) => {
  const admin = req.session.admin; 
  try {
    // Query untuk mengambil data menu dengan join tabel kantin
    const sql = `
      SELECT m.nama_menu, m.harga, m.gambar, k.nama_kantin 
      FROM menu m 
      JOIN kantin k ON m.kantin_id = k.id
    `;
    const [menus] = await connection.promise().query(sql);

    // Kirim data ke template EJS
    res.render("admin-index", {admin, currentUrl: "/admin", menus });
  } catch (error) {
    console.error("Error fetching menus:", error.message);
    res.status(500).send("Internal server error");
  }
});

// Tambah Menu
app.get("/admin/tambah-menu", (req, res) => {
  res.render("tambah-menu");
});

// Konfigurasi multer untuk upload file
app.post("/admin/tambah-menu", async (req, res) => {
  try {
    // Validate that the form data is included
    const { nama_menu, harga, kantin_nama } = req.body;
    if (!nama_menu || !harga || !kantin_nama || isNaN(harga) || harga <= 0) {
      return res.status(400).send("Data tidak lengkap atau harga tidak valid.");
    }

    // Validate file upload
    if (!req.files || !req.files.gambar) {
      return res.status(400).send("Gambar menu tidak diunggah.");
    }

    const gambarFile = req.files.gambar;

    // Ensure the file is an image
    if (!gambarFile.mimetype.startsWith("image/")) {
      return res.status(400).send("File yang diunggah bukan gambar.");
    }

    // Save the uploaded image to the "uploads" directory
    const uploadPath = path.join(__dirname, "uploads", gambarFile.name);
    await gambarFile.mv(uploadPath);

    // Relative path to store in the database
    const gambar = `/uploads/${gambarFile.name}`;

    // Find the kantin ID
    const sqlFindKantin = "SELECT id FROM kantin WHERE nama_kantin = ?";
    const [kantin] = await db.promise().query(sqlFindKantin, [kantin_nama]);

    if (kantin.length === 0) {
      return res.status(400).send("Kantin tidak ditemukan.");
    }

    const kantin_id = kantin[0].id;

    // Insert the new menu into the database
    const sqlInsertMenu =
      "INSERT INTO menu (nama_menu, harga, gambar, kantin_id) VALUES (?, ?, ?, ?)";
    await db.promise().query(sqlInsertMenu, [nama_menu, harga, gambar, kantin_id]);

    res.redirect("/admin-index");
  } catch (error) {
    console.error("Error adding menu:", error.message);
    res.status(500).send("Internal server error");
  }
});

// Metode Log Out
app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying session:", err);
      return res.status(500).send("Error during logout");
    }
    res.redirect("/login");
  });
});

app.use("/assets", express.static(path.join(__dirname, "public/assets")));

app.listen(PORT, () => {
  console.log(`Server running at ${HOST}:${PORT}`);
});
