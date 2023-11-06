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

        // Brand Wise blog Data Fetch
        // open api
        // sort and return
        app.get("/recent-blogs", async (req, res) => {
            // console.log("request method ", req.method);

            const query = {};
            const cursor = allBlogs.find(query);
            cursor.sort({ creationTime: -1 });
            cursor.limit(6);
            const recentBlogs = await cursor.toArray();

            res.send(recentBlogs);
        });

        // Editors pick blog data fetch
        // open api
        app.get("/editors-pick", async (req, res) => {
            // console.log("request method ", req.method);

            const query = {}; // fetching all data, thats's why no query
            const cursor = editorsPick.find(query);
            const editorsPick_ids_raw = await cursor.toArray();

            // As the data return in array of object, taken only post_ids array.
            const editorsPick_postId = editorsPick_ids_raw[0].editorsPick_postId;

            // converted blog_id to ObjectId for find
            const idsToFind = editorsPick_postId.map((blogId) => new ObjectId(blogId));

            // fetching editors choice blogs from all blogs
            const editorsPick_blogs = await allBlogs.find({ _id: { $in: idsToFind } }).toArray();

            res.send(editorsPick_blogs);
        });
    } finally {
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
