# Pollify Development Checklist

## Your Setup Tasks ✅

### Accounts to Create
- [ ] GitHub account created
- [ ] Repository created and public/private
- [ ] Blockfrost account (get testnet API key)
- [ ] PostgreSQL database (Supabase/Neon/Railway)
- [ ] Upwork account (for hiring developers)

### Repository Setup
- [ ] All files from Claude copied to GitHub
- [ ] Repository structure matches the guide
- [ ] README.md looks good
- [ ] .env.example has all variables listed

### Information to Gather
- [ ] Blockfrost Project ID: ________________
- [ ] Database URL: _______________________
- [ ] Your GitHub repository URL: __________

## Developer Hiring Checklist

### Job Posting Must Include
- [ ] Link to GitHub repository
- [ ] Module 2 specification mention
- [ ] Required tech stack (Node.js, TypeScript, PostgreSQL)
- [ ] Cardano/Web3 experience preferred
- [ ] Budget range
- [ ] Timeline (1-2 weeks for Module 2)

### Questions to Ask Developers
- [ ] "Have you worked with Cardano or Web3 wallets?"
- [ ] "Can you show me TypeScript/Node.js code you've written?"
- [ ] "Are you comfortable with the specified tech stack?"
- [ ] "How many hours can you dedicate per week?"
- [ ] "What's your experience with JWT authentication?"

### Red Flags to Avoid
- [ ] Wants to change the tech stack
- [ ] No TypeScript experience
- [ ] Can't show previous work
- [ ] Doesn't ask questions about the specs
- [ ] Quotes unrealistic timelines (too fast or too slow)

## Module 2 Delivery Checklist

### Core Features (Must Have)
- [ ] Lace wallet connection works
- [ ] User can sign message with wallet
- [ ] Backend verifies signature correctly
- [ ] JWT tokens are generated
- [ ] User profile is created automatically
- [ ] Three modes (True/Shadow/Soul) work
- [ ] Sessions are stored in database
- [ ] Rate limiting is implemented

### API Endpoints Working
- [ ] POST /api/v1/auth/nonce
- [ ] POST /api/v1/auth/verify
- [ ] GET /api/v1/auth/me
- [ ] PUT /api/v1/auth/mode
- [ ] POST /api/v1/auth/logout

### Security Checklist
- [ ] Nonces expire after 5 minutes
- [ ] Nonces are one-time use
- [ ] JWT tokens have proper expiration
- [ ] Rate limiting prevents spam
- [ ] No sensitive data in responses

### Documentation Delivered
- [ ] How to test the authentication
- [ ] Any changes from original spec
- [ ] Known issues or limitations
- [ ] Next steps for Module 3

## Testing Module 2

### Manual Testing Steps
1. [ ] Visit the app in browser
2. [ ] Click "Connect Wallet"
3. [ ] Lace wallet popup appears
4. [ ] Can approve connection
5. [ ] Can sign the message
6. [ ] Get logged in successfully
7. [ ] Can see my wallet address
8. [ ] Can switch between modes
9. [ ] Token stays valid for correct time
10. [ ] Logout works properly

### What Success Looks Like
- Smooth wallet connection flow
- No errors in browser console
- Fast response times (< 1 second)
- Clear error messages when things fail
- Can connect, disconnect, reconnect

## Communication with Developer

### Weekly Check-ins Should Cover
- [ ] Progress on implementation
- [ ] Any blockers or issues
- [ ] Questions about specifications
- [ ] Timeline still on track?
- [ ] What they need from you

### Deliverables to Request
- [ ] Source code pushed to GitHub
- [ ] Basic documentation
- [ ] Instructions to run locally
- [ ] List of any issues/TODOs
- [ ] Recommendation for Module 3

## Payment Milestones (Suggested)

### Milestone 1 (25%) - Setup Complete
- [ ] Project setup done
- [ ] Can run locally
- [ ] Database connected
- [ ] Basic structure in place

### Milestone 2 (50%) - Auth Working
- [ ] Wallet connection works
- [ ] Signature verification works
- [ ] Users created in database
- [ ] JWT tokens generated

### Milestone 3 (25%) - Polish & Delivery
- [ ] All endpoints complete
- [ ] Security measures in place
- [ ] Documentation provided
- [ ] Code cleaned up

## After Module 2 Complete

### Prepare for Module 3
- [ ] Review what was built
- [ ] Test everything thoroughly
- [ ] Get Module 3 specs ready
- [ ] Consider same developer?
- [ ] Budget for next phase

### Success Metrics
- [ ] Can create user accounts
- [ ] Authentication is secure
- [ ] Developer followed specs
- [ ] Code is clean and documented
- [ ] Ready for next module

---

**Remember**: You don't need to understand the code. Focus on:
- Can users connect their wallet?
- Does login work smoothly?
- Are the three modes working?
- Is it secure?

Good luck with Module 2! 🚀
