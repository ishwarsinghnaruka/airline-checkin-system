"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    // Check if data already exists
    const existingFlight = await prisma.flight.findUnique({
        where: { flightNumber: "AA123" },
    });
    if (existingFlight) {
        console.log("Data already exists, clearing and reseeding...");
        await prisma.booking.deleteMany();
        await prisma.seat.deleteMany();
        await prisma.passenger.deleteMany();
        await prisma.flight.deleteMany();
    }
    // Create a flight
    const flight = await prisma.flight.create({
        data: {
            flightNumber: "AA123",
            departure: "New York (JFK)",
            arrival: "Los Angeles (LAX)",
            departureTime: new Date("2024-12-01T08:00:00Z"),
            arrivalTime: new Date("2024-12-01T11:30:00Z"),
            aircraftType: "Boeing 737",
            totalSeats: 150,
        },
    });
    // Create seats
    const seats = [];
    // Business class (rows 10-12)
    for (let row = 10; row <= 12; row++) {
        for (const letter of ["A", "B", "C", "D", "E", "F"]) {
            seats.push({
                flightId: flight.id,
                seatNumber: `${row}${letter}`,
                seatType: client_1.SeatType.BUSINESS,
                price: 300.0,
            });
        }
    }
    // Economy class (rows 13-25)
    for (let row = 13; row <= 25; row++) {
        for (const letter of ["A", "B", "C", "D", "E", "F"]) {
            seats.push({
                flightId: flight.id,
                seatNumber: `${row}${letter}`,
                seatType: client_1.SeatType.ECONOMY,
                price: 100.0,
            });
        }
    }
    await prisma.seat.createMany({
        data: seats,
    });
    // Create 100 test passengers and bookings for race condition testing
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
                pnr: `PNR${String(i).padStart(3, "0")}`, // PNR001, PNR002, etc.
                flightId: flight.id,
                passengerId: passenger.id,
                status: client_1.BookingStatus.CONFIRMED,
            },
        });
    }
    console.log("Seed data created successfully!");
    console.log("- 1 flight (AA123)");
    console.log(`- ${seats.length} seats`);
    console.log("- 100 passengers with unique PNRs (PNR001-PNR100)");
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
