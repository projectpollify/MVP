# Pollify.net

A Cardano-based discussion platform enabling authentic discourse through three distinct user modes.

## 🎯 Project Vision

Pollify creates a space where users can engage in discussions with varying levels of identity disclosure:
- **True Self Mode**: Verified identity for professional/official discourse
- **Alias/Shadow Mode**: Consistent pseudonymous identity for regular participation  
- **Soul Mode**: Read-only mode for private browsing

## 🛠 Tech Stack

- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Blockchain**: Cardano (Testnet for MVP)
- **Frontend**: Next.js (React)
- **Authentication**: Cardano wallet (Lace for MVP)
- **API**: RESTful architecture

## 📋 Project Modules

| Module | Status | Description |
|--------|--------|-------------|
| Module 1 | ✅ Complete | Foundation & Architecture |
| Module 2 | 🚧 In Progress | Authentication System |
| Module 3 | 📋 Planned | Groups & Posts |
| Module 4 | 📋 Planned | Blockchain Integration |
| Module 5 | 📋 Planned | Engagement System |
| Module 6 | 📋 Planned | Reputation System |
| Module 7 | 📋 Planned | Moderation Tools |
| Module 8 | 📋 Planned | Search & Discovery |
| Module 9 | 📋 Planned | Analytics Dashboard |
| Module 10 | 📋 Planned | Admin Panel |

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- PostgreSQL 14+
- Cardano Testnet access (via Blockfrost)

### Environment Setup
```bash
# Copy the example environment file
cp .env.example .env

# Install dependencies
npm install

# Run database migrations
npm run db:migrate

# Start development server
npm run dev
```

## 📁 Project Structure
```
pollify-net/
├── docs/                    # Documentation
├── src/                     # Source code
│   ├── controllers/         # Route controllers
│   ├── middleware/          # Express middleware
│   ├── routes/             # API routes
│   ├── services/           # Business logic
│   └── types/              # TypeScript types
├── prisma/                 # Database schema
└── tests/                  # Test files
```

## 📖 Documentation

- [Module 2 - Authentication Specs](./docs/module-2-auth-specs.md)
- [API Standards](./docs/api-standards.md)
- [Database Schema](./docs/database-schema.md)
- [Tech Requirements](./docs/tech-requirements.md)

## 🤝 For Developers

1. Start by reading `/docs/module-2-auth-specs.md`
2. Follow the API patterns defined in `/docs/api-standards.md`
3. Use the exact tech stack specified - no substitutions
4. All code must be TypeScript
5. Follow the existing project structure

## 📧 Contact

Project Owner: [Your Contact Info]
