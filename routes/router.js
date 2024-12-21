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


// http://localhost:19006/api/sign-up updated 30/10/24 cho thêm username
router.post('/sign-up', userMiddleware.validateRegister, (req, res, next) => {
    const db_email = `SELECT * FROM homehavendb.user WHERE LOWER(Email) = LOWER(${db.escape(req.body.Email)})`;

    db.query(db_email, (err, result) => {
        if (err) {
            return res.status(500).send({ message: "Database query error" });
        }

        if (result.length > 0) {
            return res.status(409).send({ message: "Email này đã được sử dụng" });
        }

        // Đảm bảo mật khẩu là chuỗi trước khi mã hóa
        bcrypt.hash(String(req.body.Password), 10, (err, hash) => {
            if (err) {
                return res.status(500).send({ message: "Hashing error" });
            }

            const rawSql = `INSERT INTO homehavendb.user (UserName, Email, Password, PhoneNumber) VALUES (?, ?, ?, ?)`;
            db.query(rawSql, [req.body.UserName, req.body.Email, hash, req.body.PhoneNumber], (err) => { // Thêm UserName vào truy vấn SQL
                if (err) {
                    return res.status(500).send({ message: "Database insertion error" });
                }
                return res.status(201).send({ message: "Đăng ký thành công!" });
            });
        });
    });
});



//http://localhost:19006/api/delete
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


// http://localhost:19006/api/login
router.post('/login', (req, res) => {
    const { Email, Password } = req.body;

    if (!Email || !Password) {
        return res.status(400).send({ message: "Vui lòng nhập email và mật khẩu" });
    }

    const db_login = `SELECT * FROM homehavendb.user WHERE LOWER(Email) = LOWER(${db.escape(Email)})`;

    db.query(db_login, (err, result) => {
        if (err) {
            return res.status(500).send({ message: "Database query error" });
        }

        if (result.length === 0) {
            return res.status(400).send({ message: "Email hoặc mật khẩu không chính xác" });
        }

        // Chuyển đổi mật khẩu nhập vào thành chuỗi trước khi so sánh
        bcrypt.compare(String(Password), result[0].Password, (bErr, bResult) => {
            if (bErr || !bResult) {
                return res.status(400).send({ message: "Mật khẩu không chính xác" });
            }

            const token = jwt.sign(
                { Email: result[0].Email, ID: result[0].ID },
                "SECRETKEY",
                { expiresIn: '1h' }
            );

            return res.status(200).send({
                message: "Đăng nhập thành công!",
                token,
                user: {
                    email: result[0].Email,
                    id: result[0].ID,
                    phoneNumber: result[0].PhoneNumber,
                },
            });
        });
    });
});

// http://localhost:19006/api/user-info
router.get('/user-info', userMiddleware.isLoggedIn, (req, res) => {
    const userId = req.userData.ID; // Lấy ID từ token đã giải mã

    const db_userInfo = `SELECT UserName, Email, PhoneNumber FROM homehavendb.user WHERE ID = ?`;
    db.query(db_userInfo, [userId], (err, result) => {
        if (err) {
            return res.status(500).send({
                message: "Database query error",
            });
        }

        if (result.length === 0) {
            return res.status(404).send({
                message: "User not found",
            });
        }

        return res.status(200).send({
            userName: result[0].UserName,  // trả về tên người dùng/username
            email: result[0].Email,
            phoneNumber: result[0].PhoneNumber,
        });
    });
});





//http://localhost:19006/api/list-users 
router.get('/list-users', userMiddleware.isLoggedIn, (req, res, next) => {
    const db_listUser = `SELECT * 
                         FROM homehavendb.user`;

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
            })
        }
    })

});
// http://localhost:19006/api/get-items API updated 30/10/2024
router.get('/get-items', (req, res, next) => {
    const db_list_items = `
    SELECT 
        post_article.ID,
        post_article.Title,
        post_article.Attachment,
        post_article.Price,
        post_article.Description,
        realty_category.Name AS category,
        post_article.City_ID,
        post_article.District_ID,
        user.UserName AS UserName
    FROM 
        homehavendb.post_article
    JOIN 
        homehavendb.realty_category 
    ON 
        post_article.Realty_Category_ID = realty_category.ID
    JOIN 
        homehavendb.user 
    ON 
        post_article.User_ID = user.ID;
`;
    
    db.query(db_list_items, (err, result) => {
        if (err) {
            return res.status(500).send({
                message: err.sqlMessage
            });
        }
        
        if (result && result.length > 0) {
            return res.status(200).send({
                result: result
            });
        } else {
            return res.status(404).send({
                message: "No items found"
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


// http://localhost:19006/api/post-article //api đăng bài viết 
router.post('/post-article', userMiddleware.isLoggedIn, (req, res) => {
    const { title, description, price, area, category, attachment, city, district } = req.body;
    const userID = req.userData.ID; // Giả sử bạn có middleware xác thực và lấy ID người dùng từ token

    // Truy vấn để lấy ID danh mục từ tên danh mục
    const categoryQuery = `SELECT ID FROM homehavendb.realty_category WHERE Name = ?`;
    db.query(categoryQuery, [category], (err, categoryResult) => {
        if (err) {
            return res.status(409).send({
                message: "Database error: " + err.sqlMessage
            });
        }

        if (categoryResult.length === 0) {
            return res.status(404).send({   
                message: "Category not found"
            });
        }

        const categoryID = categoryResult[0].ID;

        // Kiểm tra Tỉnh/Thành phố (City)
        const cityQuery = `SELECT ID FROM homehavendb.city WHERE ID = ?`;
        db.query(cityQuery, [city], (err, cityResult) => {
            if (err) {
                return res.status(409).send({
                    message: "Database error while checking city: " + err.sqlMessage
                });
            }

            if (cityResult.length === 0) {
                return res.status(404).send({
                    message: "City not found"
                });
            }

            // Kiểm tra Quận/Huyện (District)
            const districtQuery = `SELECT ID FROM homehavendb.district WHERE ID = ? AND City_ID = ?`;
            db.query(districtQuery, [district, city], (err, districtResult) => {
                if (err) {
                    return res.status(409).send({
                        message: "Database error while checking district: " + err.sqlMessage
                    });
                }

                if (districtResult.length === 0) {
                    return res.status(404).send({
                        message: "District not found or does not belong to the selected city"
                    });
                }

                // Thêm bài viết mới vào cơ sở dữ liệu
                const insertArticleQuery = `
                    INSERT INTO homehavendb.post_article 
                    (User_ID, Realty_Category_ID, Title, Description, Price, Area, Attachment, Date_Begin, Status_ID, City_ID, District_ID)
                    VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?)
                `;

                const statusID = 1; // Giả định trạng thái mặc định là "Chờ duyệt"

                db.query(insertArticleQuery, [userID, categoryID, title, description, price, area, attachment, statusID, city, district], (err, result) => {
                    if (err) {
                        return res.status(409).send({
                            message: "Error inserting article: " + err.sqlMessage
                        });
                    }

                    return res.status(201).send({
                        message: "Bài viết đã được đăng thành công!",
                        articleID: result.insertId
                    });
                });
            });
        });
    });
});



//http://localhost:19006/api/list-realty-byID

//http://localhost:19006/api/secret-route
router.get('/secret-route', userMiddleware.isLoggedIn, (req, res, next) => {

});

//http://localhost:3000/api/id-detail
//http://localhost:19006/api/id-detail
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
// http://localhost:19006/api/delete-article
router.delete('/delete-article/:articleId', userMiddleware.isLoggedIn, (req, res) => {
    const articleId = req.params.articleId; // Lấy ID bài viết từ URL
    const userId = req.userData.ID; // Lấy ID người dùng từ token đã xác thực

    const deleteRentalRequestsQuery = `
        DELETE FROM homehavendb.rental_requests 
        WHERE Product_ID = ?
    `;

    const deleteArticleQuery = `
        DELETE FROM homehavendb.post_article 
        WHERE ID = ? 
          AND User_ID = ?
    `;

    // Xóa yêu cầu thuê trước
    db.query(deleteRentalRequestsQuery, [articleId], (err) => {
        if (err) {
            console.error("Database error (deleting rental requests):", err);
            return res.status(500).send({
                message: "Lỗi cơ sở dữ liệu khi xóa yêu cầu thuê.",
                error: err.sqlMessage,
            });
        }

        // Sau khi xóa yêu cầu thuê, xóa bài viết
        db.query(deleteArticleQuery, [articleId, userId], (err, result) => {
            if (err) {
                console.error("Database error (deleting article):", err);
                return res.status(500).send({
                    message: "Lỗi cơ sở dữ liệu khi xóa bài viết.",
                    error: err.sqlMessage,
                });
            }

            if (result.affectedRows > 0) {
                return res.status(200).send({
                    message: "Xóa bài viết thành công.",
                });
            } else {
                return res.status(404).send({
                    message: "Không tìm thấy bài viết hoặc bạn không có quyền xóa bài viết này.",
                });
            }
        });
    });
});


// http://localhost:19006/api/my-articles/
router.get('/my-articles', userMiddleware.isLoggedIn, (req, res, next) => {
    const userId = req.userData.ID; // Nhận ID người dùng từ token đã xác thực
    console.log("User ID from token:", userId); // Kiểm tra ID người dùng

    const userArticlesQuery = `
        SELECT 
            post_article.ID, 
            post_article.Title, 
            post_article.Description, 
            post_article.Price, 
            post_article.Area, 
            post_article.Date_Begin, 
            post_article.Date_End, 
            post_article.Attachment,
            realty_category.Name AS category,
            city.City_Name AS city,
            district.District_Name AS district
        FROM 
            homehavendb.post_article
        LEFT JOIN 
            homehavendb.realty_category ON post_article.Realty_Category_ID = realty_category.ID
        LEFT JOIN 
            homehavendb.city ON post_article.City_ID = city.ID
        LEFT JOIN 
            homehavendb.district ON post_article.City_ID = district.City_ID
        WHERE 
            post_article.User_ID = ?
    `;
    
    db.query(userArticlesQuery, [userId], (err, result) => {
        if (err) {
            console.error("Database error:", err); // Log lỗi cơ sở dữ liệu
            return res.status(500).send({
                message: "Database error",
                error: err.sqlMessage
            });
        }
        
        console.log("Articles result:", result); // Kiểm tra dữ liệu bài viết trả về từ DB
        
        if (result && result.length > 0) {
            return res.status(200).send({
                articles: result
            });
        } else {
            return res.status(404).send({
                message: 'No articles found for this user'
            });
        }
    });
});



//http://localhost:19006/api/update
// router.put('/update', userMiddleware.validateRegister, (req, res, next) => {
//     const getUserSql = `SELECT ID 
//                         FROM homehavendb.user 
//                         WHERE ID  = ${req.query.ID}`
//     const updateUserSql = `UPDATE homehavendb.user 
//                     SET UserName =' ${req.body.UserName} ', 
//                         Password = ' ${req.body.Password} '
//                     WHERE ID = ${req.query.ID} `
//     const isTakenSql = `SELECT *
//                         FROM homehavendb.user
//                         WHERE UserName = '${req.body.UserName}'`
//     db.query(isTakenSql, (err, result) => {
//         if (err != null) {
//             return res.status(409).send({
//                 message: err.sqlMessage
//             })
//         }
//         if (result != undefined && result.length != 0) {
//             return res.status(409).send({
//                 message: 'UserName nay da ton tai'
//             })
//         } else {
//             db.query(getUserSql, (err, result) => {
//                 if (err != null) {
//                     return res.status(409).send({
//                         message: err.sqlMessage
//                     });
//                 }
//                 if (result[0] != undefined && result.length != 0) {
//                     db.query(updateUserSql, (err, result) => {
//                         if (err != null) {
//                             return res.status(409).send({
//                                 message: err.sqlMessage
//                             });
//                         }
//                         if (result != undefined && result.length != 0) {
//                             return res.status(200).send({
//                                 message: 'Update successfully'
//                             });
//                         }
//                     });
//                 }
//                 else {
//                     return res.status(409).send({
//                         message: 'ID incorrect'
//                     });
//                 }
//             });
//         }
//     })
// });

// http://localhost:19006/api/edit-article/:articleId
router.put('/edit-article/:articleId', userMiddleware.isLoggedIn, (req, res) => {
    const articleId = req.params.articleId;
    const userID = req.userData.ID;
    const { Title, Description, Price, Area, Realty_Category_ID, Attachment, City_ID, District_ID } = req.body;

    console.log("Received update data:", {
        articleId,
        userID,
        Title,
        Description,
        Price,
        Area,
        Realty_Category_ID,
        Attachment,
        City_ID,
        District_ID,
    });

    const categoryCheckQuery = `SELECT ID FROM homehavendb.realty_category WHERE ID = ?`;
    db.query(categoryCheckQuery, [Realty_Category_ID], (err, categoryResult) => {
        if (err) {
            console.error("Database error (checking category):", err);
            return res.status(500).send({ message: "Lỗi cơ sở dữ liệu: " + err.sqlMessage });
        }

        if (Realty_Category_ID && categoryResult.length === 0) {
            console.log("Category ID không tồn tại:", Realty_Category_ID);
            return res.status(404).send({ message: "Danh mục không tồn tại" });
        }

        const updateArticleQuery = `
        UPDATE homehavendb.post_article 
        SET 
            Title = ?, 
            Description = ?, 
            Price = ?, 
            Area = ?, 
            Attachment = ?, 
            Realty_Category_ID = ?, 
            City_ID = ?, 
            District_ID = ?
        WHERE 
            ID = ? AND User_ID = ?
        `;

        db.query(
            updateArticleQuery,
            [
                Title || null,
                Description || null,
                Price || null,
                Area || null,
                Attachment || null,
                Realty_Category_ID || null,
                City_ID || null,
                District_ID || null,
                articleId,
                userID,
            ],
            (err, result) => {
                if (err) {
                    console.error("Error updating article:", err);
                    return res.status(500).send({
                        message: "Lỗi khi cập nhật bài viết: " + err.sqlMessage,
                    });
                }

                if (result.affectedRows > 0) {
                    console.log("Article updated successfully:", { articleId, userID });
                    return res.status(200).send({
                        message: "Bài viết đã được cập nhật thành công!",
                    });
                } else {
                    console.log("Article not found or not authorized:", { articleId, userID });
                    return res.status(404).send({
                        message: "Bài viết không tồn tại hoặc bạn không có quyền chỉnh sửa",
                    });
                }
            }
        );
    });
});








// http://localhost:19006/api/update-profile
router.put('/update-profile', userMiddleware.isLoggedIn, async (req, res) => {
    const { UserName, Email, PhoneNumber, Password, ConfirmPassword } = req.body;

    // Log rõ ràng
    console.log("Request to update profile received");
    console.log("User ID from token:", req.userData.ID);
    console.log("Request body without ConfirmPassword:", { UserName, Email, PhoneNumber, Password });

    if (ConfirmPassword) {
        console.log("ConfirmPassword exists in request body but will not be processed.");
    }

    const userId = req.userData.ID;
    const updateFields = [];
    const updateValues = [];

    if (UserName) {
        updateFields.push("UserName = ?");
        updateValues.push(UserName);
    }

    if (Email) {
        updateFields.push("Email = ?");
        updateValues.push(Email);
    }

    if (PhoneNumber) {
        updateFields.push("PhoneNumber = ?");
        updateValues.push(PhoneNumber);
    }

    if (Password) {
        try {
            const hashedPassword = await bcrypt.hash(Password, saltRounds);
            updateFields.push("Password = ?");
            updateValues.push(hashedPassword);
        } catch (error) {
            return res.status(500).send({ message: "Error hashing password" });
        }
    }

    updateValues.push(userId);

    const updateQuery = `
        UPDATE homehavendb.user 
        SET ${updateFields.join(", ")} 
        WHERE ID = ?
    `;

    db.query(updateQuery, updateValues, (err, result) => {
        if (err) {
            return res.status(500).send({ message: "Database update error", error: err.sqlMessage });
        }

        if (result.affectedRows > 0) {
            return res.status(200).send({ message: "User information updated successfully" });
        } else {
            return res.status(404).send({ message: "User not found or no changes made" });
        }
    });
});

// http://localhost:19006/api/article-detail/:articleId
router.get('/article-detail/:articleId', userMiddleware.isLoggedIn, (req, res) => {
    const articleId = req.params.articleId;
    const userId = req.userData.ID;
  
    const getArticleQuery = `
      SELECT Title, Description, Price, Area, Attachment 
      FROM homehavendb.post_article 
      WHERE ID = ? AND User_ID = ?
    `;
  
    db.query(getArticleQuery, [articleId, userId], (err, result) => {
      if (err) {
        return res.status(500).send({ message: "Database error" });
      }
  
      if (result.length > 0) {
        return res.status(200).send({ article: result[0] });
      } else {
        return res.status(404).send({ message: "Bài viết không tồn tại hoặc bạn không có quyền truy cập" });
      }
    });
  });
  

  // http://localhost:19006/api/article?ID=
router.get('/article', (req, res) => {
    const articleId = req.query.ID;

    if (!articleId) {
        return res.status(400).send({
            message: "ID bài viết không được để trống",
        });
    }

    const detailArticleQuery = `
        SELECT 
            post_article.ID,
            post_article.Title,
            post_article.Description,
            post_article.Price,
            post_article.Area,
            post_article.Attachment,
            post_article.Date_Begin,
            post_article.Date_End,
            realty_category.Name AS Category_Name,
            user.UserName AS UserName,
            user.PhoneNumber AS Phone, -- Thêm số điện thoại của user
            city.City_Name AS City_Name,
            status_article.Name_Status AS Status_Name
        FROM 
            homehavendb.post_article
        JOIN 
            homehavendb.realty_category ON post_article.Realty_Category_ID = realty_category.ID
        JOIN 
            homehavendb.user ON post_article.User_ID = user.ID
        LEFT JOIN 
            homehavendb.city ON post_article.City_ID = city.ID
        LEFT JOIN 
            homehavendb.status_article ON post_article.Status_ID = status_article.ID
        WHERE 
            post_article.ID = ?
    `;

    db.query(detailArticleQuery, [articleId], (err, result) => {
        if (err) {
            return res.status(500).send({
                message: "Database error",
                error: err.sqlMessage,
            });
        }

        if (result && result.length > 0) {
            return res.status(200).send({
                articleDetails: result[0],
            });
        } else {
            return res.status(404).send({
                message: "Không tìm thấy bài viết",
            });
        }
    });
});

// router.delete('/delete-article/:articleId', isLoggedIn, (req, res) => {
//     const articleId = req.params.articleId; // Lấy ID bài viết từ URL
//     const userId = req.userData.ID; // Lấy ID người dùng từ token đã xác thực

//     // Truy vấn xóa bài viết
//     const deleteArticleQuery = `
//         DELETE FROM homehavendb.post_article 
//         WHERE ID = ? 
//           AND User_ID = ?
//     `;

//     // Truy vấn xóa các yêu cầu thuê liên quan
//     const deleteRentalRequestsQuery = `
//         DELETE FROM homehavendb.rental_requests 
//         WHERE Product_ID = ?
//     `;

//     // Kiểm tra xem bài viết có tồn tại và thuộc về người dùng không
//     const checkArticleQuery = `
//         SELECT ID 
//         FROM homehavendb.post_article 
//         WHERE ID = ? 
//           AND User_ID = ?
//     `;

//     db.query(checkArticleQuery, [articleId, userId], (err, result) => {
//         if (err) {
//             return res.status(500).send({
//                 message: "Database error during article check",
//                 error: err.sqlMessage,
//             });
//         }

//         if (result.length === 0) {
//             return res.status(404).send({
//                 message: "Article not found or you are not authorized to delete it",
//             });
//         }

//         // Nếu bài viết tồn tại, tiến hành xóa các yêu cầu thuê liên quan
//         db.query(deleteRentalRequestsQuery, [articleId], (err) => {
//             if (err) {
//                 return res.status(500).send({
//                     message: "Database error during rental requests deletion",
//                     error: err.sqlMessage,
//                 });
//             }

//             // Tiến hành xóa bài viết
//             db.query(deleteArticleQuery, [articleId, userId], (err, result) => {
//                 if (err) {
//                     return res.status(500).send({
//                         message: "Database error during article deletion",
//                         error: err.sqlMessage,
//                     });
//                 }

//                 if (result.affectedRows > 0) {
//                     return res.status(200).send({
//                         message: "Article and associated rental requests deleted successfully",
//                     });
//                 } else {
//                     return res.status(404).send({
//                         message: "Article not found or you are not authorized to delete it",
//                     });
//                 }
//             });
//         });
//     });
// });


// http://localhost:19006/api/rental-request
router.post('/rental-request', userMiddleware.isLoggedIn, (req, res) => {
    const { productID, message } = req.body;
    const userID = req.userData.ID; // ID người thuê từ token

    if (!productID || !message) {
        return res.status(400).send({ message: "Product ID and message are required" });
    }

    const insertRequestQuery = `
        INSERT INTO homehavendb.rental_requests 
        (Product_ID, User_ID, Renter_Name, Renter_Phone, Message, Request_Date)
        VALUES (
            ?, 
            ?, 
            (SELECT UserName FROM homehavendb.user WHERE ID = ?), 
            (SELECT PhoneNumber FROM homehavendb.user WHERE ID = ?), 
            ?, 
            NOW()
        )
    `;

    db.query(insertRequestQuery, [productID, userID, userID, userID, message], (err, result) => {
        if (err) {
            return res.status(500).send({
                message: "Database error",
                error: err.sqlMessage,
            });
        }

        return res.status(201).send({
            message: "Rental request created successfully",
        });
    });
});

  

  // http://localhost:19006/api/notifications
router.get('/notifications', userMiddleware.isLoggedIn, (req, res) => {
    const userId = req.userData.ID; // ID người dùng từ token

    const fetchNotificationsQuery = `
        SELECT 
            rental_requests.ID AS Request_ID,
            rental_requests.Renter_Name,
            rental_requests.Renter_Phone,
            rental_requests.Message,
            rental_requests.Request_Date,
            post_article.ID AS Product_ID,
            post_article.Title AS Product_Title
        FROM 
            homehavendb.rental_requests
        JOIN 
            homehavendb.post_article ON rental_requests.Product_ID = post_article.ID
        WHERE 
            post_article.User_ID = ?
        ORDER BY rental_requests.Request_Date DESC
    `;

    db.query(fetchNotificationsQuery, [userId], (err, result) => {
        if (err) {
            return res.status(500).send({
                message: "Database query error",
                error: err.sqlMessage,
            });
        }

        return res.status(200).send({
            notifications: result,
        });
    });
});
  
// http://localhost:19006/api/delete-notification/:requestId
router.delete('/delete-notification/:requestId', userMiddleware.isLoggedIn, (req, res) => {
    const requestId = req.params.requestId;

    const deleteRequestQuery = `
        DELETE FROM homehavendb.rental_requests 
        WHERE ID = ?
    `;

    db.query(deleteRequestQuery, [requestId], (err, result) => {
        if (err) {
            return res.status(500).send({
                message: "Database error",
                error: err.sqlMessage,
            });
        }

        if (result.affectedRows > 0) {
            return res.status(200).send({
                message: "Request deleted successfully",
            });
        } else {
            return res.status(404).send({
                message: "Request not found",
            });
        }
    });
});

// http://localhost:19006/api/approve-request/:id
router.put('/approve-request/:id', userMiddleware.isLoggedIn, (req, res) => {
    const requestId = req.params.id; // ID yêu cầu cần phê duyệt
    const userId = req.userData.ID; // ID người dùng từ token xác thực

    console.log("Request to approve rental request:", { requestId, userId }); // Log thông tin để debug

    // Truy vấn kiểm tra yêu cầu thuê và quyền sở hữu
    const checkRequestQuery = `
        SELECT 
            rental_requests.ID AS Request_ID,
            rental_requests.Product_ID,
            post_article.User_ID AS Article_Owner
        FROM 
            homehavendb.rental_requests
        JOIN 
            homehavendb.post_article ON rental_requests.Product_ID = post_article.ID
        WHERE 
            rental_requests.ID = ?
            AND post_article.User_ID = ?;
    `;

    db.query(checkRequestQuery, [requestId, userId], (err, result) => {
        if (err) {
            console.error("Database error in checkRequestQuery:", err);
            return res.status(500).send({
                message: "Lỗi cơ sở dữ liệu khi kiểm tra yêu cầu",
                error: err.sqlMessage,
            });
        }

        if (result.length === 0) {
            console.warn("Không tìm thấy yêu cầu hoặc không có quyền:", { requestId, userId });
            return res.status(404).send({
                message: "Không tìm thấy yêu cầu hoặc bạn không có quyền phê duyệt yêu cầu này",
            });
        }

        console.log("Request is valid, proceeding to update status");

        // Nếu hợp lệ, cập nhật trạng thái yêu cầu thành "Đã cho thuê" (ID = 4)
        const updateStatusQuery = `
            UPDATE homehavendb.rental_requests 
            SET Status_ID = 4 -- "Đã cho thuê"
            WHERE ID = ?;
        `;
        
        db.query(updateStatusQuery, [requestId], (err, updateResult) => {
            if (err) {
                console.error("Database error while updating request status:", err);
                return res.status(500).send({
                    message: "Lỗi cơ sở dữ liệu khi cập nhật trạng thái yêu cầu",
                    error: err.sqlMessage,
                });
            }
        
            console.log("Update result:", updateResult); // Log kết quả cập nhật
            if (updateResult.affectedRows > 0) {
                console.info("Yêu cầu thuê đã được phê duyệt:", requestId);
                return res.status(200).send({
                    message: "Yêu cầu thuê đã được phê duyệt thành công!",
                });
            } else {
                console.warn("Không tìm thấy yêu cầu hoặc không thể cập nhật trạng thái:", requestId);
                return res.status(404).send({
                    message: "Không tìm thấy yêu cầu hoặc không thể cập nhật trạng thái",
                });
            }
        });
    });
});

//  danh sách danh mục cho thuê http://localhost:19006/api/realty-categories (api mới 12/11/24)
router.get('/realty-categories', (req, res) => {
    const query = `SELECT ID, Name FROM homehavendb.realty_category`;
    db.query(query, (err, result) => {
        if (err) {
            return res.status(500).send({
                message: "Lỗi cơ sở dữ liệu khi lấy danh mục",
                error: err.sqlMessage,
            });
        }
        return res.status(200).send({ categories: result });
    });
});

//  danh sách tỉnh/thành phố http://localhost:19006/api/cities (api mới 12/11/24)
router.get('/cities', (req, res) => {
    const query = `SELECT ID, City_Name FROM homehavendb.city`;
    db.query(query, (err, result) => {
        if (err) {
            return res.status(500).send({
                message: "Lỗi cơ sở dữ liệu khi lấy tỉnh/thành phố",
                error: err.sqlMessage,
            });
        }
        return res.status(200).send({ cities: result });
    });
});

//danh sách quận/huyện theo ID tỉnh/thành phố http://localhost:19006/api/districts/${cityId} (api mới 12/11/24)
router.get('/districts/:cityId', (req, res) => {
    const cityId = req.params.cityId;
    const query = `SELECT ID, District_Name FROM homehavendb.district WHERE City_ID = ?`;
    db.query(query, [cityId], (err, result) => {
        if (err) {
            return res.status(500).send({
                message: "Lỗi cơ sở dữ liệu khi lấy quận/huyện",
                error: err.sqlMessage,
            });
        }
        return res.status(200).send({ districts: result });
    });
});

//danh sách phường/xã theo ID quận/huyện http://localhost:19006/api/wards/${districtId} (api mới 12/11/24)
router.get('/wards/:districtId', (req, res) => {
    const districtId = req.params.districtId;
    const query = `SELECT ID, Ward_Name FROM homehavendb.ward WHERE District_ID = ?`;
    db.query(query, [districtId], (err, result) => {
        if (err) {
            return res.status(500).send({
                message: "Lỗi cơ sở dữ liệu khi lấy phường/xã",
                error: err.sqlMessage,
            });
        }
        return res.status(200).send({ wards: result });
    });
});


module.exports = router;