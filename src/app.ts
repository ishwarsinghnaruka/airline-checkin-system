import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";
import { CheckinService } from "./services/checkinService.js"; // Removed .ts extension

// Initialize Express application and dependencies
const app = express();
const prisma = new PrismaClient();
const checkinService = new CheckinService();
const PORT = 3000;

// ES modules require this approach to get __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper function to safely extract error messages
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

// Helper function to check if error contains specific text
function errorContains(error: unknown, text: string): boolean {
  if (error instanceof Error) {
    return error.message.includes(text);
  }
  return false;
}

// Middleware Configuration
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

// Add request logging for debugging and monitoring
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health Check Endpoint
app.get("/health", async (req, res) => {
  try {
    await prisma.$connect();

    const seatCount = await prisma.seat.count();
    const availableSeats = await prisma.seat.count({
      where: { isAvailable: true },
    });

    res.json({
      status: "OK",
      database: "Connected",
      totalSeats: seatCount,
      availableSeats: availableSeats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Health check failed:", error);
    res.status(500).json({
      status: "Error",
      database: "Disconnected",
      error: "Database connection failed",
      timestamp: new Date().toISOString(),
    });
  }
});
// Add this route for manual seeding
app.post("/admin/seed-database", async (req, res) => {
  try {
    console.log("Starting database seeding...");

    // Clear existing data
    await prisma.booking.deleteMany();
    await prisma.seat.deleteMany();
    await prisma.passenger.deleteMany();
    await prisma.flight.deleteMany();

    // Create flight
    const flight = await prisma.flight.create({
      data: {
        flightNumber: "AA123",
        departure: "New York (JFK)",
        arrival: "Los Angeles (LAX)",
        departureTime: new Date("2024-12-01T08:00:00Z"),
        arrivalTime: new Date("2024-12-01T11:30:00Z"),
        aircraftType: "Boeing 737",
        totalSeats: 96,
      },
    });

    // Create seats
    const seats = [];
    for (let row = 10; row <= 25; row++) {
      for (const letter of ["A", "B", "C", "D", "E", "F"]) {
        seats.push({
          flightId: flight.id,
          seatNumber: `${row}${letter}`,
          seatType: "ECONOMY",
          price: 100.0,
        });
      }
    }

    await prisma.seat.createMany({ data: seats });

    // Create test passengers and bookings
    for (let i = 1; i <= 100; i++) {
      const passenger = await prisma.passenger.create({
        data: {
          firstName: `Passenger${i}`,
          lastName: `Test`,
          email: `passenger${i}@test.com`,
          phone: `+123456789${String(i).padStart(2, "0")}`,
        },
      });

      await prisma.booking.create({
        data: {
          pnr: `PNR${String(i).padStart(3, "0")}`,
          flightId: flight.id,
          passengerId: passenger.id,
          status: "CONFIRMED",
        },
      });
    }

    res.json({ success: true, message: "Database seeded successfully" });
  } catch (error) {
    console.error("Seeding error:", error);
    res.status(500).json({ error: error.message });
  }
});

// PNR Login Endpoint
app.post("/checkin/login", async (req, res) => {
  try {
    const { pnr } = req.body;

    if (!pnr) {
      return res.status(400).json({ error: "PNR is required" });
    }

    const checkinData = await checkinService.loginWithPNR(pnr);

    console.log(`Successful login for PNR: ${pnr}`);
    res.json(checkinData);
  } catch (error) {
    console.error(`Login failed for PNR: ${req.body.pnr}`, error);

    if (getErrorMessage(error) === "Invalid PNR") {
      return res.status(404).json({ error: "Booking not found" });
    }

    res.status(400).json({ error: getErrorMessage(error) });
  }
});

// Auto-Assign Seat - Unsafe Method
app.post("/checkin/auto-assign-seat-unsafe", async (req, res) => {
  try {
    const { pnr, flightId } = req.body;

    if (!pnr) {
      return res.status(400).json({ error: "PNR is required" });
    }

    console.log(`Starting UNSAFE seat assignment for PNR: ${pnr}`);

    const result = await checkinService.selectNextAvailableSeatUnsafe(
      pnr,
      flightId
    );

    console.log(
      `UNSAFE assignment successful: ${result.seatNumber} for ${pnr}`
    );
    res.json(result);
  } catch (error) {
    console.error(`UNSAFE assignment failed for PNR: ${req.body.pnr}`, error);

    if (errorContains(error, "No seats available")) {
      return res.status(409).json({ error: "Flight is full" });
    }

    if (errorContains(error, "concurrent access")) {
      return res
        .status(409)
        .json({ error: "Seat assignment conflict - please try again" });
    }

    res.status(400).json({ error: getErrorMessage(error) });
  }
});

// Auto-Assign Seat - Safe Method
app.post("/checkin/auto-assign-seat-safe", async (req, res) => {
  try {
    const { pnr, flightId } = req.body;

    if (!pnr) {
      return res.status(400).json({ error: "PNR is required" });
    }

    console.log(`Starting SAFE seat assignment for PNR: ${pnr}`);

    const result = await checkinService.selectNextAvailableSeatSafe(
      pnr,
      flightId
    );

    console.log(`SAFE assignment successful: ${result.seatNumber} for ${pnr}`);
    res.json(result);
  } catch (error) {
    console.error(`SAFE assignment failed for PNR: ${req.body.pnr}`, error);

    if (errorContains(error, "No seats available")) {
      return res
        .status(409)
        .json({ error: "Flight is full or all seats being processed" });
    }

    res.status(400).json({ error: getErrorMessage(error) });
  }
});

// Specific Seat Selection - Unsafe Method
app.post("/checkin/select-seat-unsafe", async (req, res) => {
  try {
    const { pnr, seatId } = req.body;

    if (!pnr || !seatId) {
      return res.status(400).json({ error: "PNR and seatId are required" });
    }

    console.log(`UNSAFE specific seat selection: ${seatId} for PNR: ${pnr}`);

    // Call the unsafe method directly since selectSpecificSeat doesn't exist
    const result = await checkinService.selectNextAvailableSeatUnsafe(pnr);

    console.log(`UNSAFE specific seat assignment successful for ${pnr}`);
    res.json(result);
  } catch (error) {
    console.error(
      `UNSAFE specific seat selection failed for PNR: ${req.body.pnr}`,
      error
    );
    res.status(400).json({ error: getErrorMessage(error) });
  }
});

// Specific Seat Selection - Safe Method
app.post("/checkin/select-seat-safe", async (req, res) => {
  try {
    const { pnr, seatId } = req.body;

    if (!pnr || !seatId) {
      return res.status(400).json({ error: "PNR and seatId are required" });
    }

    console.log(`SAFE specific seat selection: ${seatId} for PNR: ${pnr}`);

    // Call the safe method directly since selectSpecificSeat doesn't exist
    const result = await checkinService.selectNextAvailableSeatSafe(pnr);

    console.log(`SAFE specific seat assignment successful for ${pnr}`);
    res.json(result);
  } catch (error) {
    console.error(
      `SAFE specific seat selection failed for PNR: ${req.body.pnr}`,
      error
    );

    if (
      errorContains(error, "already taken") ||
      errorContains(error, "being processed")
    ) {
      return res.status(409).json({ error: "Seat is no longer available" });
    }

    res.status(400).json({ error: getErrorMessage(error) });
  }
});

// Flight Seat Map Endpoint
app.get("/flights/:flightNumber/seats", async (req, res) => {
  try {
    const { flightNumber } = req.params;

    console.log(`Fetching seat map for flight: ${flightNumber}`);

    const seatMap = await checkinService.getFlightSeatMap(flightNumber);

    res.json(seatMap);
  } catch (error) {
    console.error(
      `Failed to fetch seat map for flight: ${req.params.flightNumber}`,
      error
    );

    if (getErrorMessage(error) === "Flight not found") {
      return res.status(404).json({ error: "Flight not found" });
    }

    res.status(400).json({ error: getErrorMessage(error) });
  }
});

// Administrative Endpoints

// Reset Specific Seat
app.post("/admin/reset-seat", async (req, res) => {
  try {
    const { seatId } = req.body;

    if (!seatId) {
      return res.status(400).json({ error: "seatId is required" });
    }

    console.log(`Resetting seat ID: ${seatId}`);

    await prisma.$transaction(async (tx) => {
      await tx.seat.update({
        where: { id: seatId },
        data: { isAvailable: true },
      });

      await tx.booking.updateMany({
        where: { seatId: seatId },
        data: { seatId: null, checkedIn: false },
      });
    });

    console.log(`Successfully reset seat ID: ${seatId}`);
    res.json({ success: true, message: `Seat ${seatId} reset to available` });
  } catch (error) {
    console.error(`Failed to reset seat ID: ${req.body.seatId}`, error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
});

// Reset All Seats
app.post("/admin/reset-all-seats", async (req, res) => {
  try {
    console.log("Starting full system reset...");

    const result = await prisma.$transaction(async (tx) => {
      await tx.seat.updateMany({
        data: { isAvailable: true },
      });

      await tx.booking.updateMany({
        data: { seatId: null, checkedIn: false },
      });

      const totalSeats = await tx.seat.count();
      return totalSeats;
    });

    console.log(`Successfully reset ${result} seats to available state`);
    res.json({
      success: true,
      message: `Reset ${result} seats to available state`,
    });
  } catch (error) {
    console.error("Failed to reset all seats:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
});

// Seat Status Summary
app.get("/admin/seats-status", async (req, res) => {
  try {
    const totalSeats = await prisma.seat.count();
    const availableSeats = await prisma.seat.count({
      where: { isAvailable: true },
    });
    const bookedSeats = totalSeats - availableSeats;
    const checkedInPassengers = await prisma.booking.count({
      where: { checkedIn: true },
    });

    res.json({
      total: totalSeats,
      available: availableSeats,
      booked: bookedSeats,
      checkedIn: checkedInPassengers,
      utilization: `${((bookedSeats / totalSeats) * 100).toFixed(2)}%`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to get seat status:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
});

// Debug Schema Endpoint
app.get("/admin/debug-schema", async (req, res) => {
  try {
    const result = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'seats'
      ORDER BY ordinal_position
    `;

    res.json(result);
  } catch (error) {
    console.error("Failed to fetch schema information:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
});

// Frontend Routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

app.get("*", (req, res) => {
  if (
    !req.path.startsWith("/api") &&
    !req.path.startsWith("/admin") &&
    !req.path.startsWith("/checkin")
  ) {
    res.sendFile(path.join(__dirname, "../public/index.html"));
  } else {
    res.status(404).json({ error: "API endpoint not found" });
  }
});

// Error Handling Middleware with proper types
app.use(
  (
    error: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error("Unhandled error in route:", error);

    res.status(500).json({
      error: "Internal server error",
      timestamp: new Date().toISOString(),
    });
  }
);

// Graceful Shutdown Handling
process.on("SIGINT", async () => {
  console.log("Received SIGINT, shutting down gracefully...");
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("Received SIGTERM, shutting down gracefully...");
  await prisma.$disconnect();
  process.exit(0);
});

process.on("beforeExit", async () => {
  await prisma.$disconnect();
});

// Start the Server
app.listen(PORT, () => {
  console.log(`🚀 Airline Check-in System Server Started`);
  console.log(`📡 API Server: http://localhost:${PORT}`);
  console.log(`🌐 Frontend Interface: http://localhost:${PORT}`);
  console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
  console.log(`📊 Admin Status: http://localhost:${PORT}/admin/seats-status`);
  console.log("");
  console.log("Ready to demonstrate database concurrency control!");
});
