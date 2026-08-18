const express = require('express');
const app = express();
const cors = require('cors');
const dotenv = require('dotenv');
dotenv.config();

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

const uri = process.env.MONGO_URI;

// Create a MongoClient
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server
    await client.connect();
    console.log("Successfully connected to MongoDB!");

    // Database and Collections
    const database = client.db("Medicare");
    const usersCollection = database.collection("user");
    const doctorsCollection = database.collection("doctors");


    app.get("/api/users", async (req, res) => {
      const result = await usersCollection.find().toArray()
      res.send(result)
    })


    app.get("/api/doctors", async (req, res) => {
      const query = {}

      if (req.query.doctorId) {
        query.doctorId = req.query.doctorId;
      }

      const result = await doctorsCollection.find(query).toArray()
      res.json(result)

    })


    app.post("/api/doctors", async (req, res) => {
      const doctor = req.body
      const newDoctor = {
        ...doctor,
        createdAt: new Date()
      }
      const result = await doctorsCollection.insertOne(newDoctor)
      res.send(result)
    })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. Connected to MongoDB Admin!");

  } catch (error) {
    console.error("MongoDB Connection Error:", error);
  }

}

run().catch(console.dir);

// Root Route
app.get('/', (req, res) => {
  res.send('Medicare Server is Running...');
});

// Start Server
app.listen(port, () => {
  console.log(`Medicare App listening on port ${port}`);
});