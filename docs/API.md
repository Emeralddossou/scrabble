# Scrabble API Documentation

## Authentication

All API endpoints require CSRF token protection. Include the CSRF token in the request headers or body.

### Get CSRF Token
```
GET /backend/api/auth.php?action=csrf
```

**Response:**
```json
{
  "success": true,
  "csrf": "token_value"
}
```

## Authentication Endpoints

### Register
```
POST /backend/api/auth.php?action=register
```

**Request Body:**
```json
{
  "username": "string (3-20 chars)",
  "password": "string (min 10 chars, must contain uppercase, lowercase, digit, special char)",
  "csrf": "string"
}
```

**Response:**
```json
{
  "success": true
}
```

### Login
```
POST /backend/api/auth.php?action=login
```

**Request Body:**
```json
{
  "username": "string",
  "password": "string",
  "csrf": "string"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "username": "player"
  },
  "csrf": "new_token"
}
```

### Logout
```
POST /backend/api/auth.php?action=logout
```

**Response:**
```json
{
  "success": true
}
```

### Change Password
```
POST /backend/api/auth.php?action=change_password
```

**Request Body:**
```json
{
  "current_password": "string",
  "new_password": "string (min 10 chars with complexity requirements)",
  "csrf": "string"
}
```

### Request Password Reset
```
POST /backend/api/auth.php?action=request_reset
```

**Request Body:**
```json
{
  "username": "string",
  "csrf": "string"
}
```

### Reset Password
```
POST /backend/api/auth.php?action=reset_password
```

**Request Body:**
```json
{
  "token": "string",
  "new_password": "string (min 10 chars with complexity requirements)",
  "csrf": "string"
}
```

### Update Profile
```
POST /backend/api/auth.php?action=update_profile
```

**Request Body:**
```json
{
  "bio": "string (max 500 chars)",
  "avatar": "string (URL)",
  "csrf": "string"
}
```

## Game Endpoints

### Create Game
```
POST /backend/api/game.php?action=create
```

**Request Body:**
```json
{
  "mode": "free|timer",
  "time_limit": 0,
  "increment": 0,
  "is_solo": false,
  "csrf": "string"
}
```

### Join Game
```
POST /backend/api/game.php?action=join
```

**Request Body:**
```json
{
  "game_id": 1,
  "csrf": "string"
}
```

### Get Game State
```
GET /backend/api/game.php?action=state&id={game_id}
```

**Response:**
```json
{
  "game": {
    "id": 1,
    "status": "active",
    "mode": "free",
    "current_player_id": 1,
    "board": "json_encoded_board",
    "bag_count": 50
  },
  "me": 1,
  "players": [
    {"user_id": 1, "username": "player1", "score": 10},
    {"user_id": 2, "username": "player2", "score": 5}
  ],
  "my_rack": ["A", "B", "C"],
  "moves": [...]
}
```

### Submit Move
```
POST /backend/api/game.php?action=submit
```

**Request Body:**
```json
{
  "game_id": 1,
  "placements": [
    {"r": 7, "c": 7, "letter": "A"},
    {"r": 7, "c": 8, "letter": "B"}
  ],
  "csrf": "string"
}
```

### Exchange Tiles
```
POST /backend/api/game.php?action=exchange
```

**Request Body:**
```json
{
  "game_id": 1,
  "tiles": ["A", "B"],
  "csrf": "string"
}
```

### Pass Turn
```
POST /backend/api/game.php?action=pass
```

**Request Body:**
```json
{
  "game_id": 1,
  "csrf": "string"
}
```

### Resign
```
POST /backend/api/game.php?action=resign
```

**Request Body:**
```json
{
  "game_id": 1,
  "csrf": "string"
}
```

## Suggestions Endpoint

### Get Word Suggestions
```
POST /backend/api/suggestions.php?action=get_suggestions
```

**Request Body:**
```json
{
  "rack": ["A", "B", "C", "D", "E", "F", "G"],
  "board": null,
  "limit": 10,
  "csrf": "string"
}
```

**Response:**
```json
{
  "success": true,
  "suggestions": [
    {"word": "ABC", "score": 10, "length": 3},
    {"word": "DEF", "score": 8, "length": 3}
  ]
}
```

## Error Responses

All errors follow this format:
```json
{
  "error": "Error message",
  "code": 400
}
```

### Common Error Codes
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

## Security Features

- **CSRF Protection**: All state-changing requests require a valid CSRF token
- **Rate Limiting**: Auth endpoints limited to 15 requests per 5 minutes per session
- **Account Lockout**: 5 failed login attempts lock account for 30 minutes
- **Password Requirements**: Minimum 10 characters with uppercase, lowercase, digit, and special character
- **Session Timeout**: Sessions expire after 2 hours
- **HTTPS Enforcement**: Production requires HTTPS

## Database Schema

### Users Table
- `id` - Primary key
- `username` - Unique username (3-20 chars)
- `password_hash` - Bcrypt hash
- `bio` - User bio (max 500 chars)
- `avatar` - Avatar URL
- `wins` - Win count
- `losses` - Loss count
- `created_at` - Creation timestamp
- `last_seen` - Last activity timestamp

### Games Table
- `id` - Primary key
- `status` - waiting, active, finished
- `mode` - free, timer
- `is_solo` - Solo mode flag
- `time_limit` - Time limit in minutes
- `increment` - Time increment in seconds
- `current_player_id` - Current player
- `winner_id` - Winner ID
- `board` - JSON encoded board
- `bag` - JSON encoded tile bag
- `created_at` - Creation timestamp
- `updated_at` - Last update timestamp
- `last_move_at` - Last move timestamp
- `ended_at` - Game end timestamp

### Moves Table
- `id` - Primary key
- `game_id` - Foreign key to games
- `user_id` - Player ID
- `move_type` - play, exchange, pass
- `details` - JSON encoded move details
- `score` - Score for this move
- `created_at` - Timestamp

### Login Attempts Table
- `id` - Primary key
- `user_id` - Foreign key to users
- `ip_address` - Client IP
- `attempt_count` - Failed attempts
- `locked_until` - Lock expiration
- `created_at` - Timestamp
- `updated_at` - Last update timestamp
