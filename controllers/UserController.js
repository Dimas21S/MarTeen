const connection = require("../db");

const getProfilePage = async (req, res) => {
    const user = req.session.user || { name: 'Guest' };
    const query = `SELECT email, foto_profil, role FROM register WHERE IdUser = ?`;
    const [userProfile] = await connection.execute(query, [user.id]);
    const role = userProfile[0]?.role || 'Pengguna';
    const email = userProfile[0]?.email || null;
    const photoProfile = userProfile[0]?.foto_profil || null;

    res.render("profile", {
        user,
        currentUrl: "/profile",
        email,
        photoProfile,
        role,
        isAdmin: role === 'Admin'
    });
}

const postProfilePage = async (req, res) => {
    const user = req.session.user || { name: 'Guest' };

    if (!user || !user.id) {
        return res.redirect("/login");
    }

    const foto = req.file;
    const fileName = `uploads/${Date.now()}_${foto.name}`;

    await foto.mv(fileName);

    const query = `UPDATE register SET foto_profil = ? WHERE IdUser = ?`;
    await connection.execute(query, [fileName, user.id]);

    res.redirect("/profile");
}

const bestSellerPage = async (req, res) => {
    const user = req.session.user || { name: "Guest" };
    res.render("best_seller", {
        user,
        currentUrl: "/best-seller", // Mengirim URL aktif
    });
}