import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export class CheckinService {
  // Helper function to safely extract error messages
  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  // Login with PNR and get booking details
  async loginWithPNR(pnr: string) {
    const booking = await prisma.booking.findUnique({
      where: { pnr },
      include: {
        passenger: true,
        flight: {
          include: {
            seats: {
              where: { isAvailable: true },
              orderBy: { seatNumber: "asc" },
            },
          },
        },
        seat: true,
      },
    });

    if (!booking) {
      throw new Error("Invalid PNR");
    }

    return {
      booking: {
        pnr: booking.pnr,
        status: booking.status,
        checkedIn: booking.checkedIn,
        currentSeat: booking.seat,
      },
      passenger: {
        firstName: booking.passenger.firstName,
        lastName: booking.passenger.lastName,
        email: booking.passenger.email,
      },
      flight: {
        flightNumber: booking.flight.flightNumber,
        departure: booking.flight.departure,
        arrival: booking.flight.arrival,
        departureTime: booking.flight.departureTime,
      },
      availableSeats: booking.flight.seats,
    };
  }

  // UNSAFE VERSION - Auto-assigns next available seat (vulnerable to race condition)
  async selectNextAvailableSeatUnsafe(pnr: string, flightId?: number) {
    console.log(`[UNSAFE] Auto-assigning next available seat for PNR: ${pnr}`);

    const booking = await prisma.booking.findUnique({
      where: { pnr },
    });

    if (!booking) {
      throw new Error("Invalid PNR");
    }

    const targetFlightId = flightId || booking.flightId;

    const availableSeats = await prisma.seat.findMany({
      where: {
        flightId: targetFlightId,
        isAvailable: true,
      },
      orderBy: {
        seatNumber: "asc",
      },
      take: 5,
    });

    if (availableSeats.length === 0) {
      throw new Error("No seats available on this flight");
    }

    for (const seat of availableSeats) {
      try {
        console.log(
          `[UNSAFE] Attempting to book seat: ${seat.seatNumber} for ${pnr}`
        );

        await new Promise((resolve) =>
          setTimeout(resolve, Math.random() * 100)
        );

        const seatCheck = await prisma.seat.findUnique({
          where: { id: seat.id },
        });

        if (!seatCheck?.isAvailable) {
          console.log(
            `[UNSAFE] Seat ${seat.seatNumber} was taken during processing`
          );
          continue;
        }

        await prisma.seat.update({
          where: {
            id: seat.id,
            isAvailable: true,
          },
          data: { isAvailable: false },
        });

        await prisma.booking.update({
          where: { pnr },
          data: {
            seatId: seat.id,
            checkedIn: true,
          },
        });

        console.log(
          `[UNSAFE] Successfully assigned seat ${seat.seatNumber} to ${pnr}`
        );
        return {
          success: true,
          seatNumber: seat.seatNumber,
          seatId: seat.id,
          method: "unsafe",
          attemptsNeeded: availableSeats.indexOf(seat) + 1,
        };
      } catch (error) {
        console.log(
          `[UNSAFE] Failed to book seat ${
            seat.seatNumber
          }: ${this.getErrorMessage(error)}`
        );
        continue;
      }
    }

    throw new Error(
      "Unable to assign any seat - all attempts failed due to concurrent access"
    );
  }

  // SAFE VERSION - Auto-assigns next available seat using SKIP LOCKED
  async selectNextAvailableSeatSafe(pnr: string, flightId?: number) {
    console.log(`[SAFE] Auto-assigning next available seat for PNR: ${pnr}`);

    try {
      const result = await prisma.$transaction(async (tx) => {
        const booking = await tx.booking.findUnique({
          where: { pnr },
        });

        if (!booking) {
          throw new Error("Invalid PNR");
        }

        const targetFlightId = flightId || booking.flightId;

        const availableSeats = await tx.$queryRaw<any[]>`
          SELECT id, "flightId", "seatNumber", "seatType", "isAvailable", price
          FROM seats 
          WHERE "flightId" = ${targetFlightId} AND "isAvailable" = true
          ORDER BY "seatNumber" ASC
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        `;

        if (availableSeats.length === 0) {
          throw new Error(
            "No seats available on this flight or all seats are being processed"
          );
        }

        const seat = availableSeats[0];
        console.log(
          `[SAFE] Acquired exclusive lock on seat: ${seat.seatNumber} for ${pnr}`
        );

        await new Promise((resolve) =>
          setTimeout(resolve, Math.random() * 100)
        );

        await tx.seat.update({
          where: { id: seat.id },
          data: { isAvailable: false },
        });

        await tx.booking.update({
          where: { pnr },
          data: {
            seatId: seat.id,
            checkedIn: true,
          },
        });

        console.log(
          `[SAFE] Successfully assigned seat ${seat.seatNumber} to ${pnr}`
        );
        return {
          success: true,
          seatNumber: seat.seatNumber,
          seatId: seat.id,
          method: "safe",
        };
      });

      return result;
    } catch (error) {
      console.log(
        `[SAFE] Seat assignment failed for ${pnr}: ${this.getErrorMessage(
          error
        )}`
      );
      throw error;
    }
  }

  // Get flight seat map
  async getFlightSeatMap(flightNumber: string) {
    const flight = await prisma.flight.findUnique({
      where: { flightNumber },
      include: {
        seats: {
          orderBy: { seatNumber: "asc" },
        },
      },
    });

    if (!flight) {
      throw new Error("Flight not found");
    }

    return {
      flightNumber: flight.flightNumber,
      departure: flight.departure,
      arrival: flight.arrival,
      departureTime: flight.departureTime,
      totalSeats: flight.totalSeats,
      availableCount: flight.seats.filter((s) => s.isAvailable).length,
      seats: flight.seats,
    };
  }
}
