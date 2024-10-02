const jwt = require('jsonwebtoken');

module.exports = {
    validateRegister: (req, res, next) => {
        //username min length 3
        if (!req.body.UserName || req.body.UserName.length < 3) {
            return res.status(400).send({
                message: "please enter a username with min 3 characters"
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
        if (!req.headers.authorization) {
            return res.status(400).send({
                message: "your session is not valid"
            });
        }
        try {
            const authHeader = req.headers.authorization;
            const token = authHeader.split(" ")[1];
            const date = new Date();
            const decode = jwt.verify(token, 'SECRETKEY', (err, decode) => {
                if (err) {
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

    isId_Detail: ( res, req, next) =>{
    },
};