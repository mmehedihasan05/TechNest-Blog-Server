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
        origin: ["http://localhost:5173", "http://localhost:5100"], // The domains where the client side will run
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

async function mainProcess() {
    try {
        await client.connect();
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");

        const allBlogs = client.db("a11-technest").collection("blogs");
        const editorsPick = client.db("a11-technest").collection("editors-pick");
        const wishlist = client.db("a11-technest").collection("wishlist");

        // Brand Wise blog Data Fetch
        // open api
        // sort and return
        app.get("/recent-blogs", async (req, res) => {
            // console.log("request method ", req.method);

            // fetching recent blogs
            const query = {};
            const cursor = allBlogs.find(query);
            cursor.sort({ creationTime: -1 });
            cursor.limit(6);
            const recentBlogs = await cursor.toArray();

            // adding wishlist data to blogs

            // getting wishlist data
            const userId = req.query.userid;

            // if user logged in there must be userId, so it need to check
            // but if ther user not logged in there will be no user id, so its no need to check wishlist
            if (userId == "undefined") {
                res.send(recentBlogs);
            } else {
                const wishlistQuery = { userId: userId };
                const wishListData = await wishlist.findOne(wishlistQuery);
                const wishLists = wishListData.wishLists;

                let updatedRecentBlogs = [];

                recentBlogs.map((blogData) => {
                    wishLists.forEach((wishlistBlogId) => {
                        if (blogData._id.equals(wishlistBlogId)) {
                            blogData.wishlist = true;
                        }
                    });

                    if (!blogData.wishlist) {
                        blogData.wishlist = false;
                    }

                    updatedRecentBlogs.push(blogData);
                });

                res.send(updatedRecentBlogs);
            }
        });

        // Editors pick blog data fetch
        // open api
        app.get("/editors-pick", async (req, res) => {
            const query = {}; // fetching all data, thats's why no query
            const cursor = editorsPick.find(query);
            const editorsPick_ids_raw = await cursor.toArray();

            // As the data return in array of object, taken only post_ids array.
            const editorsPick_postId = editorsPick_ids_raw[0].editorsPick_postId;

            // converted blog_id to ObjectId for find
            const idsToFind = editorsPick_postId.map((blogId) => new ObjectId(blogId));

            // fetching editors choice blogs from all blogs
            const editorsPick_blogs = await allBlogs.find({ _id: { $in: idsToFind } }).toArray();

            // adding wishlist data to blogs
            const userId = req.query.userid;

            // getting wishlist data
            // if user logged in there must be userId, so it need to check
            // but if ther user not logged in there will be no user id, so its no need to check wishlist
            if (userId == "undefined") {
                res.send(editorsPick_blogs);
            } else {
                const wishlistQuery = { userId: userId };
                const wishListData = await wishlist.findOne(wishlistQuery);
                const wishLists = wishListData.wishLists;

                console.log(wishLists);
                let updatedEditorsPickBlogs = [];

                editorsPick_blogs.map((blogData) => {
                    wishLists.forEach((wishlistBlogId) => {
                        if (blogData._id.equals(wishlistBlogId)) {
                            blogData.wishlist = true;
                        }
                    });

                    if (!blogData.wishlist) {
                        blogData.wishlist = false;
                    }

                    updatedEditorsPickBlogs.push(blogData);
                });

                console.log(updatedEditorsPickBlogs);
                res.send(updatedEditorsPickBlogs);
            }
        });

        // Single Blog Data Fetch
        // open api
        app.get("/blogDetails/:blog_id", async (req, res) => {
            // getting blog details
            const blog_id = req.params.blog_id;
            const blogDetailsQuery = { _id: new ObjectId(blog_id) };
            const blogData = await allBlogs.findOne(blogDetailsQuery);

            // getting wishlist data
            const userId = req.query.userid;

            // if user logged in there must be userId, so it need to check
            // but if ther user not logged in there will be no user id, so its no need to check wishlist
            if (userId == "undefined") {
                res.send(blogData);
            } else {
                const wishlistQuery = { userId: userId };
                const wishListData = await wishlist.findOne(wishlistQuery);
                const wishLists = wishListData.wishLists;

                wishLists.forEach((wishlistBlogId) => {
                    if (blogData._id.equals(wishlistBlogId)) {
                        blogData.wishlist = true;
                    }
                });

                if (!blogData.wishlist) {
                    blogData.wishlist = false;
                }

                res.send(blogData);
            }
        });

        // Wishlist add.
        // protected api.
        app.patch("/addWishlist", async (req, res) => {
            const blogId = req.body.blogId;
            const userId = req.body.userId;

            const query = { userId: userId };

            const wishListData = await wishlist.findOne(query);

            console.log(wishListData);

            //  as userId is not added in db, theres no data in it
            if (!wishListData) {
                console.log("new user");
                let newWishListData = {
                    userId: userId,
                    wishLists: [blogId],
                };

                const insertResult = await wishlist.insertOne(newWishListData);

                console.log(insertResult);

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

            console.log(result);

            return res.send(result);
        });

        // Wishlist remove.
        // protected api.
        app.patch("/removeWishlist", async (req, res) => {
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
        // /blogDetails/:blog_id
        // await client.close();
    }
}

// Started mainProcess() function
mainProcess().catch(console.dir);

app.get("/", (req, res) => {
    res.send("Food and Beverage Server Running");
});

app.listen(port, () => {
    console.log(`Running on port http://localhost:${port}
------------------------------------`);
});
