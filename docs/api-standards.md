# Pollify API Standards

## Base URL Structure
All API endpoints follow this pattern:
```
/api/v1/{module}/{resource}/{action}
```

## Standard Response Format
All responses must follow this structure:

### Success Response
```json
{
  "success": true,
  "data": {
    // Response data here
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human readable error message" // Optional
}
```

## HTTP Status Codes
- `200` - Success (GET, PUT)
- `201` - Created (POST)
- `204` - No Content (DELETE)
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `429` - Too Many Requests
- `500` - Internal Server Error

## Authentication
All protected endpoints require:
```
Authorization: Bearer {jwt-token}
```

## Standard Headers
```
Content-Type: application/json
Accept: application/json
```

## Pagination
For list endpoints:
```
GET /api/v1/{module}/{resource}?page=1&limit=20&sort=created_at&order=desc
```

Response includes:
```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "pages": 5
    }
  }
}
```

## Error Codes by Module

### Authentication (Module 2)
- `WALLET_NOT_FOUND` - Wallet address not registered
- `INVALID_SIGNATURE` - Wallet signature verification failed
- `NONCE_EXPIRED` - Authentication nonce has expired
- `INVALID_TOKEN` - JWT token is invalid
- `SESSION_EXPIRED` - User session has expired
- `INVALID_MODE` - Invalid user mode specified
- `RATE_LIMITED` - Too many authentication attempts

### Common Errors
- `VALIDATION_ERROR` - Request validation failed
- `NOT_FOUND` - Resource not found
- `UNAUTHORIZED` - Authentication required
- `FORBIDDEN` - Insufficient permissions
- `INTERNAL_ERROR` - Server error occurred

## Rate Limiting
Rate limit headers included in all responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1640995200
```

## Event Emission Format
All modules emit events in this format:
```json
{
  "module": "auth|groups|blockchain|etc",
  "action": "resource:action",
  "payload": {
    // Event data
  },
  "timestamp": "2024-01-01T00:00:00Z",
  "user_id": "uuid"
}
```

## Validation
- Use Zod for request validation
- Return specific validation errors
- Sanitize all inputs
- Validate UUIDs, wallet addresses, etc.
