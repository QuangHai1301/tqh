const jwt = require('jsonwebtoken');
const db = require('../lib/db.js');




module.exports = {
    validateRegister: (req, res, next) => {
        //username min length 3
        console.log("check", req.body.UserName);

        if (!req.body.UserName || req.body.UserName.length < 3) {
            return res.status(400).send({
                message: "please enter a username with min 3 characters",

            });
        }
        //password min 6 chars
        if (!req.body.Password || req.body.Password.length < 6) {
            return res.status(400).send({
                message: "please enter a password with min 6 chars"
            });
        }
        //password (repeat) must match
        if (
            !req.body.Password_Repeat ||
            req.body.Password != req.body.Password_Repeat
        ) {
            return res.status(400).send({
                message: "both passwords must match",
            });
        }
        next();
    },
    isLoggedIn: (req, res, next) => {
        
        const authHeader = req.headers.authorization;
        res.setHeader('Authorization', `Bearer ${authHeader}`);
        const token = authHeader.split(" ")[1];

        if(!token) {
            db.query(`UPDATE homehavendb.user_log 
                        SET  Status_Userlog = 'Hết Hạn'
                        WHERE TIMESTAMPDIFF(MINUTE, Create_At, now()) > 2`, (err, result) => {
                if(err) {
                    return res.status(200).send({
                        message: 'sql error'
                    });
                }
            })
            return res.status(400).send({
                message: "your session is not valid"
            });
        }
        try {
            const date = new Date();
            const decode = jwt.verify(token, 'SECRETKEY', (err, decode) => {
                if(err) {
                    return res.status(409).send({
                        message: err.message,
                    });
                }
                next();
            });
            req.userData = decode;
        } catch (err) {
            throw err;
        }
    },
    isId_Detail: (res, req, next) => {
    },
};

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
