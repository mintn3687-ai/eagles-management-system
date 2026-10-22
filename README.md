# Eagles Drama Club Register

Mobile-first web app for managing drama club members, attendance, and payments in Kenya.

## Project Structure

```
/eagles-drama-club-register
├── .env.example          # Environment variables template
├── .gitignore            # Git ignore patterns
├── next.config.js        # Next.js configuration
├── package.json          # Project dependencies and scripts
├── prisma/
│   ├── schema.prisma     # Prisma data model
│   └── seed.ts           # Database seed data
├── src/
│   ├── app/              # Next.js App Router pages
│   │   ├── globals.css   # Global styles
│   │   ├── layout.tsx    # Root layout
│   │   └── page.tsx      # Home page
│   ├── components/       # UI components
│   └── lib/              # Library modules
│       ├── auth/         # Authentication logic
│       ├── db/           # Database client
│       ├── dates/        # Kenya date helpers
│       ├── money/        # Money handling utilities
│       ├── permissions/  # Permission checking
│       └── validation/   # Zod validation schemas
└── src/server.ts         # API routes implementation
```

## Installation

1. Clone the repository
2. Copy `.env.example` to `.env.local` and fill in the required variables
3. Run `npm install` to install dependencies
4. Run `npm run db:migrate` to create database tables
5. Run `npm run db:seed` to populate with sample data
6. Run `npm run dev` to start the development server

## Features Implemented (Phase 0)

### Database Schema
- **User**: Authentication with roles (MEMBER, COMMITTEE, SUPER_ADMIN)
- **Member**: Club member records with Kenyan phone format validation
- **Invite**: User invitation system
- **Rehearsal**: Schedule management with check-in codes
- **Attendance**: Present/absent tracking with committee review
- **FeeSetting**: Configurable fees (Registration and Subscription)
- **Payment**: Payment processing with M-Pesa integration support
- **Setting**: Club-wide configuration settings
- **AuditLog**: Activity tracking

### Core Functionality
- Secure authentication with Auth.js
- Kenyan phone number normalization
- Role-based access control
- Zod validation for all inputs
- Africa/Nairobi timezone handling
- Money stored as whole Kenya shillings
- Index optimization for common queries

### Sample Data
- One Super Administrator
- Five sample members (including alumni, pending, active)
- Three rehearsals (scheduled, open, closed)
- Example fees (Registration: 500 KES, Subscription: 200 KES monthly)
- Default club settings

## Environment Variables

Copy `.env.example` to `.env.local` and set:

```
DATABASE_URL=postgresql://user:password@localhost:5432/eagles_drama_club
AUTH_SECRET=your-secret-key-here
MPESA_CONSUMER_KEY=your-mpesa-consumer-key
MPESA_CONSUMER_SECRET=your-mpesa-consumer-secret
MPESA_SHORTCODE=your-mpesa-shortcode
MPESA_PASSKEY=your-mpesa-passkey
MPESA_CALLBACK_URL=https://your-domain.com/api/payments/mpesa-callback
```

## API Endpoints

The application provides RESTful API endpoints for:
- Member management (create, read, update)
- Rehearsal scheduling
- Attendance marking and review
- Payment processing
- User authentication

## Testing

Run the following commands:

```bash
# Type checking
npm run typecheck

# Build application
npm run build

# Run application
npm run start
```

## Technology Stack

- Next.js (App Router) with TypeScript
- Tailwind CSS for styling
- Prisma ORM with PostgreSQL
- Auth.js for authentication
- Zod for validation
- React with client components

## Assumptions

1. The application runs on a free tier, so server operations are optimized for performance
2. All dates are calculated and displayed in Africa/Nairobi timezone
3. Money is stored as integers (whole Kenya shillings)
4. Fee amounts are controlled by the committee through the database
5. There is no public signup - all users are added by committee members
6. Mobile-first design with large tap targets for ease of use
7. Kenyan phone numbers are normalized to the format 2547XXXXXXXX

## Next Steps

Phase 1 will include:
- Authentication screens (login, registration)
- Member management interface
- Rehearsal scheduling interface
- Attendance marking interface
- Payment processing interface
- Analytics dashboard

## License

MIT License