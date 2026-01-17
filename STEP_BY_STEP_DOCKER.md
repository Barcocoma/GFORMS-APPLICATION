# Step-by-Step Guide: Paano Gamitin ang Docker Development Mode

## 🎯 Goal
Gusto mong ma-save at ma-reflect ang lahat ng changes mo sa code kapag gumagamit ng Docker.

---

## 📋 Prerequisites Checklist

Bago ka magsimula, siguraduhin na mayroon ka ng:

- [ ] Docker Desktop installed at running
- [ ] Project folder (`gleentforms-main`) na naka-open
- [ ] Terminal/Command Prompt ready

---

## 🚀 Step-by-Step Instructions

### **STEP 1: Check kung may running containers**

```bash
docker ps
```

**Expected Result:**
- Makikita mo ang list ng running containers
- O walang laman kung wala pang running

**Action:**
- Kung may running containers na, stop muna:
  ```bash
  docker-compose down
  docker-compose -f docker-compose.dev.yml down
  ```

---

### **STEP 2: Check kung may .env file**

```bash
# Windows (PowerShell)
dir .env

# Linux/Mac
ls -la .env
```

**Kung wala:**
```bash
# Copy from example
copy env.example .env

# O kung Linux/Mac:
cp env.example .env
```

**Edit ang `.env` file** at i-update ang:
- `SECRET_KEY` - gumawa ng random string
- `DB_PASSWORD` - database password
- Other values kung kailangan

---

### **STEP 3: Build ang Development Containers**

```bash
docker-compose -f docker-compose.dev.yml build
```

**Expected Result:**
- Makikita mo ang build process
- "Successfully built" message sa dulo
- Takes 2-5 minutes (first time)

**Troubleshooting:**
- Kung may error, check ang Docker Desktop kung running
- Try ulit: `docker-compose -f docker-compose.dev.yml build --no-cache`

---

### **STEP 4: Start ang Development Containers**

```bash
docker-compose -f docker-compose.dev.yml up -d
```

**Expected Result:**
```
Creating gleentforms-db-dev ... done
Creating gleentforms-backend-dev ... done
Creating gleentforms-frontend-dev ... done
```

**O kung gamit ang Make:**
```bash
make dev
```

---

### **STEP 5: Check kung Running na lahat**

```bash
docker-compose -f docker-compose.dev.yml ps
```

**Expected Result:**
```
NAME                        STATUS
gleentforms-db-dev          Up (healthy)
gleentforms-backend-dev     Up
gleentforms-frontend-dev    Up
```

**Kung may "Exit" o "Restarting":**
- Check logs: `docker-compose -f docker-compose.dev.yml logs`
- May error sa configuration

---

### **STEP 6: View Logs (Optional pero Recommended)**

```bash
# View all logs
docker-compose -f docker-compose.dev.yml logs -f

# O specific service
docker-compose -f docker-compose.dev.yml logs -f frontend
docker-compose -f docker-compose.dev.yml logs -f backend
```

**Expected Result:**
- Frontend: "VITE ready in XXX ms" at "Local: http://localhost:8080"
- Backend: "Running on http://0.0.0.0:5000"
- Database: "ready for connections"

**Press `Ctrl+C` para mag-stop ng logs**

---

### **STEP 7: Access ang Application**

**Open sa browser:**
- Frontend: http://localhost:8080
- Backend API: http://localhost:5000/api/ping

**Test:**
1. Open http://localhost:8080
2. Dapat makita mo ang login page
3. Try mag-login

---

### **STEP 8: Test kung Nag-save ang Changes**

**Gawin ito:**

1. **Open ang file:** `client/pages/Login.tsx`

2. **Mag-edit ng simple change:**
   ```tsx
   // Hanapin ang line na may "Welcome Back"
   // Change mo to:
   <CardTitle className="text-3xl font-bold text-center bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
     Welcome Back - TEST
   </CardTitle>
   ```

3. **Save ang file** (Ctrl+S)

4. **Check sa browser:**
   - Refresh ang page (F5)
   - Dapat makita mo ang "Welcome Back - TEST"

**Kung nagre-reflect ang change:**
✅ **SUCCESS!** Volume mounts ay working correctly!

**Kung hindi nagre-reflect:**
- Check logs: `docker-compose -f docker-compose.dev.yml logs frontend`
- Restart frontend: `docker-compose -f docker-compose.dev.yml restart frontend`
- Wait 5-10 seconds then refresh

---

### **STEP 9: Continue Coding**

**Ngayon, pwede ka na mag-edit ng kahit anong file:**

- ✅ `client/` folder - automatic na ma-reflect
- ✅ `backend/` folder - automatic na ma-reflect (may auto-reload)
- ✅ `shared/` folder - automatic na ma-reflect

**Workflow:**
1. Edit file
2. Save (Ctrl+S)
3. Wait 1-2 seconds
4. Refresh browser (F5)
5. See changes!

---

### **STEP 10: Stop Containers (Kapag Tapos na)**

```bash
docker-compose -f docker-compose.dev.yml down
```

**O kung gamit ang Make:**
```bash
make dev-down
```

**Expected Result:**
```
Stopping gleentforms-frontend-dev ... done
Stopping gleentforms-backend-dev  ... done
Stopping gleentforms-db-dev        ... done
```

---

## 🔧 Common Commands Reference

### **Start/Stop**
```bash
# Start development
make dev
# O
docker-compose -f docker-compose.dev.yml up -d

# Stop development
make dev-down
# O
docker-compose -f docker-compose.dev.yml down

# Restart specific service
docker-compose -f docker-compose.dev.yml restart frontend
docker-compose -f docker-compose.dev.yml restart backend
```

### **View Logs**
```bash
# All logs
make dev-logs
# O
docker-compose -f docker-compose.dev.yml logs -f

# Specific service
docker-compose -f docker-compose.dev.yml logs -f frontend
docker-compose -f docker-compose.dev.yml logs -f backend
docker-compose -f docker-compose.dev.yml logs -f db
```

### **Check Status**
```bash
docker-compose -f docker-compose.dev.yml ps
```

### **Rebuild (kung may problema)**
```bash
make dev-rebuild
# O
docker-compose -f docker-compose.dev.yml build --no-cache
docker-compose -f docker-compose.dev.yml up -d
```

---

## ⚠️ Troubleshooting

### **Problem: Changes hindi nagre-reflect**

**Solution 1: Check kung development mode**
```bash
docker-compose -f docker-compose.dev.yml ps
```
Dapat may `-dev` sa container names.

**Solution 2: Restart frontend**
```bash
docker-compose -f docker-compose.dev.yml restart frontend
```

**Solution 3: Check logs**
```bash
docker-compose -f docker-compose.dev.yml logs frontend
```
Look for errors.

**Solution 4: Rebuild**
```bash
make dev-rebuild
```

---

### **Problem: Port already in use**

**Error:** `Bind for 0.0.0.0:8080 failed: port is already allocated`

**Solution:**
1. Stop other services na gumagamit ng port:
   ```bash
   # Check kung ano ang gumagamit
   netstat -ano | findstr :8080
   ```

2. O change port sa `.env`:
   ```
   FRONTEND_PORT=8081
   ```

3. Restart:
   ```bash
   docker-compose -f docker-compose.dev.yml down
   docker-compose -f docker-compose.dev.yml up -d
   ```

---

### **Problem: Database connection error**

**Error:** `Can't connect to MySQL server`

**Solution:**
1. Check database status:
   ```bash
   docker-compose -f docker-compose.dev.yml ps db
   ```

2. Check database logs:
   ```bash
   docker-compose -f docker-compose.dev.yml logs db
   ```

3. Wait for database to be healthy (takes 30-60 seconds on first start)

4. Restart backend:
   ```bash
   docker-compose -f docker-compose.dev.yml restart backend
   ```

---

### **Problem: Frontend can't connect to backend**

**Error:** API calls failing

**Solution:**
1. Check backend is running:
   ```bash
   docker-compose -f docker-compose.dev.yml ps backend
   ```

2. Test backend:
   ```bash
   curl http://localhost:5000/api/ping
   ```

3. Check backend logs:
   ```bash
   docker-compose -f docker-compose.dev.yml logs backend
   ```

---

## 📝 Quick Reference Card

```
┌─────────────────────────────────────────┐
│  DOCKER DEVELOPMENT MODE COMMANDS      │
├─────────────────────────────────────────┤
│  Start:     make dev                    │
│  Stop:      make dev-down               │
│  Logs:     make dev-logs                │
│  Status:    docker ps                   │
│  Rebuild:   make dev-rebuild            │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  URLS                                    │
├─────────────────────────────────────────┤
│  Frontend:  http://localhost:8080       │
│  Backend:   http://localhost:5000       │
│  API Test:  http://localhost:5000/api/ping│
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  IMPORTANT                               │
├─────────────────────────────────────────┤
│  ✅ Use docker-compose.dev.yml          │
│  ✅ Changes auto-save via volumes       │
│  ✅ No need to rebuild for code changes │
│  ❌ Don't use docker-compose.yml        │
│     (production mode, no volumes)       │
└─────────────────────────────────────────┘
```

---

## ✅ Success Checklist

After following all steps, dapat:

- [ ] Containers are running (`docker ps` shows 3 containers)
- [ ] Frontend accessible at http://localhost:8080
- [ ] Backend accessible at http://localhost:5000/api/ping
- [ ] Code changes reflect automatically (tested with Login.tsx)
- [ ] No errors in logs

---

## 🎉 Next Steps

1. **Start coding!** Edit any file in `client/` or `backend/`
2. **Save files** - changes will reflect automatically
3. **Check browser** - refresh to see changes
4. **Check logs** if something doesn't work

**Happy Coding! 🚀**

