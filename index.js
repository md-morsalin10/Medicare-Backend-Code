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
    const schedulesCollection = database.collection("schedules");


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

    app.get("/api/schedules", async (req, res) => {
      const query = {};
      if (req.query.doctorId) {
        query.doctorId = req.query.doctorId;
      }
      const result = await schedulesCollection.find(query).sort({ date: 1 }).toArray();
      res.json(result);
    });

    app.post("/api/schedules", async (req, res) => {
      const { doctorId, date, timeSlot, maxPatients, doctorEmail } = req.body;

      if (!doctorId || !date || !timeSlot) {
        return res.status(400).json({ success: false, message: "Missing required fields!" });
      }

      const existingSchedule = await schedulesCollection.findOne({
        doctorId: doctorId,
        date: date,
        timeSlot: timeSlot
      });

      if (existingSchedule) {
        return res.status(400).json({
          success: false,
          message: "You already created a schedule for this date and time slot!"
        });
      }

      const newSchedule = {
        doctorId,
        doctorEmail,
        date,
        timeSlot,
        maxPatients: Number(maxPatients) || 1,
        status: "Available",
        createdAt: new Date()
      };

      const result = await schedulesCollection.insertOne(newSchedule);
      res.json({ success: true, message: "Schedule created successfully!", result });
    });

    // ── Update Schedule by ID ──
    app.patch("/api/schedules/:id", async (req, res) => {
      const { id } = req.params;
      const { date, timeSlot, maxPatients } = req.body;

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: "Invalid schedule ID!" });
      }

      const updateFields = {};
      if (date) updateFields.date = date;
      if (timeSlot) updateFields.timeSlot = timeSlot;
      if (maxPatients) updateFields.maxPatients = Number(maxPatients);
      updateFields.updatedAt = new Date();

      const result = await schedulesCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateFields }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ success: false, message: "Schedule not found!" });
      }

      res.json({ success: true, message: "Schedule updated successfully!", result });
    });

    // ── Delete Schedule by ID ──
    app.delete("/api/schedules/:id", async (req, res) => {
      const { id } = req.params;

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: "Invalid schedule ID!" });
      }

      const result = await schedulesCollection.deleteOne({ _id: new ObjectId(id) });

      if (result.deletedCount === 0) {
        return res.status(404).json({ success: false, message: "Schedule not found!" });
      }

      res.json({ success: true, message: "Schedule deleted successfully!", result });
    });

    // ADMIN: Update Doctor Verification Status (Verify / Reject / Pending)
    app.patch("/api/doctors/verify/:id", async (req, res) => {
      const { id } = req.params;
      const { verificationStatus } = req.body;

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: "Invalid Doctor ID!" });
      }

      if (!verificationStatus) {
        return res.status(400).json({ success: false, message: "verificationStatus is required!" });
      }

      const result = await doctorsCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            verificationStatus: verificationStatus,
            updatedAt: new Date()
          }
        }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ success: false, message: "Doctor not found!" });
      }

      res.json({
        success: true,
        message: `Doctor status updated to ${verificationStatus} successfully!`,
        result
      });
    });


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