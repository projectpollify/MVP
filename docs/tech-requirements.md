# Pollify Technical Requirements

## MANDATORY TECH STACK - NO EXCEPTIONS

### Backend
- **Language**: TypeScript (100% - no JavaScript files)
- **Runtime**: Node.js 18+ LTS
- **Framework**: Express.js
- **ORM**: Prisma
- **Validation**: Zod

### Database
- **Primary**: PostgreSQL 14+
- **Caching**: Redis (optional for MVP)
- **Sessions**: Database-backed (not memory)

### Blockchain
- **Network**: Cardano Testnet (Preview)
- **API**: Blockfrost
- **Wallet**: Lace (MVP), expand later
- **Library**: @emurgo/cardano-serialization-lib-nodejs

### Frontend
- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State**: Zustand or Context API
- **Wallet Connection**: Custom implementation

### Authentication
- **Method**: Wallet signature verification
- **Sessions**: JWT tokens
- **Storage**: HTTP-only cookies + database sessions

### Development Tools
- **Package Manager**: npm (not yarn/pnpm)
- **Testing**: Jest + Supertest
- **Linting**: ESLint + Prettier
- **Git Hooks**: Husky (optional)

## Code Standards

### TypeScript Configuration
- Strict mode enabled
- No implicit any
- No unused variables
- Explicit return types

### API Design
- RESTful principles
- Consistent naming (/api/v1/...)
- Standard response format
- Proper HTTP status codes

### Security Requirements
- Input validation on all endpoints
- SQL injection prevention (via Prisma)
- XSS protection
- CORS properly configured
- Rate limiting on all endpoints
- Secure session management

### Performance Requirements
- Response time < 200ms for auth
- Database queries optimized
- Proper indexing
- Connection pooling

## Project Structure
```
src/
├── controllers/     # Route handlers
├── middleware/      # Express middleware
├── routes/         # Route definitions
├── services/       # Business logic
├── utils/          # Helper functions
├── types/          # TypeScript types
└── index.ts        # Entry point
```

## Development Workflow
1. Write TypeScript code
2. Run linting
3. Run tests
4. Build for production
5. Deploy

## Deployment Requirements
- Environment variables for configuration
- Health check endpoint
- Graceful shutdown
- Logging configured
- Error tracking (optional for MVP)

## Non-Negotiable Rules
1. **No JavaScript** - TypeScript only
2. **No MongoDB** - PostgreSQL only
3. **No alternative frameworks** - Express only
4. **No Python/Go/Rust** - Node.js only
5. **Follow exact module specifications**
6. **Use prescribed folder structure**
7. **Implement all security measures**

## Version Requirements
Minimum versions required:
- Node.js: 18.0.0
- PostgreSQL: 14.0
- TypeScript: 5.0.0
- Prisma: 5.0.0
- Express: 4.18.0

## Environment Variables Required
See `.env.example` for complete list. All sensitive data must be in environment variables, never hardcoded.
