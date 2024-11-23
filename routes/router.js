const express = require('express');
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const axios = require('axios');
const multer = require('multer');
const db = require('../lib/db.js');
const path = require('path')
const userMiddleware = require('../middleware/users.js');
const fs = require('fs');
/////////////////////////////////////

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
                        { expiresIn: '2m' }
                    );

                    const db_addUserTime = `INSERT INTO homehavendb.user_log (Action_Description, Create_By, Create_At, User_ID, Status_Userlog)
                                                    VALUES ('${token}' , '${result[0].UserName}', now()  , '${result[0].ID}' , 'Khả Dụng' )`;
                    const db_updateUserTime = `UPDATE homehavendb.user_log 
                                                SET Action_Description = '${token}', Create_by = '${result[0].UserName}', User_ID = '${result[0].ID}'  , Create_at = now() 
                                                WHERE ID = '${result[0].ID}';`;
                    db.query(db_addUserTime, (err, db_result) => {
                        if (err) {
                            return res.status(400).send({
                                message: err
                            });
                        }
                        if (db_result != undefined && db_result.length != 0) {
                            res.setHeader('Authorization', `Bearer ${token}`);
                            return res.status(200).send({
                                message: "Logged in!!",
                                token,
                                user: result[0],
                            });
                        }
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

//http://localhost:3000/api/get-items
router.get('/get-items', (req, res, next) => {
    const db_list_items = `SELECT * 
                         FROM homehavendb.post_article `;
    db.query(db_list_items, (err, result) => {
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

router.get('/verify-token', userMiddleware.isLoggedIn, (req, res) => {
    const authHeader = req.headers['authorization'];


    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];

        // Truy vấn cơ sở dữ liệu để kiểm tra sự tồn tại của access token
        db.query('SELECT * FROM homehavendb.user_log WHERE Action_Description = ?', [token], function (error, results, fields) {
            if (error) {
                res.status(500).send('Internal Server Error');
            } else {
                if (results.length > 0) {
                    res.send('Access token is valid');
                } else {
                    res.status(401).send('Unauthorized');
                }
            }
        });
    } else {
        res.status(401).send('Unauthorized');
    }
});

//http://localhost:3000/api/add-post-article
router.post('/add-post-article', userMiddleware.isLoggedIn, (req, res, next) => {
    const db_tokenUser = ` SELECT * FROM homehavendb.user_log WHERE Status_Userlog = 'Khả Dụng' `;
    db.query(db_tokenUser, (err, result) => {

        if (err != null) {
            return res.status(409).send({
                message: err.sqlMessage
            });
        }
        if (result != undefined && result.length != 0) {
            const { title, tenant, price, description, area, attachment, status_ID, city_ID } = req.body;
            const db_list_article = `INSERT INTO homehavendb.post_article 
                                        (User_ID , Title , Tenant , Price , Description , Area , Attachment , Status_ID , City_ID , Date_Begin) 
                                        VALUES ( ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW() )`;

            const values = [
                result[0].User_ID,
                title,
                tenant,
                price,
                description,
                area,
                attachment,
                status_ID,
                city_ID
            ];

            db.query(db_list_article, values, (listArticle_err, listArticle_result) => {
                
                if (listArticle_err != null) {
                    return res.status(409).send({
                        message: err.sqlMessage
                    });
                }
                if (listArticle_result != undefined && listArticle_result != 0) {
                    return res.status(200).send({
                        message: 'Success add post article',
                    });
                }

            });
        }
    });
});


//http://localhost:3000/api/upload-image
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 1024 * 1024 * 5 // 5MB limit
    },
    fileFilter: function (req, file, cb) {
        checkFileType(file, cb);
    }
});

// Check File Type
function checkFileType(file, cb) {
    const filetypes = /jpeg|jpg|png|gif/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb('Error: Images Only!');
    }
}

// router.post('/upload-image', upload.single('image'), (req, res) => {
//     const image = fs.readFileSync(req.file.path);
//     const encodedImage = image.toString('base64');

//     const sql = 'INSERT INTO homehavendb.post_article (attachment, description) VALUES (?, ?)';
//     db.query(sql, [req.file.originalname, encodedImage], (err, result) => {
//         if (err) throw err;
//         console.log('Image saved to database');
//         res.send('Image uploaded successfully');
//     });
// });


router.post('/upload-image', upload.single('image'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ msg: 'No file uploaded' });
        }

        const query = 'INSERT INTO homehavendb.post_article (name_image, attachment) VALUES (?, ?)';
        const values = [req.file.originalname, req.file.filename];

        db.query(query, values, (err, result) => {
            if (err) {
                console.error('Error saving to database:', err);
                return res.status(500).json({ error: 'Error saving to database' });
            }

            res.json({
                msg: 'File uploaded successfully',
                image: {
                    id: result.insertId,
                    title: req.file.originalname,
                    imagePath: req.file.filename
                }
            });
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all images
router.get('/images', (req, res) => {
    const query = `SELECT * FROM homehavendb.post_article`;

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching images:', err);
            return res.status(500).json({ error: 'Error fetching images' });
        }

        // Chuyển đổi kết quả để phù hợp với frontend
        const images = results.map(img => ({
            ID: img.ID,
            Description: img.Description,
            Attachment: img.Attachment
        }));
        res.json(images);
    });
});
//http://localhost:3000/api/post-article
router.get('/post-article', userMiddleware.isLoggedIn, (req, res, next) => {
    const db_list_items = `SELECT * 
                         FROM homehavendb.post_article WHERE ID = ${req.query.ID} `;
    db.query(db_list_items, (err, result) => {
        if (err != null) {
            return res.status(409).send({
                message: err.sqlMessage
            });
        }
        if (result != undefined && result.length != 0) {
            const db_user_byID = `SELECT * FROM homehavendb.user WHERE ID = ` + `${result[0].User_ID}`
            db.query(db_user_byID, (err, resultUser) => {
                if (err != null) {
                    return res.status(409).send({
                        message: err.sqlMessage
                    });
                }
                if (resultUser != undefined && resultUser.length != 0) {
                    return res.status(200).send({
                        resultUser,
                        result
                    });
                }
            })
        }
    });
});

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
