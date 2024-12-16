const express = require('express');
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { isLoggedIn } = require('../middleware/users.js');
const saltRounds = 10;

const db = require('../lib/db.js');
const userMiddleware = require('../middleware/users.js');

// http://localhost:16009/api/sign-up
router.post('/sign-up', userMiddleware.validateRegister, (req, res) => {
    const db_email = `SELECT * FROM homehavendb.user WHERE LOWER(Email) = LOWER(${db.escape(req.body.Email)})`;

    db.query(db_email, (err, result) => {
        if (err) {
            return res.status(500).send({ message: "Database query error" });
        }

        if (result.length > 0) {
            return res.status(409).send({ message: "Email này đã được sử dụng" });
        }

        bcrypt.hash(String(req.body.Password), 10, (err, hash) => {
            if (err) {
                return res.status(500).send({ message: "Hashing error" });
            }

            const rawSql = `INSERT INTO homehavendb.user (UserName, Email, Password, PhoneNumber) VALUES (?, ?, ?, ?)`;
            db.query(rawSql, [req.body.UserName, req.body.Email, hash, req.body.PhoneNumber], (err) => { 
                if (err) {
                    return res.status(500).send({ message: "Database insertion error" });
                }
                return res.status(201).send({ message: "Đăng ký thành công!" });
            });
        });
    });
});

// http://localhost:16009/api/login
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

// http://localhost:16009/api/get-items
router.get('/get-items', (req, res) => {
    const db_list_items = `
    SELECT 
        post_article.ID,
        post_article.Title,
        post_article.Attachment,
        post_article.Price,
        post_article.Description,
        realty_category.Name AS category,
        address.Address_Number,
        address.Street,
        address.Ward,
        address.District,
        address.City,
        user.UserName AS UserName,
        post_article.Status_ID
    FROM 
        homehavendb.post_article
    JOIN 
        homehavendb.realty_category 
    ON 
        post_article.Realty_Category_ID = realty_category.ID
    JOIN 
        homehavendb.user 
    ON 
        post_article.User_ID = user.ID
    LEFT JOIN
        homehavendb.address
    ON
        post_article.Address_ID = address.ID
    WHERE 
        post_article.Status_ID != 4;
    `;

    db.query(db_list_items, (err, result) => {
        if (err) {
            console.error("Database query error:", err); 
            return res.status(500).send({
                message: err.sqlMessage || "Internal server error"
            });
        }

        console.log("Database query result:", result);

        if (result && result.length > 0) {
            return res.status(200).send({
                result: result
            });
        } else {
            console.warn("No items found in database query result.");
            return res.status(404).send({
                message: "No items found"
            });
        }
    });
});

// http://localhost:16009/api/realty-categories (Danh sách danh mục cho thuê)
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

// http://localhost:16009/api/user-info
router.get('/user-info', userMiddleware.isLoggedIn, (req, res) => {
    const userId = req.userData.ID; 

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
            userName: result[0].UserName,
            email: result[0].Email,
            phoneNumber: result[0].PhoneNumber,
        });
    });
});

// Các API còn lại được cập nhật phù hợp với bảng Address, giữ nguyên logic xử lý và API không yêu cầu thay đổi

// http://localhost:16009/api/post-article
router.post('/post-article', isLoggedIn, (req, res) => {
    const { title, description, price, area, category, attachment, address } = req.body;
    const userID = req.userData.ID;

    const categoryQuery = `SELECT ID FROM homehavendb.realty_category WHERE LOWER(TRIM(Name)) = LOWER(TRIM(?))`;
    db.query(categoryQuery, [category], (err, categoryResult) => {
        if (err) {
            return res.status(500).send({
                message: "Database error: " + err.sqlMessage
            });
        }

        if (categoryResult.length === 0) {
            return res.status(404).send({
                message: "Category not found"
            });
        }

        const categoryID = categoryResult[0].ID;

        const normalizedCity = address.City.trim().toLowerCase();
        const normalizedDistrict = address.District.trim().toLowerCase();

        // Kiểm tra xem địa chỉ đã tồn tại hay chưa
        const checkAddressQuery = `
            SELECT ID 
            FROM homehavendb.address 
            WHERE LOWER(TRIM(Address_Number)) = LOWER(TRIM(?))
              AND LOWER(TRIM(Street)) = LOWER(TRIM(?))
              AND LOWER(TRIM(Ward)) = LOWER(TRIM(?))
              AND LOWER(TRIM(District)) = LOWER(TRIM(?))
              AND LOWER(TRIM(City)) = LOWER(TRIM(?))
        `;

        db.query(
            checkAddressQuery,
            [address.Address_Number, address.Street, address.Ward, address.District, address.City],
            (err, existingAddressResult) => {
                if (err) {
                    return res.status(500).send({
                        message: "Database error while checking address: " + err.sqlMessage
                    });
                }

                let addressID;

                if (existingAddressResult.length > 0) {
                    // Địa chỉ đã tồn tại, sử dụng ID của địa chỉ này
                    addressID = existingAddressResult[0].ID;
                    insertArticle();
                } else {
                    // Địa chỉ chưa tồn tại, thêm mới địa chỉ
                    const addressInsertQuery = `
                        INSERT INTO homehavendb.address 
                        (Address_Number, Street, Ward, District, City)
                        VALUES (?, ?, ?, ?, ?)
                    `;
                    db.query(
                        addressInsertQuery,
                        [address.Address_Number, address.Street, address.Ward, address.District, address.City],
                        (err, addressResult) => {
                            if (err) {
                                return res.status(500).send({
                                    message: "Database error while inserting address: " + err.sqlMessage
                                });
                            }

                            addressID = addressResult.insertId;
                            insertArticle();
                        }
                    );
                }

                // Thêm bài viết mới
                const insertArticle = () => {
                    const insertArticleQuery = `
                        INSERT INTO homehavendb.post_article 
                        (User_ID, Realty_Category_ID, Title, Description, Price, Area, Attachment, Date_Begin, Status_ID, Address_ID)
                        VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?)
                    `;
                    const statusID = 1; // Trạng thái mặc định là "Chờ duyệt"

                    db.query(
                        insertArticleQuery,
                        [userID, categoryID, title, description, price, area, attachment, statusID, addressID],
                        (err, result) => {
                            if (err) {
                                return res.status(500).send({
                                    message: "Error inserting article: " + err.sqlMessage
                                });
                            }

                            return res.status(201).send({
                                message: "Bài viết đã được đăng thành công!",
                                articleID: result.insertId
                            });
                        }
                    );
                };
            }
        );
    });
});


// http://localhost:16009/api/my-articles
router.get('/my-articles', isLoggedIn, (req, res) => {
    const userId = req.userData.ID;

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
            address.Address_Number,
            address.Street,
            address.Ward,
            address.District,
            address.City
        FROM 
            homehavendb.post_article
        LEFT JOIN 
            homehavendb.realty_category ON post_article.Realty_Category_ID = realty_category.ID
        LEFT JOIN 
            homehavendb.address ON post_article.Address_ID = address.ID
        WHERE 
            post_article.User_ID = ?
    `;

    db.query(userArticlesQuery, [userId], (err, result) => {
        if (err) {
            return res.status(500).send({
                message: "Database error",
                error: err.sqlMessage
            });
        }

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

// http://localhost:16009/api/update-profile
router.put('/update-profile', isLoggedIn, async (req, res) => {
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

// http://localhost:16009/api/edit-article/:articleId
router.put('/edit-article/:articleId', isLoggedIn, (req, res) => {
    const articleId = req.params.articleId;
    const userID = req.userData.ID;
    const {
        Title,
        Description,
        Price,
        Area,
        Realty_Category_ID,
        Attachment,
        address,
    } = req.body;

    console.log("Received update data:", {
        articleId,
        userID,
        Title,
        Description,
        Price,
        Area,
        Realty_Category_ID,
        Attachment,
        address,
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

        const updateAddressQuery = `
            UPDATE homehavendb.address 
            SET 
                Address_Number = ?, 
                Street = ?, 
                Ward = ?, 
                District = ?, 
                City = ?
            WHERE 
                ID = (SELECT Address_ID FROM homehavendb.post_article WHERE ID = ? AND User_ID = ?)
        `;
        const { Address_Number, Street, Ward, District, City } = address;

        db.query(updateAddressQuery, [Address_Number, Street, Ward, District, City, articleId, userID], (err, addressResult) => {
            if (err) {
                console.error("Error updating address:", err);
                return res.status(500).send({ message: "Lỗi khi cập nhật địa chỉ: " + err.sqlMessage });
            }

            const updateArticleQuery = `
                UPDATE homehavendb.post_article 
                SET 
                    Title = ?, 
                    Description = ?, 
                    Price = ?, 
                    Area = ?, 
                    Attachment = ?, 
                    Realty_Category_ID = ?
                WHERE 
                    ID = ? AND User_ID = ?
            `;

            db.query(
                updateArticleQuery,
                [Title, Description, Price, Area, Attachment, Realty_Category_ID, articleId, userID],
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
});

// http://localhost:16009/api/article?ID=
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
            user.PhoneNumber AS Phone, 
            address.Address_Number,
            address.Street,
            address.Ward AS District,
            address.District AS City,
            address.City AS Province,
            status_article.Name_Status AS Status_Name
        FROM 
            homehavendb.post_article
        JOIN 
            homehavendb.realty_category ON post_article.Realty_Category_ID = realty_category.ID
        JOIN 
            homehavendb.user ON post_article.User_ID = user.ID
        LEFT JOIN 
            homehavendb.address ON post_article.Address_ID = address.ID
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

// http://localhost:16009/api/delete-article/:articleId
router.delete('/delete-article/:articleId', isLoggedIn, (req, res) => {
    const articleId = req.params.articleId; // ID bài viết
    const userId = req.userData.ID; // ID người dùng từ token đã xác thực

    // Truy vấn xóa yêu cầu thuê liên quan
    const deleteRentalRequestsQuery = `
        DELETE FROM homehavendb.rental_requests 
        WHERE Product_ID = ?;
    `;

    // Truy vấn xóa bài viết
    const deleteArticleQuery = `
        DELETE FROM homehavendb.post_article 
        WHERE ID = ? AND User_ID = ?;
    `;

    // Xóa các yêu cầu thuê liên quan trước
    db.query(deleteRentalRequestsQuery, [articleId], (err) => {
        if (err) {
            console.error("Database error while deleting rental requests:", err);
            return res.status(500).send({
                message: "Lỗi khi xóa yêu cầu thuê liên quan.",
                error: err.sqlMessage,
            });
        }

        // Sau khi xóa các yêu cầu thuê, tiến hành xóa bài viết
        db.query(deleteArticleQuery, [articleId, userId], (err, result) => {
            if (err) {
                console.error("Database error while deleting article:", err);
                return res.status(500).send({
                    message: "Lỗi khi xóa bài viết.",
                    error: err.sqlMessage,
                });
            }

            if (result.affectedRows > 0) {
                return res.status(200).send({
                    message: "Xóa bài viết và các yêu cầu thuê liên quan thành công.",
                });
            } else {
                return res.status(404).send({
                    message: "Không tìm thấy bài viết hoặc bạn không có quyền xóa bài viết này.",
                });
            }
        });
    });
});

// http://localhost:16009/api/notifications
router.get('/notifications', isLoggedIn, (req, res) => {
    const userId = req.userData.ID;

    // Truy vấn để lấy danh sách thông báo
    const fetchNotificationsQuery = `
        SELECT 
            rental_requests.ID AS Request_ID,
            rental_requests.Renter_Name,
            rental_requests.Renter_Phone,
            rental_requests.Message,
            rental_requests.Request_Date,
            post_article.ID AS Product_ID,
            post_article.Title AS Product_Title,
            rental_requests.Status_ID
        FROM 
            homehavendb.rental_requests
        JOIN 
            homehavendb.post_article ON rental_requests.Product_ID = post_article.ID
        WHERE 
            post_article.User_ID = ? 
        ORDER BY rental_requests.Request_Date DESC;
    `;

    db.query(fetchNotificationsQuery, [userId], (err, result) => {
        if (err) {
            console.error("[ERROR] Database query error:", err);
            return res.status(500).send({
                message: "Lỗi cơ sở dữ liệu khi truy vấn thông báo.",
                error: err.sqlMessage,
            });
        }

        if (!result || result.length === 0) {
            console.warn("[INFO] Không tìm thấy thông báo cho user ID:", userId);
            return res.status(404).send({ message: "Không có thông báo nào." });
        }

        try {
            // Chia thông báo dựa trên Status_ID
            const pendingRentals = result.filter((r) => r.Status_ID === 5); // Chưa cho thuê
            const approvedRentals = result.filter((r) => r.Status_ID === 4); // Đã cho thuê

            console.info("[INFO] Thông báo phân loại thành công.");
            return res.status(200).send({
                pendingRentals,
                approvedRentals,
            });
        } catch (error) {
            console.error("[ERROR] Lỗi xử lý dữ liệu thông báo:", error);
            return res.status(500).send({
                message: "Lỗi khi xử lý thông báo.",
                error: error.message,
            });
        }
    });
});

// http://localhost:16009/api/delete-notification/:requestId
router.delete('/delete-notification/:requestId', isLoggedIn, (req, res) => {
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

// http://localhost:16009/api/approve-request/:id
router.put('/approve-request/:id', isLoggedIn, (req, res) => {
    const requestId = req.params.id;
    const userId = req.userData.ID;

    console.log("[INFO] Phê duyệt yêu cầu thuê:", { requestId, userId });

    const checkRequestQuery = `
        SELECT 
            rental_requests.Product_ID, 
            rental_requests.User_ID AS Renter_ID,
            post_article.Title AS Product_Title
        FROM 
            homehavendb.rental_requests
        JOIN 
            homehavendb.post_article 
        ON 
            rental_requests.Product_ID = post_article.ID
        WHERE 
            rental_requests.ID = ? 
            AND post_article.User_ID = ?;
    `;

    db.query(checkRequestQuery, [requestId, userId], (err, result) => {
        if (err) {
            console.error("[ERROR] Lỗi cơ sở dữ liệu khi kiểm tra yêu cầu:", err);
            return res.status(500).send({ message: "Lỗi cơ sở dữ liệu khi kiểm tra yêu cầu thuê." });
        }

        if (result.length === 0) {
            console.warn("[WARNING] Không tìm thấy yêu cầu hoặc không có quyền phê duyệt:", { requestId, userId });
            return res.status(404).send({ message: "Không tìm thấy yêu cầu hoặc không có quyền phê duyệt." });
        }

        const { Product_ID, Renter_ID, Product_Title } = result[0];
        console.info("[INFO] Yêu cầu thuê hợp lệ:", { Product_ID, Renter_ID, Product_Title });

        const updateRentalRequestQuery = `
            UPDATE homehavendb.rental_requests 
            SET Status_ID = 4 
            WHERE ID = ?;
        `;

        const deleteOtherRequestsQuery = `
            DELETE FROM homehavendb.rental_requests 
            WHERE Product_ID = ? AND ID != ?;
        `;

        const updatePostArticleQuery = `
            UPDATE homehavendb.post_article 
            SET Status_ID = 4 
            WHERE ID = ?;
        `;

        // Cập nhật trạng thái yêu cầu được phê duyệt
        db.query(updateRentalRequestQuery, [requestId], (err) => {
            if (err) {
                console.error("[ERROR] Lỗi khi cập nhật trạng thái yêu cầu thuê:", err);
                return res.status(500).send({ message: "Lỗi cơ sở dữ liệu khi cập nhật trạng thái yêu cầu thuê." });
            }

            // Xóa các yêu cầu khác cho cùng một bài viết
            db.query(deleteOtherRequestsQuery, [Product_ID, requestId], (err) => {
                if (err) {
                    console.error("[ERROR] Lỗi khi xóa các yêu cầu thuê khác:", err);
                    return res.status(500).send({ message: "Lỗi cơ sở dữ liệu khi xóa các yêu cầu thuê khác." });
                }

                // Cập nhật trạng thái bài viết
                db.query(updatePostArticleQuery, [Product_ID], (err) => {
                    if (err) {
                        console.error("[ERROR] Lỗi khi cập nhật trạng thái bài viết:", err);
                        return res.status(500).send({ message: "Lỗi cơ sở dữ liệu khi cập nhật trạng thái bài viết." });
                    }

                    console.info("[INFO] Trạng thái yêu cầu và bài viết đã được cập nhật thành công.");
                    res.status(200).send({ message: "Yêu cầu thuê đã được duyệt thành công." });
                });
            });
        });
    });
});

// http://localhost:16009/api/user-messages
router.get('/user-messages', isLoggedIn, (req, res) => {
    const userId = req.userData.ID;

    const fetchMessagesQuery = `
        SELECT 
            ID AS Log_ID,
            Action_Description AS Message_Content,
            Create_by,
            Create_at AS Timestamp
        FROM 
            homehavendb.user_log
        WHERE 
            User_ID = ?
        ORDER BY 
            Create_at DESC;
    `;

    db.query(fetchMessagesQuery, [userId], (err, result) => {
        if (err) {
            console.error("Lỗi cơ sở dữ liệu:", err);
            return res.status(500).send({ message: "Lỗi cơ sở dữ liệu" });
        }

        res.status(200).send({ messages: result });
    });
});

// http://localhost:16009/api/rental-request
router.post('/rental-request', isLoggedIn, (req, res) => {
    const { productID, message } = req.body;
    const userID = req.userData.ID;

    if (!productID || !message) {
        return res.status(400).send({ message: "Thiếu Product ID hoặc nội dung." });
    }

    // Thêm yêu cầu thuê mà không giới hạn 1 người dùng
    const insertRequestQuery = `
        INSERT INTO homehavendb.rental_requests 
        (Product_ID, User_ID, Renter_Name, Renter_Phone, Message, Status_ID, Request_Date)
        VALUES (
            ?, 
            ?, 
            (SELECT UserName FROM homehavendb.user WHERE ID = ?), 
            (SELECT PhoneNumber FROM homehavendb.user WHERE ID = ?), 
            ?, 
            5, -- Status_ID mặc định là "5" (chưa cho thuê)
            NOW()
        )
    `;

    // Chèn yêu cầu thuê vào database
    db.query(insertRequestQuery, [productID, userID, userID, userID, message], (err, result) => {
        if (err) {
            console.error("Lỗi khi tạo yêu cầu thuê:", err);
            return res.status(500).send({
                message: "Lỗi cơ sở dữ liệu khi tạo yêu cầu thuê.",
                error: err.sqlMessage,
            });
        }

        console.log("Yêu cầu thuê được tạo thành công:", result);
        return res.status(201).send({
            message: "Tạo yêu cầu thuê thành công!",
        });
    });
});

// Danh sách tỉnh/thành phố http://localhost:16009/api/cities (ko xài)
// router.get('/cities', (req, res) => {
//     // Truy vấn lấy tất cả các tỉnh/thành phố từ bảng address
//     const query = `
//         SELECT DISTINCT 
//             LOWER(TRIM(City)) AS normalizedCity, -- Chuẩn hóa chữ thường, xóa khoảng trắng thừa
//             City 
//         FROM 
//             homehavendb.address 
//         WHERE 
//             City IS NOT NULL
//     `;

//     db.query(query, (err, result) => {
//         if (err) {
//             return res.status(500).send({
//                 message: "Lỗi cơ sở dữ liệu khi lấy tỉnh/thành phố",
//                 error: err.sqlMessage,
//             });
//         }

//         // Sử dụng Map để loại bỏ trùng lặp dựa trên giá trị chuẩn hóa
//         const uniqueCitiesMap = new Map();
//         result.forEach((row) => {
//             const normalizedCity = row.normalizedCity; // Giá trị đã chuẩn hóa (chữ thường)
//             if (!uniqueCitiesMap.has(normalizedCity)) {
//                 uniqueCitiesMap.set(normalizedCity, row.City); // Giữ giá trị gốc từ bảng
//             }
//         });

//         // Chuyển Map thành danh sách các thành phố duy nhất
//         const cities = Array.from(uniqueCitiesMap.values()).map((cityName, index) => ({
//             ID: index + 1, // Tạo ID giả lập bắt đầu từ 1
//             City_Name: cityName,
//         }));

//         return res.status(200).send({ cities });
//     });
// });

// Danh sách quận/huyện tìm kẹp với tỉnh/thành phố http://localhost:16009/api/districts/${cityId} (ko xài)
// router.get('/districts/:cityId', (req, res) => {
//     const cityId = req.params.cityId;

//     // Lấy District từ bảng address theo City
//     const query = `
//         SELECT DISTINCT 
//             LOWER(TRIM(District)) AS normalizedDistrict, -- Chuẩn hóa chữ thường và xóa khoảng trắng
//             District 
//         FROM 
//             homehavendb.address 
//         WHERE 
//             LOWER(TRIM(City)) = (
//                 SELECT LOWER(TRIM(City)) 
//                 FROM homehavendb.address 
//                 WHERE ID = ?
//             )
//             AND District IS NOT NULL
//     `;

//     db.query(query, [cityId], (err, result) => {
//         if (err) {
//             return res.status(500).send({
//                 message: "Lỗi cơ sở dữ liệu khi lấy quận/huyện",
//                 error: err.sqlMessage,
//             });
//         }

//         // Sử dụng Map để loại bỏ các giá trị trùng lặp
//         const uniqueDistrictsMap = new Map();
//         result.forEach((row) => {
//             const normalizedDistrict = row.normalizedDistrict;
//             if (!uniqueDistrictsMap.has(normalizedDistrict)) {
//                 uniqueDistrictsMap.set(normalizedDistrict, row.District);
//             }
//         });

//         // Tạo danh sách kết quả
//         const districts = Array.from(uniqueDistrictsMap.values()).map((districtName, index) => ({
//             ID: index + 1, // Tạo ID giả lập
//             District_Name: districtName,
//         }));

//         return res.status(200).send({ districts });
//     });
// });




module.exports = router;
