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
    const doctorPaymentsCollection = database.collection("doctorPayments");
    const prescriptionsCollection = database.collection("prescriptions");


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

    app.get("/api/doctors/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await doctorsCollection.findOne(query)
      res.json(result)
    })

    app.get("/api/bookings", async (req, res) => {
      const query = {};

      if (req.query.doctorId) {
        query.doctorId = req.query.doctorId;
      }
      if (req.query.patientEmail) {
        query.patientEmail = req.query.patientEmail;
      }
      if (req.query.patientId) {
        query.patientId = req.query.patientId;
      }

      const result = await doctorPaymentsCollection.find(query).sort({ createdAt: -1 }).toArray();
      res.json(result);

    })

    app.post("/api/bookings", async (req, res) => {
      const {
        doctorId,
        doctorName,
        doctorEmail,
        doctorFee,
        doctorImage,
        patientId,
        patientName,
        patientEmail,
        patientImage,
        appointmentDate,
        appointmentTime,
        symptoms,
        bookingStatus,
        stripeSessionId
      } = req.body;

      if (!doctorId || !patientEmail || !appointmentDate || !appointmentTime) {
        return res.status(400).json({
          success: false,
          message: "Missing required booking fields!"
        });
      }


      if (stripeSessionId) {
        const existingPayment = await doctorPaymentsCollection.findOne({ stripeSessionId });
        if (existingPayment) {
          return res.json({
            success: true,
            message: "Payment already recorded!",
            result: existingPayment
          });
        }
      }

      // ডাটাবেজে সেভ করার অবজেক্ট
      const newPaymentRecord = {
        doctorId,
        doctorName,
        doctorEmail,
        doctorFee: Number(doctorFee),
        doctorImage,
        patientId,
        patientName,
        patientEmail,
        patientImage,
        appointmentDate,
        appointmentTime,
        symptoms: symptoms || "N/A",
        paymentStatus: bookingStatus || "Paid",
        stripeSessionId: stripeSessionId || null,
        createdAt: new Date()
      };

      const result = await doctorPaymentsCollection.insertOne(newPaymentRecord);

      res.json({
        success: true,
        message: "Payment recorded successfully!",
        result
      });
    });

    // ── Update Appointment Booking Status (Accept / Reject) ──
    app.patch("/api/bookings/:id", async (req, res) => {
      const { id } = req.params;
      const { status } = req.body;

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: "Invalid Booking ID!" });
      }

      if (!status) {
        return res.status(400).json({ success: false, message: "Status is required!" });
      }

      try {
        const result = await doctorPaymentsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: status, updatedAt: new Date() } }
        );

        if (result.matchedCount === 0) {
          return res.status(404).json({ success: false, message: "Booking record not found!" });
        }

        res.json({
          success: true,
          message: `Appointment status updated to ${status} successfully!`,
          result
        });
      } catch (error) {
        console.error("Error updating booking status:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
      }
    });

    // PATCH: Update booking status (Confirmed / Cancelled / Completed)
    app.patch("/api/bookings/:id", async (req, res) => {
      const { id } = req.params;
      const { status } = req.body;

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: "Invalid booking ID!" });
      }

      const result = await doctorPaymentsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status, updatedAt: new Date() } }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ success: false, message: "Booking not found!" });
      }

      res.json({ success: true, message: "Booking status updated!", result });
    });



    app.get("/api/prescriptions", async (req, res) => {
      const query = {};
      if (req.query.doctorId) {
        query.doctorId = req.query.doctorId;
      }
      if (req.query.patientId) {
        query.patientId = req.query.patientId;
      }
      if (req.query.appointmentId) {
        query.appointmentId = req.query.appointmentId;
      }

      const result = await prescriptionsCollection.find(query).sort({ createdAt: -1 }).toArray();
      res.json(result);
    });

    // POST: Create a prescription
    app.post("/api/prescriptions", async (req, res) => {
      const {
        appointmentId,
        doctorId,
        doctorName,
        doctorEmail,
        patientId,
        patientName,
        patientEmail,
        diagnosis,
        medicines,
        notes,
        appointmentDate
      } = req.body;

      if (!appointmentId || !patientId || !diagnosis) {
        return res.status(400).json({ success: false, message: "Missing required prescription fields!" });
      }

      try {
        const newPrescription = {
          appointmentId,
          doctorId,
          doctorName,
          doctorEmail,
          patientId,
          patientName,
          patientEmail,
          diagnosis,
          medicines: medicines || [],
          notes: notes || "",
          appointmentDate: appointmentDate || "",
          createdAt: new Date()
        };

        const result = await prescriptionsCollection.insertOne(newPrescription);

        // Also mark the booking as Completed
        if (ObjectId.isValid(appointmentId)) {
          await doctorPaymentsCollection.updateOne(
            { _id: new ObjectId(appointmentId) },
            { $set: { status: "Completed", updatedAt: new Date() } }
          );
        }

        res.json({ success: true, message: "Prescription created successfully!", result });
      } catch (error) {
        console.error("Prescription creation error:", error);
        res.status(500).json({ success: false, message: error.message });
      }
    });

    // PATCH: Update a prescription
    app.patch("/api/prescriptions/:id", async (req, res) => {
      const { id } = req.params;
      const { diagnosis, medicines, notes } = req.body;

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: "Invalid prescription ID!" });
      }

      const updateData = {};
      if (diagnosis !== undefined) updateData.diagnosis = diagnosis;
      if (medicines !== undefined) updateData.medicines = medicines;
      if (notes !== undefined) updateData.notes = notes;
      updateData.updatedAt = new Date();

      try {
        const result = await prescriptionsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updateData }
        );

        if (result.matchedCount === 0) {
          return res.status(404).json({ success: false, message: "Prescription not found!" });
        }

        res.json({ success: true, message: "Prescription updated successfully!", result });
      } catch (error) {
        console.error("Prescription update error:", error);
        res.status(500).json({ success: false, message: error.message });
      }
    });

    app.post("/api/doctors", async (req, res) => {
      const doctor = req.body;
      const { doctorId, ...rest } = doctor;

      if (!doctorId) {
        return res.status(400).json({ success: false, message: "doctorId is required!" });
      }

      try {
        // upsert: doctorId দিয়ে আগে খোঁজে — থাকলে update, না থাকলে insert
        const result = await doctorsCollection.findOneAndUpdate(
          { doctorId: doctorId },
          {
            $set: { ...rest, doctorId, updatedAt: new Date().toISOString() },
            $setOnInsert: { createdAt: new Date() }
          },
          { upsert: true, returnDocument: "after" }
        );

        res.json({ success: true, message: "Doctor profile saved successfully!", result });
      } catch (error) {
        console.error("Doctor upsert error:", error);
        res.status(500).json({ success: false, message: error.message });
      }
    })

    // ADMIN: Update Doctor Verification Status — must be BEFORE /:id to avoid route conflict
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

    // PATCH: Direct update by doctor profile _id (must be AFTER /verify/:id)
    app.patch("/api/doctors/:id", async (req, res) => {
      const { id } = req.params;
      const updateData = req.body;

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: "Invalid Doctor ID!" });
      }

      const result = await doctorsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { ...updateData, updatedAt: new Date().toISOString() } }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ success: false, message: "Doctor not found!" });
      }

      res.json({ success: true, message: "Doctor profile updated successfully!", result });
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