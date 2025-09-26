# Airline Check-in System

A comprehensive demonstration of database concurrency control in high-traffic applications using TypeScript, Node.js, PostgreSQL, and Prisma ORM.

## 🎯 Project Overview

This system addresses a critical challenge in distributed systems: **preventing race conditions when multiple users simultaneously attempt to book seats on the same flight**. The application demonstrates both the problem (unsafe method) and solution (safe method using PostgreSQL's `FOR UPDATE SKIP LOCKED`) through an interactive web interface.

### Key Learning Objectives

- **Database Concurrency Control**: Understanding race conditions and prevention mechanisms
- **Pessimistic Locking**: Implementation of `FOR UPDATE SKIP LOCKED` in PostgreSQL
- **Load Testing**: Validating system behavior under concurrent load (100+ users)
- **Real-world Application**: Airline booking system constraints and business rules

## 🚀 Live Demo

**Deployed Application**: [https://airline-checkin-system-production.up.railway.app](https://airline-checkin-system-production.up.railway.app)

### Demo Features

- Interactive seat map visualization
- Real-time concurrency testing (safe vs unsafe methods)
- 100+ concurrent user simulation
- Live performance metrics and race condition detection

## 🏗️ Architecture

### Technology Stack

- **Backend**: Node.js with TypeScript, Express.js
- **Database**: PostgreSQL with Prisma ORM
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **Deployment**: Railway Platform
- **Testing**: Custom load testing with Axios

### Database Schema

```
Flight (1) → (many) Seats
Flight (1) → (many) Bookings
Passenger (1) → (many) Bookings
Seat (1) → (1) Booking (optional)
```

## 🛠️ Local Development Setup

### Prerequisites

- Node.js (v18+)
- PostgreSQL (v14+)
- Git

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/ishwarsinghnaruka/airline-checkin-system.git
cd airline-checkin-system
```

2. **Install dependencies**

```bash
npm install
```

3. **Configure environment variables**

```bash
# Create .env file
echo "DATABASE_URL=postgresql://admin:password@localhost:5432/airline_checkin" > .env
echo "NODE_ENV=development" >> .env
echo "PORT=3000" >> .env
```

4. **Setup database**

```bash
# Run Prisma migrations
npx prisma migrate dev --name init

# Generate Prisma client
npx prisma generate

# Seed database with test data
npm run seed
```

5. **Start development server**

```bash
npm run dev
```

Visit `http://localhost:3000` to access the application.

## 🔄 Core Concurrency Implementation

### Unsafe Method (Race Condition Prone)

```typescript
// Multiple users can read the same "available" seat simultaneously
const availableSeat = await prisma.seat.findFirst({
  where: { isAvailable: true },
  orderBy: { seatNumber: "asc" },
});

// Race condition window - multiple transactions can proceed with same seat
await prisma.seat.update({
  where: { id: availableSeat.id },
  data: { isAvailable: false },
});
```

### Safe Method (SKIP LOCKED)

```typescript
// Atomic seat selection with row-level locking
const availableSeats = await tx.$queryRaw`
  SELECT id, "seatNumber" 
  FROM seats 
  WHERE "isAvailable" = true
  ORDER BY "seatNumber" ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED
`;
```

## 🧪 Testing & Performance

### Load Testing

Run concurrent user simulation:

```bash
node tests/loadTest.cjs
```

### Expected Results

- **Unsafe Method**: 5% success rate, potential race conditions
- **Safe Method**: 96% success rate, guaranteed consistency

### Manual Testing

1. **Individual Check-in**: Test single-user seat selection
2. **PNR Login**: Use test PNRs (PNR001-PNR100)
3. **Concurrency Testing**: Run 100-user simulations via web interface
4. **Admin Functions**: Reset seats, view system status

## 📊 Performance Metrics

Based on load testing with 100 concurrent users:

| Method | Success Rate | Avg Response Time | Throughput  | Race Conditions |
| ------ | ------------ | ----------------- | ----------- | --------------- |
| Unsafe | 5%           | 745ms             | 134 req/sec | High            |
| Safe   | 96%          | 644ms             | 155 req/sec | None            |

## 🚀 Deployment

### Railway Deployment

1. **Push to GitHub**

```bash
git add .
git commit -m "Initial deployment"
git push origin main
```

2. **Deploy to Railway**

- Connect GitHub repository at [railway.app](https://railway.app)
- Add PostgreSQL database service
- Set environment variables (`NODE_ENV=production`)
- Automatic deployment on Git push

3. **Initialize Database**

```bash
# Via Railway CLI
railway shell
npx prisma migrate deploy
npm run seed
```

### Alternative Deployment Platforms

- **Render**: Connect GitHub repo, add PostgreSQL addon
- **Heroku**: Use Heroku PostgreSQL addon, configure Procfile
- **Vercel**: For serverless deployment with external database

## 📁 Project Structure

```
airline-checkin-ts/
├── src/
│   ├── app.ts                 # Express server and routes
│   └── services/
│       └── checkinService.ts  # Business logic and concurrency control
├── prisma/
│   ├── schema.prisma          # Database schema definition
│   └── seed.ts               # Test data generation
├── public/
│   └── index.html            # Frontend interface
├── tests/
│   └── loadTest.cjs          # Concurrency load testing
├── package.json              # Dependencies and scripts
├── tsconfig.json             # TypeScript configuration
└── README.md                 # Project documentation
```

## 🔧 API Endpoints

### Check-in Operations

- `POST /checkin/login` - PNR authentication
- `POST /checkin/auto-assign-seat-safe` - Safe seat assignment
- `POST /checkin/auto-assign-seat-unsafe` - Unsafe seat assignment

### Flight Information

- `GET /flights/:flightNumber/seats` - Seat map data
- `GET /health` - System health check

### Administrative

- `POST /admin/reset-all-seats` - Reset system for testing
- `GET /admin/seats-status` - Real-time seat utilization
- `POST /admin/seed-database` - Manual database seeding

## 🎓 Learning Outcomes

This project demonstrates mastery of:

### Database Concepts

- **ACID Properties**: Atomicity, Consistency, Isolation, Durability
- **Transaction Isolation**: Row-level locking mechanisms
- **Concurrency Control**: Pessimistic vs optimistic locking strategies
- **Database Performance**: Impact of locking on throughput

### Software Engineering

- **System Design**: Layered architecture with separation of concerns
- **Error Handling**: Graceful degradation under load
- **Testing Strategy**: Load testing and performance validation
- **Documentation**: Comprehensive technical documentation

### Real-world Applications

- **Airline Industry**: Seat inventory management challenges
- **E-commerce**: High-demand product booking systems
- **Event Ticketing**: Concurrent reservation handling
- **Financial Systems**: Transaction processing under load

## 🐛 Troubleshooting

### Common Issues

**Database Connection Errors**

```bash
# Check DATABASE_URL format
echo $DATABASE_URL

# Verify PostgreSQL service is running
pg_isready -h localhost -p 5432
```

**TypeScript Compilation Errors**

```bash
# Clean build
rm -rf dist/
npm run build
```

**Race Condition Not Visible**

- Increase concurrent user count in load tests
- Add artificial delays in processing
- Check database query execution plans

### Development Tips

- Use `npm run dev` for hot reloading during development
- Monitor database locks with `SELECT * FROM pg_locks;`
- Test concurrency scenarios with varying loads
- Implement comprehensive error logging for production debugging

## 📈 Future Enhancements

### Potential Extensions

1. **Boarding Pass Generation**: Complete check-in workflow
2. **Seat Preferences**: Priority-based assignment algorithms
3. **Payment Integration**: Premium seat upgrade processing
4. **Real-time Updates**: WebSocket-based live seat map
5. **Multi-flight Support**: Complex itinerary management
6. **Analytics Dashboard**: Performance monitoring and insights

### Advanced Concurrency Patterns

- **Optimistic Locking**: Version-based conflict detection
- **Distributed Locking**: Redis-based coordination
- **Event Sourcing**: Audit trail for all seat assignments
- **CQRS**: Separate read/write models for scalability

## 📝 License

This project is created for educational purposes, demonstrating database concurrency control concepts in real-world applications.

## 🤝 Contributing

This is an educational project showcasing database concurrency concepts. Feel free to explore the code, run your own experiments, and adapt the patterns for your learning objectives.

---

**Built with** TypeScript, Node.js, PostgreSQL, Prisma, and Railway Platform
