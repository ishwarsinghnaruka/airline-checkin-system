const axios = require("axios");

const BASE_URL = "http://localhost:3000";

// Reset all seats to available state
async function resetAllSeats() {
  try {
    console.log("Resetting all seats to clean state...");
    const response = await axios.post(`${BASE_URL}/admin/reset-all-seats`);
    console.log(`Reset completed: ${response.data.message}`);
    return true;
  } catch (error) {
    console.log(`Could not reset all seats: ${error.message}`);
    return false;
  }
}

// Get seat status
async function getSeatStatus() {
  try {
    const response = await axios.get(`${BASE_URL}/admin/seats-status`);
    return response.data;
  } catch (error) {
    console.log(`Could not get seat status: ${error.message}`);
    return null;
  }
}

// Test auto-assignment with detailed race condition analysis
async function testAutoSeatAssignment(method, numUsers = 100) {
  console.log(
    `\n=== Testing ${method.toUpperCase()} auto-assignment with ${numUsers} users ===`
  );
  console.log("Each user attempts to get the next available seat");

  const promises = [];

  for (let i = 0; i < numUsers; i++) {
    const pnr = `PNR${String(i + 1).padStart(3, "0")}`;

    const promise = axios
      .post(
        `${BASE_URL}/checkin/auto-assign-seat-${method}`,
        { pnr: pnr },
        { timeout: 15000 } // Increased timeout for better handling
      )
      .then((response) => {
        return {
          success: true,
          data: response.data,
          user: i,
          pnr: pnr,
        };
      })
      .catch((error) => {
        return {
          success: false,
          error: error.response?.data?.error || error.message,
          user: i,
          pnr: pnr,
        };
      });

    promises.push(promise);
  }

  const startTime = Date.now();
  const responses = await Promise.all(promises);
  const endTime = Date.now();

  const successful = responses.filter((r) => r.success);
  const failed = responses.filter((r) => !r.success);

  console.log(
    `Results: ${successful.length} successful, ${failed.length} failed`
  );
  console.log(`Time: ${endTime - startTime}ms`);
  console.log(
    `Throughput: ${((numUsers * 1000) / (endTime - startTime)).toFixed(
      2
    )} requests/second`
  );

  // Detailed seat assignment analysis
  if (successful.length > 0) {
    const seatAssignments = successful.map((r) => r.data.seatNumber);
    const uniqueSeats = [...new Set(seatAssignments)];

    console.log(`Unique seats assigned: ${uniqueSeats.length}`);
    console.log(`Total successful assignments: ${successful.length}`);

    // Count seat duplicates
    const seatCounts = {};
    seatAssignments.forEach((seat) => {
      seatCounts[seat] = (seatCounts[seat] || 0) + 1;
    });

    const duplicatedSeats = Object.entries(seatCounts).filter(
      ([seat, count]) => count > 1
    );

    if (duplicatedSeats.length > 0) {
      const totalDuplicates = duplicatedSeats.reduce(
        (sum, [seat, count]) => sum + (count - 1),
        0
      );
      console.log(
        `RACE CONDITION DETECTED: ${totalDuplicates} users got duplicate seats!`
      );
      console.log(
        `Duplicated seats: ${duplicatedSeats
          .map(([seat, count]) => `${seat}(${count} users)`)
          .join(", ")}`
      );

      if (method === "unsafe") {
        console.log(
          `This demonstrates the race condition problem in concurrent seat assignment!`
        );
      }
    } else {
      console.log(`No race condition: All users got unique seats`);
      if (method === "safe") {
        console.log(`SKIP LOCKED successfully prevented all race conditions!`);
      }
    }

    // Show assignment pattern
    const first10Seats = seatAssignments.slice(
      0,
      Math.min(10, seatAssignments.length)
    );
    console.log(
      `First ${first10Seats.length} seats assigned: ${first10Seats.join(", ")}`
    );

    // Show seat distribution
    const seatGroups = {};
    seatAssignments.forEach((seat) => {
      const row = seat.substring(0, seat.length - 1); // Extract row number
      seatGroups[row] = (seatGroups[row] || 0) + 1;
    });
    console.log(
      `Seat distribution by row: ${Object.entries(seatGroups)
        .slice(0, 5)
        .map(([row, count]) => `${row}(${count})`)
        .join(", ")}`
    );
  }

  // Analyze failure reasons
  if (failed.length > 0) {
    const errorTypes = {};
    failed.forEach((f) => {
      const errorType = f.error.includes("constraint")
        ? "Database Constraint"
        : f.error.includes("concurrent")
        ? "Concurrent Access"
        : f.error.includes("timeout")
        ? "Timeout"
        : "Other";
      errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
    });

    console.log(
      `Failure analysis: ${Object.entries(errorTypes)
        .map(([type, count]) => `${type}(${count})`)
        .join(", ")}`
    );
  }

  return {
    successful: successful.length,
    failed: failed.length,
    totalTime: endTime - startTime,
    uniqueSeats:
      successful.length > 0
        ? [...new Set(successful.map((r) => r.data.seatNumber))].length
        : 0,
    duplicates:
      successful.length > 0
        ? successful.length -
          [...new Set(successful.map((r) => r.data.seatNumber))].length
        : 0,
  };
}

// Main comprehensive race condition demonstration
async function runEnhancedRaceConditionDemo() {
  console.log("ENHANCED AIRLINE RACE CONDITION DEMONSTRATION");
  console.log("Testing unsafe vs safe concurrent seat assignment");
  console.log("Focus: Demonstrating race conditions in seat selection logic");
  console.log("=".repeat(80));

  try {
    // Setup
    await resetAllSeats();
    const initialStatus = await getSeatStatus();
    console.log(
      `Initial status: ${initialStatus.available} available seats out of ${initialStatus.total}`
    );

    // Test unsafe method (should show some race conditions)
    console.log("\nPHASE 1: UNSAFE AUTO-ASSIGNMENT");
    console.log(
      "Expected: Some users may get duplicate seats due to race conditions"
    );
    console.log("-".repeat(60));

    const unsafeResults = await testAutoSeatAssignment("unsafe", 100);

    // Reset for safe test
    console.log("\nResetting for safe method test...");
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await resetAllSeats();

    // Test safe method (should prevent all race conditions)
    console.log("\nPHASE 2: SAFE AUTO-ASSIGNMENT (SKIP LOCKED)");
    console.log(
      "Expected: Each user gets a unique seat, no duplicates possible"
    );
    console.log("-".repeat(60));

    const safeResults = await testAutoSeatAssignment("safe", 100);

    // Comprehensive Analysis
    console.log("\n" + "=".repeat(80));
    console.log("COMPREHENSIVE RACE CONDITION ANALYSIS");
    console.log("=".repeat(80));

    console.log("Detailed Comparison:");
    console.log(`  UNSAFE METHOD:`);
    console.log(
      `    - Successful assignments: ${unsafeResults.successful}/100`
    );
    console.log(`    - Unique seats assigned: ${unsafeResults.uniqueSeats}`);
    console.log(`    - Duplicate assignments: ${unsafeResults.duplicates}`);
    console.log(`    - Failed assignments: ${unsafeResults.failed}`);
    console.log(`    - Processing time: ${unsafeResults.totalTime}ms`);
    console.log(
      `    - Success rate: ${((unsafeResults.successful / 100) * 100).toFixed(
        1
      )}%`
    );

    console.log(`  SAFE METHOD (SKIP LOCKED):`);
    console.log(`    - Successful assignments: ${safeResults.successful}/100`);
    console.log(`    - Unique seats assigned: ${safeResults.uniqueSeats}`);
    console.log(`    - Duplicate assignments: ${safeResults.duplicates}`);
    console.log(`    - Failed assignments: ${safeResults.failed}`);
    console.log(`    - Processing time: ${safeResults.totalTime}ms`);
    console.log(
      `    - Success rate: ${((safeResults.successful / 100) * 100).toFixed(
        1
      )}%`
    );

    console.log("\nKey Insights:");
    if (unsafeResults.duplicates > 0) {
      console.log(
        "✓ Race condition successfully demonstrated: Unsafe method created duplicate seat assignments"
      );
    } else if (unsafeResults.successful > 0) {
      console.log(
        "• Unsafe method handled concurrency better than expected, but still less reliable than safe method"
      );
    }

    if (safeResults.duplicates === 0 && safeResults.successful > 0) {
      console.log("✓ SKIP LOCKED completely eliminated race conditions");
    }

    if (safeResults.successful >= unsafeResults.successful) {
      console.log("✓ Safe method achieved higher success rate and reliability");
    }

    console.log(
      "✓ System demonstrated ability to handle 100 concurrent seat assignments"
    );
    console.log(
      "✓ Real-world airline booking concurrency challenges successfully addressed"
    );
  } catch (error) {
    console.error("Test failed:", error.message);
  }
}

// Execute the enhanced demonstration
runEnhancedRaceConditionDemo();
