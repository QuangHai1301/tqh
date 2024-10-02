const express = require('express');
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const db = require('../lib/db.js');
const userMiddleware = require('../middleware/users.js');

//http://localhost:3000/api/sign-up
router.post('/sign-up', userMiddleware.validateRegister, (req, res, next) => {
    const db_username = `SELECT * 
                         FROM homehavendb.user 
                         WHERE 
                         LOWER(UserName) = LOWER("${req.body.UserName}")`

    db.query(db_username, (err, result) => {
        if (err != null) {
            return res.status(409).send({
                message: err.sqlMessage
            });
        }
        if (result != undefined && result.length == 0) {
            var rawSql = `
               INSERT INTO homehavendb.user  
                (UserName,Password)
                VALUES  
                ( 
                LOWER("${req.body.UserName}"),
                LOWER("${req.body.Password}")
                )`

            db.query(rawSql, (err, result) => {
                if (err != null) {
                    return res.status(409).send({
                        message: err.sqlMessage
                    });
                } else {
                    return res.status(200).send({
                        message: "dang ki tai khoan thanh cong! "
                    });
                }
            })
        } else {
            return res.status(409).send({
                message: "this UserName is already in use"
            });
        }
    })
});

//http://localhost:3000/api/delete
router.delete('/delete', (req, res, next) => {
    const db_delete = ` SELECT * 
                        FROM projectroom.account 
                        WHERE 
                        LOWER(usersname) = LOWER("${req.body.username}")`
    db.query(db_delete,
        (err, result) => {
            if (err != null) {
                return res.status(409).send({
                    message: err.sqlMessage
                });
            }
            if (result != undefined && result.length == 0) {
                var rawSql = ` DELETE  
                               FROM  projectroom.account
                               WHERE 
                               LOWER(usersname) = LOWER("${req.body.username}")
                            `
                db.query(rawSql, (err, result) => {
                    if (err != null) {
                        return res.status(409).send({
                            message: err.sqlMessage
                        });
                    } else {
                        return res.status(200).send({
                            message: "xoa tai khoan thanh cong! "
                        });
                    }
                })

            } else {
                return res.status(409).send({
                    message: 'account does not exist'
                })
            }
        });
});



//http://localhost:3000/api/login
router.post('/login', (req, res, next) => {
    const db_login = `  SELECT * 
                        FROM homehavendb.user 
                        WHERE UserName  = ${db.escape(req.body.UserName)}`
    db.query(db_login, (err, result) => {
        if (err) {
            // throw err;
            return res.status(400).send({
                message: err
            });
        }
        if (!result.length) {
            return res.status(400).send({
                message: 'Username or PassWord incorrect 1'
            });
        }
        bcrypt.compare(req.body.Password, result[0]['Password'],
            (bErr, bResult) => {
                if (bErr) {
                    throw bErr;
                    return res.status(400).send({
                        message: 'Username or PassWord incorrect'
                    });
                }
                if (!bResult) {
                    //password match

                    const token = jwt.sign(
                        {
                            UserName: result[0].UserName,
                            ID: result[0].ID,
                        },
                        "SECRETKEY",
                        { expiresIn: '1m' }
                    );
                    // db.query(
                    //     `UPDATE users SET lastlogin = now() WHERE id = '${result[0].id}';`
                    // );
                    return res.status(200).send({
                        message: "Logged in!!",
                        token,
                        user: result[0],
                    });
                } else {
                    return res.status(400).send({
                        message: "Username and Password incorrect! 2 "
                    });
                }
            });
    })
});

//http://localhost:3000/api/list-users
router.get('/list-users', userMiddleware.isLoggedIn, (req, res, next) => {
    const db_listUser = `SELECT * 
                         FROM homehavendb.user `;

    db.query(db_listUser, (err, result) => {
        if (err != null) {
            return res.status(409).send({
                message: err.sqlMessage
            });
        }
        if (result != undefined && result.length != 0) {
            return res.status(200).send({
                result: result
            });
        }
    });
});


//http://localhost:3000/api/list-realty-byID

//http://localhost:3000/api/secret-route
router.get('/secret-route', userMiddleware.isLoggedIn, (req, res, next) => {

});

//http://localhost:3000/api/id-detail
router.get('/id-detail', (req, res, next) => {
    const id_detail = ` SELECT * 
                        FROM homehavendb.user
                        WHERE ID  = ${req.query.ID}`
    db.query(id_detail, (err, result) => {
        if (err != null) {
            return res.status(409).send({
                message: err.sqlMessage
            });
        }
        if (result != undefined && result.length != 0) {
            return res.status(200).send({
                result: result
            });
        }
        if (result != req.query.id) {
            return res.status(409).send({
                message: 'ID incorrect'
            });
        }
    });
});


//http://localhost:3000/api/update
router.put('/update', userMiddleware.validateRegister, (req, res, next) => {
    const getUserSql = `SELECT ID 
                        FROM homehavendb.user 
                        WHERE ID  = ${req.query.ID}`
    const updateUserSql = `UPDATE homehavendb.user 
                    SET UserName =' ${req.body.UserName} ', 
                        Password = ' ${req.body.Password} '
                    WHERE ID = ${req.query.ID} `
    const isTakenSql = `SELECT *
                        FROM homehavendb.user
                        WHERE UserName = '${req.body.UserName}'`
    db.query(isTakenSql, (err, result) => {
        if (err != null) {
            return res.status(409).send({
                message: err.sqlMessage
            })
        }
        if (result != undefined && result.length != 0) {
            return res.status(409).send({
                message: 'UserName nay da ton tai'
            })
        } else {
            db.query(getUserSql, (err, result) => {
                if (err != null) {
                    return res.status(409).send({
                        message: err.sqlMessage
                    });
                }
                if (result[0] != undefined && result.length != 0) {
                    db.query(updateUserSql, (err, result) => {
                        if (err != null) {
                            return res.status(409).send({
                                message: err.sqlMessage
                            });
                        }
                        if (result != undefined && result.length != 0) {
                            return res.status(200).send({
                                message: 'Update successfully'
                            });
                        }
                    });
                }
                else {
                    return res.status(409).send({
                        message: 'ID incorrect'
                    });
                }
            });
        }
    })
});

module.exports = router;
