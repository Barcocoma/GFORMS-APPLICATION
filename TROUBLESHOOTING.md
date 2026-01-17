# Troubleshooting Guide - Login Issues

## Problem: Login takes too long / Not logging in

### Common Causes:

1. **Python Backend is NOT running** ⚠️ (Most Common)
2. **MySQL Database is NOT running**
3. **Database connection configuration is wrong**
4. **Database/Users table doesn't exist**

## Quick Fix Steps:

### Step 1: Check if Python Backend is Running

Open a **new terminal/command prompt** and run:

```bash
cd backend
python app.py
```

You should see:
```
 * Running on http://0.0.0.0:5000
```

**If you see errors:**
- Make sure you installed dependencies: `pip install -r requirements.txt`
- Check if port 5000 is already in use
- Check your `.env` file exists in `backend/` directory

### Step 2: Check Database Connection

In another terminal, run:

```bash
cd backend
python check_backend.py
```

This will test if the backend can connect to MySQL.

**If connection fails:**
1. Start MySQL in XAMPP Control Panel
2. Check your `.env` file in `backend/` directory:
   ```
   DB_HOST=localhost
   DB_NAME=gleentforms
   DB_USER=root
   DB_PASSWORD=your_mysql_password
   DB_PORT=3306
   ```

### Step 3: Verify Database Setup

Make sure database and users exist:

```bash
# Create database
mysql -u root -p < database/schema.sql

# Initialize default accounts
cd backend
python ../database/init_db.py
```

### Step 4: Check Frontend is Running

Make sure React frontend is running:

```bash
pnpm dev
```

Should be running on `http://localhost:8080`

## Complete Startup Sequence:

**Terminal 1 - Backend:**
```bash
cd backend
python app.py
```

**Terminal 2 - Frontend:**
```bash
pnpm dev
```

**Terminal 3 - Check Database (optional):**
```bash
cd backend
python check_backend.py
```

## Error Messages:

### "Connection timeout - make sure Python backend is running on port 5000"
- **Solution:** Start the Python backend: `cd backend && python app.py`

### "Database connection failed"
- **Solution:** 
  1. Start MySQL in XAMPP
  2. Check `.env` file in `backend/` directory
  3. Run `python backend/check_backend.py` to test connection

### "Invalid username or password"
- **Solution:** Make sure you ran `python database/init_db.py` to create default accounts
- Default accounts:
  - Admin: `admin` / `admin123`
  - User: `user` / `user123`

## Testing Backend Manually:

You can test if backend is working by opening:
- `http://localhost:5000/api/ping` - Should return `{"message": "pong"}`

If this doesn't work, backend is not running!

## Network Issues:

If you're still having issues:
1. Check Windows Firewall isn't blocking port 5000
2. Make sure no other application is using port 5000
3. Try restarting both backend and frontend

