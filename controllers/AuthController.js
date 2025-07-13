const connection = require("../db");
const bcrypt = require("bcryptjs");

// Halaman Login
const getLogin = (req, res) => {
    res.render("login", { errorMessage: null });
};

const postLogin = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.render("login", {
            errorMessage: "Email dan password harus diisi"
        });
    }

    try {
        const query = "SELECT * FROM register WHERE email = ?";
        const [result] = await connection.promise().execute(query, [email]);

        if (result.length === 0) {
            return res.render("login", {
                errorMessage: "Email atau password salah"
            });
        }

        const user = result[0];
        const match = await bcrypt.compare(password, user.password);

        if (match) {
            req.session.user = {
                id: user.IdUser,
                name: user.username
            };
            res.redirect("/");
        } else {
            res.render("login", { errorMessage: "Email atau password salah" });
        }
    } catch (error) {
        console.error("Login error:", error.message);
    }
};

// Halaman Register
const getRegister = (req, res) => {
    res.render("register", { errorMessage: null });
};

const postRegister = async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.render("register", { errorMessage: "Semua field wajib diisi" });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const query = "INSERT INTO register (username, email, password) VALUES (?, ?, ?)";
        await connection.promise().execute(query, [username, email, hashedPassword]);

        res.redirect("/login");
    } catch (err) {
        console.error("Error inserting data: ", err);
    }
};

const postLogout = async (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error("Logout Error: ", err);
            return res.status(500).send("Error during logout");
        }
        res.redirect("/login");
    })
}

module.exports = {
    getLogin,
    postLogin,
    getRegister,
    postRegister,
    postLogout
};
