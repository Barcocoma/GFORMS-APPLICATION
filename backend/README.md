# Python Backend - GleentForms

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Create `.env` file (copy from `.env.example`):
```bash
cp .env.example .env
```

3. Update `.env` with your MySQL credentials

4. Run the server:
```bash
python app.py
```

The server will run on `http://localhost:5000`

## API Endpoints

### Authentication

- `POST /api/auth/login` - Login
  - Body: `{ "username": "admin", "password": "admin123" }`
  - Returns: `{ "token": "...", "user": { "id": 1, "username": "admin", "role": "admin" } }`

- `GET /api/auth/verify` - Verify token
  - Headers: `Authorization: Bearer <token>`
  - Returns: `{ "user": { "id": 1, "username": "admin", "role": "admin" } }`

- `POST /api/auth/logout` - Logout
  - Headers: `Authorization: Bearer <token>`
  - Returns: `{ "message": "Logged out successfully" }`

