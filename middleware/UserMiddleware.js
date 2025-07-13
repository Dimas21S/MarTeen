const userMiddleware = (req, res, next) => {
    const defaultUser = { name: 'Guest', id: null };
    res.locals.user = req.session.user || defaultUser;
    next();
}

module.exports = userMiddleware;