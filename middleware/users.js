const jwt = require('jsonwebtoken');

module.exports = {
    validateRegister: (req, res, next) => {
        // Kiểm tra định dạng email với regex chính xác hơn
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        
        if (!req.body.Email || !emailRegex.test(req.body.Email)) {
            return res.status(400).send({
                message: "Vui lòng nhập địa chỉ email hợp lệ",
            });
        }

        // Kiểm tra độ dài tối thiểu của mật khẩu
        if (!req.body.Password || req.body.Password.length < 6) {
            return res.status(400).send({
                message: "Please enter a password with at least 6 characters",
            });
        }

        // Kiểm tra khớp mật khẩu
        if (!req.body.Password_Repeat || req.body.Password !== req.body.Password_Repeat) {
            return res.status(400).send({
                message: "Both passwords must match",
            });
        }

        next();
    },

    isLoggedIn: (req, res, next) => {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(400).send({
                message: "Your session is not valid"
            });
        }

        // Extract token từ Authorization header (Bearer token)
        const token = authHeader.split(" ")[1];

        jwt.verify(token, 'SECRETKEY', (err, decoded) => {
            if (err) {
                return res.status(401).send({
                    message: "Invalid or expired token",
                });
            }

            // Lưu thông tin người dùng đã giải mã vào req.userData để sử dụng tiếp
            req.userData = decoded;
            next();
        });
    },

    isId_Detail: (req, res, next) => {
        // Có thể bổ sung logic tại đây nếu cần
    },
};
