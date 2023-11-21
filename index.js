import Express from "express";
import cors from "cors";
import { MongoClient, ServerApiVersion, ObjectId } from "mongodb";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
dotenv.config();

const app = Express();
const port = process.env.PORT || 5000;

app.use(
    cors({
        origin: [
            "http://localhost:5100",
            "http://localhost:5173",
            "http://localhost:5174",
            "http://localhost:5175",
            "https://technest-blog.web.app",
            "https://technest-blog.firebaseapp.com",
        ], // The domains where the client side will run

        credentials: true, // This will help to set cookies
    })
);

app.use(Express.json());
app.use(cookieParser());

/*

*/

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.cx7zh4x.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});

function extractuserEmail(req, method) {
    if (method === "GET" || method === "DELETE") {
        return req.query.email || "";
    } else if (method === "POST" || method === "PUT" || method === "PATCH") {
        return req.body.email || "";
    } else {
        return "";
    }
}

function extractuserId(req, method) {
    if (method === "GET" || method === "DELETE") {
        return req.query.userId || "";
    } else if (method === "POST" || method === "PUT" || method === "PATCH") {
        return req.body.userId || "";
    } else {
        return "";
    }
}

// middlewares
const verifyToken = async (req, res, next) => {
    const token = req.cookies?.token;

    if (!token) {
        return res.status(401).send({ message: "unauthorized" });
    }

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        //    error
        if (err) {
            console.log(err);
            return res.status(401).send({ message: "unauthorized" });
        }

        req.user = decoded;

        // if its valid it will be decoded
        next();
    });
};

const requestValidate = async (req, res, next) => {
    const method = req.method;

    let decoded_Email = req.user?.userEmail;
    let decoded_UserId = req.user?.userId;

    const userEmail = extractuserEmail(req, method);

    const userId = extractuserId(req, method);

    const requestedUrl = req.originalUrl;
    // console.log({
    //     method,
    //     requestedUrl,
    //     decoded: { decoded_Email, decoded_UserId },
    //     url: { userEmail, userId },
    // });

    if (decoded_Email !== userEmail && decoded_UserId !== userId) {
        return res.status(401).send({ message: "unauthorized" });
    }

    // console.log(200, "Authorized successfully.");
    next();
};

// validate the token with query info. If matched calls to
const validateAndWishlistData02 = async (req, res, next) => {
    const token = req.cookies?.token;
    // req.user = null;

    const userEmail = extractuserEmail(req, method);
    const userId = extractuserId(req, method);

    if (token) {
        jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
            if (err) {
                console.log("Invalid token");
                console.log(err);
            } else {
                if (decoded.userEmail !== userEmail && decoded.userId !== userId) {
                    return res.status(401).send({ message: "unauthorized" });
                }

                req.user = decoded;
                next();
            }
        });
    }
    next();
};

// validate the token with query info. If matched calls to
const validateAndWishlistData = async (req, res, next) => {
    /*
    Ekhane token theke info extract kora hocche.
    Token valid hole ota req.user e set kora hbe, otherwise null theke jabe. 

    Tarpor req.user theke sohoje wishlist er jnno user id fetch kore show kora jabe.
    */

    const token = req.cookies?.token;
    req.user = null;

    // console.log("tokeeen ", token);

    if (token) {
        jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
            if (err) {
                console.log("Invalid token");
                console.log(err);
            } else {
                req.user = decoded;
            }
        });
    }
    next();
};

async function mainProcess() {
    try {
        // await client.connect();
        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");

        const allBlogs = client.db("a11-technest").collection("blogs");
        const editorsPick = client.db("a11-technest").collection("editors-pick");
        const wishlist = client.db("a11-technest").collection("wishlist");
        const comments = client.db("a11-technest").collection("comments");
        const categoryNames = client.db("a11-technest").collection("category-names");

        // Authenticating
        app.post("/authenticate", async (req, res) => {
            const userEmail = req.body.email;
            const userId = req.body.userId;

            // console.log("from authenticate body email ", { userEmail, userId });

            const token = jwt.sign({ userEmail, userId }, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: "24h",
            });

            // For localhost
            const cookieOptionsLocal = {
                httpOnly: true, // jehetu localhost tai http only
                secure: false, // localhost tai secure false
                sameSite: false, // localhost and server er port different tai none
            };

            // const cookieOptionsProd = {
            //     httpOnly: true,
            //     secure: true,
            //     sameSite: "none",
            //     maxAge: 24 * 60 * 60 * 1000,
            // };
            // production
            const cookieOptionsProd = {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
            };

            res.cookie("token", token, cookieOptionsProd);

            res.send({ success: true });
        });

        // Logout
        app.post("/logout", async (req, res) => {
            // res.clearCookie("token", { maxAge: 0 });
            res.clearCookie("token", {
                maxAge: 0,
                secure: process.env.NODE_ENV === "production" ? true : false,
                sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
            });

            res.send({ success: true });
        });

        // all blog Data Fetch
        // open api
        // sort and return
        app.get("/allblogs", validateAndWishlistData, async (req, res) => {
            // For testing purpose
            console.log("All blogs requested");

            // Search Data Collecting
            const searchTitle = req.query.searchTitle;
            let searchCategories = req.query.categories;
            let sort_Date = req.query.sort_Date;

            const sortTimeOrder =
                sort_Date === "descending" ? -1 : sort_Date === "ascending" ? 1 : -1;

            console.log(req.query);

            let allBlogsList = [];
            let searchedBlogs = true;

            if (!searchTitle && !searchCategories) {
                // Return all data.
                const query = {};

                const cursor = allBlogs.find(query);
                cursor.sort({ creationTime: sortTimeOrder });
                allBlogsList = await cursor.toArray();
                searchedBlogs = false;
            } else {
                // return search data
                let query = {};
                const options = {
                    sort: {
                        creationTime: sortTimeOrder,
                    },
                };

                if (searchTitle) {
                    query.title = { $regex: searchTitle, $options: "i" };
                }

                if (searchCategories) {
                    query.category = { $in: searchCategories.split(",") };
                }

                allBlogsList = await allBlogs.find(query, options).toArray();
            }

            // if user logged in there must be a token and it has been verified previously
            // But if the user is not logged in, there will be no token and no data in req.user
            // so the user id will be available in req.user and its simple to fetch wishlist data using that user id.
            if (req.user) {
                const userId = req.user.userId;
                const wishlistQuery = { userId: userId };
                const wishListData = await wishlist.findOne(wishlistQuery);

                // No wishlist data available for that user, thats why its null
                if (!wishListData) {
                    // console.log("No wishlist data available");
                    return res.send(allBlogsList);
                } else {
                    const wishLists = wishListData.wishLists;
                    // console.log("wishLists", wishLists);

                    // Now wishlists data will merge with the blogs data
                    let updatedAllBlogsList = [];

                    allBlogsList.forEach((blogData) => {
                        wishLists.forEach((wishlistBlogId) => {
                            if (blogData._id.equals(wishlistBlogId)) {
                                blogData.wishlist = true;
                            }
                        });

                        if (!blogData.wishlist) {
                            blogData.wishlist = false;
                        }

                        updatedAllBlogsList.push(blogData);
                    });

                    return res.send({ searchedBlogs, allBlogs: updatedAllBlogsList });
                }
            } else {
                return res.send({ searchedBlogs, allBlogs: allBlogsList });
            }
        });

        // search blogs by title and category
        // open api
        app.get("/filterblogs", validateAndWishlistData, async (req, res) => {
            console.log(req.query);
            return;
            const searchTitle = req.query.searchTitle;

            let searchCategories = req.query.categories;
            let sort_Date = req.query.sort_Date;
            let sortTimeOrder = -1;

            if (sort_Date === "descending") {
                sortTimeOrder = -1;
            } else if (sort_Date === "ascending") {
                sortTimeOrder = 1;
            }

            let query = {};
            const options = {
                sort: {
                    creationTime: sortTimeOrder,
                },
            };

            if (searchTitle) {
                query.title = { $regex: searchTitle, $options: "i" };
            }

            if (searchCategories) {
                query.category = { $in: searchCategories.split(",") };
            }

            console.log(req.query);
            console.log(query);

            const allBlogsList = await allBlogs.find(query, options).toArray();

            // if user logged in there must be a token and it has been verified previously
            // But if the user is not logged in, there will be no token and no data in req.user
            // so the user id will be available in req.user and its simple to fetch wishlist data using that user id.
            if (req.user) {
                const userId = req.user.userId;
                const wishlistQuery = { userId: userId };
                const wishListData = await wishlist.findOne(wishlistQuery);

                // No wishlist data available for that user, thats why its null
                if (!wishListData) {
                    return res.send(allBlogsList);
                } else {
                    const wishLists = wishListData.wishLists;

                    // Now wishlists data will merge with the blogs data
                    let updatedAllBlogsList = [];

                    allBlogsList.forEach((blogData) => {
                        wishLists.forEach((wishlistBlogId) => {
                            if (blogData._id.equals(wishlistBlogId)) {
                                blogData.wishlist = true;
                            }
                        });

                        if (!blogData.wishlist) {
                            blogData.wishlist = false;
                        }

                        updatedAllBlogsList.push(blogData);
                    });

                    return res.send(updatedAllBlogsList);
                }
            } else {
                return res.send(allBlogsList);
            }
        });

        // recent blog Data Fetch
        // open api
        // sort and return
        app.get("/recent-blogs", validateAndWishlistData, async (req, res) => {
            // fetching recent blogs
            const query = {};
            const cursor = allBlogs.find(query);
            cursor.sort({ creationTime: -1 });
            cursor.limit(6);
            const allBlogsList = await cursor.toArray();

            // if user logged in there must be a token and it has been verified previously
            // But if the user is not logged in, there will be no token and no data in req.user
            // so the user id will be available in req.user and its simple to fetch wishlist data using that user id.
            if (req.user) {
                const userId = req.user.userId;
                const wishlistQuery = { userId: userId };
                const wishListData = await wishlist.findOne(wishlistQuery);

                // No wishlist data available for that user, thats why its null
                if (!wishListData) {
                    return res.send(allBlogsList);
                } else {
                    const wishLists = wishListData.wishLists;

                    // Now wishlists data will merge with the blogs data
                    let updatedAllBlogsList = [];

                    allBlogsList.forEach((blogData) => {
                        wishLists.forEach((wishlistBlogId) => {
                            if (blogData._id.equals(wishlistBlogId)) {
                                blogData.wishlist = true;
                            }
                        });

                        if (!blogData.wishlist) {
                            blogData.wishlist = false;
                        }

                        updatedAllBlogsList.push(blogData);
                    });

                    return res.send(updatedAllBlogsList);
                }
            } else {
                return res.send(allBlogsList);
            }
        });

        // Editors pick blog data fetch
        // open api
        app.get("/editors-pick", validateAndWishlistData, async (req, res) => {
            const query = {}; // fetching all data, thats's why no query
            const cursor = editorsPick.find(query);
            const editorsPick_ids_raw = await cursor.toArray();

            // As the data return in array of object, taken only post_ids array.
            const editorsPick_postId = editorsPick_ids_raw[0].editorsPick_postId;

            // converted blog_id to ObjectId for find
            const idsToFind = editorsPick_postId.map((blogId) => new ObjectId(blogId));

            // fetching editors choice blogs from all blogs
            const allBlogsList = await allBlogs.find({ _id: { $in: idsToFind } }).toArray();

            // if user logged in there must be a token and it has been verified previously
            // But if the user is not logged in, there will be no token and no data in req.user
            // so the user id will be available in req.user and its simple to fetch wishlist data using that user id.
            if (req.user) {
                const userId = req.user.userId;
                const wishlistQuery = { userId: userId };
                const wishListData = await wishlist.findOne(wishlistQuery);

                // No wishlist data available for that user, thats why its null
                if (!wishListData) {
                    return res.send(allBlogsList);
                } else {
                    const wishLists = wishListData.wishLists;

                    // Now wishlists data will merge with the blogs data
                    let updatedAllBlogsList = [];

                    allBlogsList.forEach((blogData) => {
                        wishLists.forEach((wishlistBlogId) => {
                            if (blogData._id.equals(wishlistBlogId)) {
                                blogData.wishlist = true;
                            }
                        });

                        if (!blogData.wishlist) {
                            blogData.wishlist = false;
                        }

                        updatedAllBlogsList.push(blogData);
                    });

                    return res.send(updatedAllBlogsList);
                }
            } else {
                return res.send(allBlogsList);
            }
        });

        // Wishlist blog data fetch
        // Protected api
        app.get("/wishlist", validateAndWishlistData, async (req, res) => {
            if (req.user) {
                const userId = req.user.userId;
                const wishlistQuery = { userId: userId };
                const wishListData = await wishlist.findOne(wishlistQuery);

                // No wishlist data available for that user, thats why its null
                if (!wishListData) {
                    return res.send([]);
                } else {
                    const wishLists = wishListData.wishLists;

                    if (wishLists.length === 0) {
                        return res.send([]);
                    } else {
                        // converted blog_id to ObjectId for find
                        const idsToFind = wishLists.map((blogId) => new ObjectId(blogId));

                        // fetching wishlist blogs from all blogs
                        let wishlist_blogs = await allBlogs
                            .find({ _id: { $in: idsToFind } })
                            .toArray();

                        wishlist_blogs = wishlist_blogs.map((wishlistBlog) => {
                            wishlistBlog.wishlist = true;
                            return wishlistBlog;
                        });

                        res.send(wishlist_blogs);
                    }
                }
            } else {
                return res.send([]);
            }
        });

        // Featured List Data Fetch
        // open api
        app.get("/featured-blogs", async (req, res) => {
            const query = {};
            const cursor = allBlogs.find(query);
            const allBlogsList = await cursor.toArray();

            let largestBlogs = allBlogsList.sort((b, a) => {
                if (a.longDescription.length < b.longDescription.length) {
                    return -1;
                }
                if (a.longDescription.length > b.longDescription.length) {
                    return 1;
                }
                return 0;
            });

            let topTenBlog = largestBlogs.slice(0, 10);

            res.send(topTenBlog);
        });

        // Single Blog Data Fetch
        // open api
        app.get("/blogDetails/:blog_id", validateAndWishlistData, async (req, res) => {
            // getting blog details
            const blog_id = req.params.blog_id;
            const blogDetailsQuery = { _id: new ObjectId(blog_id) };
            const blogData = await allBlogs.findOne(blogDetailsQuery);

            /* NEW DATA */
            if (req.user) {
                const userId = req.user.userId;
                const wishlistQuery = { userId: userId };
                const wishListData = await wishlist.findOne(wishlistQuery);

                // No wishlist data available for that user, thats why its null
                if (!wishListData) {
                    blogData.wishlist = false;
                    return res.send(blogData);
                } else {
                    const wishLists = wishListData.wishLists;

                    wishLists.forEach((wishlistBlogId) => {
                        if (blogData._id.equals(wishlistBlogId)) {
                            blogData.wishlist = true;
                        }
                    });

                    if (!blogData.wishlist) {
                        blogData.wishlist = false;
                    }

                    return res.send(blogData);
                }
            } else {
                blogData.wishlist = false;
                return res.send(blogData);
            }
        });

        // Send comments of that blog.
        app.get("/comment-list/:blog_id", async (req, res) => {
            const blog_id = req.params.blog_id;
            const query = { blog_id: blog_id };

            const commentList = await comments.findOne(query);

            res.send(commentList);
        });

        // Open api
        // name of the categories
        app.get("/category-names", async (req, res) => {
            const query = { collection: "categoryNames" };
            const categoryCollection = await categoryNames.findOne(query);
            // const editorsPick_ids_raw = await cursor.toArray();

            let categoryListObj = categoryCollection.categoryList;

            res.send(categoryListObj);
        });

        // Post comments.
        // Protected Api
        app.post("/comment", verifyToken, requestValidate, async (req, res) => {
            const commentData = req.body;

            const query = { blog_id: commentData.blog_id };

            const commentList = await comments.findOne(query);

            if (!commentList) {
                const newCommentStructure = {
                    blog_id: commentData.blog_id,
                    commentInfo: [commentData.commentInfo],
                };

                const result = await comments.insertOne(newCommentStructure);

                return res.send(result);
            } else {
                const options = { upsert: false };

                let oldCommentStructure;

                if (Array.isArray(commentList.commentInfo)) {
                    oldCommentStructure = [commentData.commentInfo, ...commentList.commentInfo];
                } else {
                    oldCommentStructure = [commentData.commentInfo, commentList.commentInfo];
                }

                const updatedData = {
                    $set: {
                        commentInfo: oldCommentStructure,
                    },
                };

                const result_update = await comments.updateOne(query, updatedData, options);

                res.send(result_update);
            }
        });

        // Post blog to db
        // Protected Api
        app.post("/addBlog", verifyToken, requestValidate, async (req, res) => {
            const blogData = req.body.blogData;

            const result = await allBlogs.insertOne(blogData);

            res.send(result);
        });

        // Update blog
        // Protected Api
        app.put("/updateBlog/:blog_id", verifyToken, requestValidate, async (req, res) => {
            const blog_id = req.params.blog_id;
            const blogData = req.body.blogData;

            const query = { _id: new ObjectId(blog_id) };
            const options = { upsert: false };

            const updatedData = {
                $set: {
                    bannerUrl: blogData.bannerUrl,
                    title: blogData.title,
                    category: blogData.category,
                    shortDescription: blogData.shortDescription,
                    longDescription: blogData.longDescription,
                },
            };

            const result = await allBlogs.updateOne(query, updatedData, options);

            res.send(result);
        });

        // Wishlist add.
        // protected api.
        app.patch("/addWishlist", verifyToken, requestValidate, async (req, res) => {
            const blogId = req.body.blogId;
            const userId = req.body.userId;

            const query = { userId: userId };

            const wishListData = await wishlist.findOne(query);

            //  as userId is not added in db, theres no data in it
            if (!wishListData) {
                let newWishListData = {
                    userId: userId,
                    wishLists: [blogId],
                };

                const insertResult = await wishlist.insertOne(newWishListData);

                return res.send(insertResult);
            }

            const tempWishLists = wishListData.wishLists;

            // Add blogId to wishlists
            tempWishLists.push(blogId);

            // written condition
            const updatedWishlists = {
                $set: {
                    wishLists: tempWishLists,
                },
            };

            const options = { upsert: false };

            // updating data
            const result = await wishlist.updateOne(query, updatedWishlists, options);

            return res.send(result);
        });

        // Wishlist remove.
        // protected api.
        app.patch("/removeWishlist", verifyToken, requestValidate, async (req, res) => {
            const blogId = req.body.blogId;
            const userId = req.body.userId;

            const wishlistQuery = { userId: userId };

            const wishListData = await wishlist.findOne(wishlistQuery);

            const wishLists = wishListData.wishLists;
            // Remove blog id from tempWishLists
            let filteredWishlist = wishLists.filter((id) => id !== blogId);

            // written condition
            const updatedWishlists = {
                $set: {
                    wishLists: filteredWishlist,
                },
            };

            const options = { upsert: false };

            // updating data
            const result = await wishlist.updateOne(wishlistQuery, updatedWishlists, options);

            return res.send(result);
        });
    } finally {
        // await client.close();
    }
}

// Started mainProcess() function
mainProcess().catch(console.dir);

app.get("/", (req, res) => {
    res.send("Technest Server Running");
});

app.listen(port, () => {
    console.log(`Running on port http://localhost:${port}
------------------------------------`);
});
