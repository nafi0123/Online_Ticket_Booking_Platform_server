const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
// const stripe = require("stripe")(process.env.STRIPE_SECRET);

const port = process.env.PORT || 5000;
const crypto = require("crypto");

const admin = require("firebase-admin");

const decoded = Buffer.from(process.env.FB_SERVICE_KEY, "base64").toString(
  "utf8"
);
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

function generateTrackingId() {
  const prefix = "PRCL"; // your brand prefix
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, ""); // YYYYMMDD
  const random = crypto.randomBytes(3).toString("hex").toUpperCase(); // 6-char random hex

  return `${prefix}-${date}-${random}`;
}

// middleware
app.use(express.json());
app.use(cors());

const verifyFBToken = async (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).send({ message: "unauthorize access" });
  }
  try {
    const idToken = token.split(" ")[1];
    const decoded = await admin.auth().verifyIdToken(idToken);
    req.decoded_email = decoded.email;
    next();
  } catch (err) {
    res.status(401).send({ message: " unauthorize access" });
  }
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@module54.nimc7p2.mongodb.net/?appName=module54`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const db = client.db("Online_Ticket_Booking_Platform");
    const userCollection = db.collection("users");
    const userTickets = db.collection("tickets");
    const ticketsCollection = db.collection("buyingTickets");

    // middle admin before allowing admin activity
    // must be used after verifyFBToken middleware
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded_email;
      const query = { email };
      const user = await userCollection.findOne(query);

      if (!user || user.role !== "admin") {
        return res.status(403).send({ message: "forbidden access" });
      }

      next();
    };
    const verifyVendor = async (req, res, next) => {
      const email = req.decoded_email;
      const query = { email };
      const user = await userCollection.findOne(query);

      if (!user || user.role !== "vendor") {
        return res.status(403).send({ message: "forbidden access" });
      }

      next();
    };

    // profile

    // user

    app.post("/users", async (req, res) => {
      const user = req.body;
      user.role = "user";
      user.createdAt = new Date();
      const email = user.email;
      const userExists = await userCollection.findOne({ email });
      if (userExists) {
        return res.send({ message: "user exists" });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.get("/users/:email/role", verifyFBToken, async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await userCollection.findOne(query);
      res.send({ role: user?.role || "user" });
    });

    app.get("/users", verifyFBToken, verifyAdmin, async (req, res) => {
      try {
        const users = await userCollection.find().toArray();
        res.send(users);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch users", error });
      }
    });

    app.patch("/user/:id", async (req, res) => {
      const updatedFields = req.body; // role OR isFraud
      const result = await userCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: updatedFields }
      );
      res.send(result);
    });

    // tickets

    app.post("/tickets", verifyFBToken, verifyVendor, async (req, res) => {
      const ticketsData = req.body;
      (ticketsData.status = "pending"), (ticketsData.createdAt = new Date());
      const result = await userTickets.insertOne(ticketsData);
      res.send(result);
    });
    app.get("/tickets", async (req, res) => {
      try {
        const { status, vendorEmail } = req.query;

        let query = {};

        if (status) query.status = status;
        if (vendorEmail) query.vendorEmail = vendorEmail;

        // console.log("QUERY:", query);

        const result = await userTickets.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error("Tickets Fetch Error:", error);
        res.status(500).send({ message: "Server Error", error: error.message });
      }
    });

    app.patch(
      "/tickets/:id/role",
      verifyFBToken,
      verifyAdmin,
      async (req, res) => {
        const { status } = req.body;
        const result = await userTickets.updateOne(
          { _id: new ObjectId(req.params.id) },
          { $set: { status } }
        );
        res.send(result);
      }
    );

    app.delete(
      "/tickets/:id",
      verifyFBToken,
      verifyVendor,
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await userTickets.deleteOne(query);
        res.send(result);
      }
    );

    app.get("/all-tickets", verifyFBToken, async (req, res) => {
      try {
        const { from, to, transport, sort } = req.query;

        // Fraud vendors
        const fraudVendors = await userCollection
          .find({ role: "vendor", isFraud: true })
          .toArray();
        const fraudEmails = fraudVendors.map((v) => v.email);

        const query = {
          status: "approve",
          vendorEmail: { $nin: fraudEmails },
        };

        // Only add filter if value exists
        if (from && from.trim() !== "") {
          query.from = { $regex: new RegExp(`^${from}`, "i") }; // starts with
        }
        if (to && to.trim() !== "") {
          query.to = { $regex: new RegExp(`^${to}`, "i") };
        }
        if (transport && transport.trim() !== "") {
          query.type = transport;
        }

        // Sort
        let sortObj = {};
        if (sort === "low") sortObj.price = 1;
        else if (sort === "high") sortObj.price = -1;

        const tickets = await userTickets.find(query).sort(sortObj).toArray();

        res.send(tickets);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to fetch tickets", error });
      }
    });

    app.patch("/tickets/:id", verifyFBToken, verifyVendor, async (req, res) => {
      const id = req.params.id;
      const updatedData = req.body;

      try {
        // Find the ticket first
        const ticket = await userTickets.findOne({ _id: new ObjectId(id) });
        if (!ticket) {
          return res.status(404).send({ message: "Ticket not found" });
        }

        // Prevent updating rejected tickets
        const rejectedStatuses = ["reject", "rejected"];
        if (rejectedStatuses.includes((ticket.status || "").toLowerCase())) {
          return res
            .status(400)
            .send({ message: "Cannot update a rejected ticket" });
        }

        // Ensure price and quantity are numbers
        if (updatedData.price)
          updatedData.price = parseFloat(updatedData.price);
        if (updatedData.quantity)
          updatedData.quantity = parseInt(updatedData.quantity);

        // Update the ticket
        const result = await userTickets.updateOne(
          { _id: new ObjectId(id) },
          { $set: updatedData }
        );

        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to update ticket", error });
      }
    });

    app.get("/all-tickets/latest-tickets", async (req, res) => {
      try {
        const fraudVendors = await userCollection
          .find({ role: "vendor", isFraud: true })
          .toArray();
        const fraudEmails = fraudVendors.map((v) => v.email);

        const tickets = await userTickets
          .find({ vendorEmail: { $nin: fraudEmails }, status: "approve" })
          .sort({ createdAt: -1 })
          .limit(6)
          .toArray();

        res.send(tickets);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to fetch tickets", error });
      }
    });

    app.get("/all-tickets/advertise-tickets/home-page", async (req, res) => {
      try {
        const tickets = await userTickets
          .find({ advertise: true })
          .sort({ createdAt: -1 })
          .toArray();

        res.send(tickets);
      } catch (error) {
        res.status(500).send({ message: "Failed to load tickets", error });
      }
    });

    app.get("/tickets-details-card/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userTickets.findOne(query);
      res.send(result);
    });

    app.get(
      "/all-tickets/advertise-tickets",
      verifyFBToken,
      verifyAdmin,
      async (req, res) => {
        try {
          const results = await userTickets.find().toArray();
          res.send(results);
        } catch (error) {
          res.status(500).send({ message: "advertise-tickets not send" });
        }
      }
    );

    app.patch(
      "/tickets/:id/advertise",
      verifyFBToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const { advertise } = req.body; // boolean

        try {
          if (advertise) {
            // Count currently advertised tickets
            const count = await userTickets.countDocuments({ advertise: true });
            if (count >= 6) {
              return res
                .status(400)
                .send({ message: "Maximum 6 tickets can be advertised" });
            }
          }

          const result = await userTickets.updateOne(
            { _id: new ObjectId(id) },
            { $set: { advertise } }
          );

          res.send(result);
        } catch (error) {
          res
            .status(500)
            .send({ message: "Failed to update advertise status", error });
        }
      }
    );

    // buyingTickets
    app.post("/book-ticket", verifyFBToken, async (req, res) => {
      const buyingTicketsData = req.body;
      buyingTicketsData.createdAt = new Date();
      buyingTicketsData.trackId = generateTrackingId();
      const result = await ticketsCollection.insertOne(buyingTicketsData);
      res.send(result);
    });

    app.get("/book-ticket", verifyFBToken, verifyVendor, async (req, res) => {
      try {
        const vendorEmail = req.query.vendor_email;
        const status = req.query.status;

        const filter = {};

        if (vendorEmail) filter.vendor_email = vendorEmail; // ✅ FIXED
        if (status) filter.status = status;

        const result = await ticketsCollection.find(filter).toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Server Error", error });
      }
    });

    app.patch("/update-booking/:id", async (req, res) => {
      const id = req.params.id;
      const { status } = req.body;

      const result = await ticketsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status } }
      );

      res.send({ success: true, result });
    });




    app.get("/user-bookings", verifyFBToken, async (req, res) => {
      try {
        const email = req.query.email;
        // const status = req.query.status;

        const filter = {};

        if (email) filter.email = email; 
        // if (status) filter.status = status;

        const result = await ticketsCollection.find(filter).toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Server Error", error });
      }
    });









  } finally {
  }
}
run().catch(console.dir);
app.get("/", (req, res) => {
  res.send("Online_Ticket_Booking_Platform");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
//
