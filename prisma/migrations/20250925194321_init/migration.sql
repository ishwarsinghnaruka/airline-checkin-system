-- CreateEnum
CREATE TYPE "public"."SeatType" AS ENUM ('ECONOMY', 'BUSINESS', 'FIRST_CLASS', 'EXIT_ROW');

-- CreateTable
CREATE TABLE "public"."flights" (
    "id" SERIAL NOT NULL,
    "flightNumber" TEXT NOT NULL,
    "departure" TEXT NOT NULL,
    "arrival" TEXT NOT NULL,
    "departureTime" TIMESTAMP(3) NOT NULL,
    "arrivalTime" TIMESTAMP(3) NOT NULL,
    "aircraftType" TEXT NOT NULL,
    "totalSeats" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."seats" (
    "id" SERIAL NOT NULL,
    "flightId" INTEGER NOT NULL,
    "seatNumber" TEXT NOT NULL,
    "seatType" "public"."SeatType" NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "price" DECIMAL(8,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "flights_flightNumber_key" ON "public"."flights"("flightNumber");

-- CreateIndex
CREATE UNIQUE INDEX "seats_flightId_seatNumber_key" ON "public"."seats"("flightId", "seatNumber");

-- AddForeignKey
ALTER TABLE "public"."seats" ADD CONSTRAINT "seats_flightId_fkey" FOREIGN KEY ("flightId") REFERENCES "public"."flights"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
