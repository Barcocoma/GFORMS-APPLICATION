# Docker Setup for GleentForm

This guide explains how to run the GleentForm application using Docker.

## Prerequisites

- Docker Desktop installed ([Download here](https://www.docker.com/products/docker-desktop))
- Docker Compose (included with Docker Desktop)

## Quick Start

### Option 1: Using Make (Recommended)

```bash
# Copy environment file
cp env.example .env

# Edit .env and update SECRET_KEY

# Build and start all services
make build
make up

# View logs
make logs

# Initialize database (if needed)
make init-db
```

### Option 2: Using Docker Compose Directly

### 1. Create Environment File

Copy the example environment file:
```bash
cp env.example .env
```

Edit `.env` and update the values if needed (especially `SECRET_KEY` for production).

### 2. Start All Services

```bash
docker-compose up -d
```

This will start:
- **MySQL Database** on port 3306
- **Python Backend** on port 5000
- **React Frontend** on port 8080

### 3. Initialize Database

The database schema will be automatically created, but you may need to initialize default users:

```bash
docker-compose exec backend python database/init_db.py
```

### 4. Access the Application

- **Frontend**: http://localhost:8080
- **Backend API**: http://localhost:5000
- **Database**: localhost:3306

## Development Mode

For development with hot reload (changes save automatically):

```bash
docker-compose -f docker-compose.dev.yml up
```

This will:
- Mount your code as volumes (changes reflect immediately)
- Enable Flask debug mode for backend
- Run Vite dev server for frontend with hot module replacement
- Keep the database running

**Important**: All your code changes will be saved and reflected immediately because volumes are mounted!

### 📖 Step-by-Step Guide

**For detailed instructions, see:** [`STEP_BY_STEP_DOCKER.md`](./STEP_BY_STEP_DOCKER.md)

Quick start:
1. **Start development containers:**
   ```bash
   make dev
   # O
   docker-compose -f docker-compose.dev.yml up -d
   ```

2. **View logs:**
   ```bash
   make dev-logs
   # O
   docker-compose -f docker-compose.dev.yml logs -f
   ```

3. **Make changes to your code** - they will automatically reflect in the running containers!

4. **Stop development containers:**
   ```bash
   make dev-down
   # O
   docker-compose -f docker-compose.dev.yml down
   ```

**Note**: The development setup uses volume mounts, so all changes you make to files in `client/`, `backend/`, etc. will be immediately visible in the running containers.

## Useful Commands

### Using Make (Easier)

```bash
make help          # Show all available commands
make build         # Build Docker images
make up            # Start all services
make down          # Stop all services
make logs          # View all logs
make logs-backend  # View backend logs only
make logs-frontend # View frontend logs only
make logs-db       # View database logs only
make restart       # Restart all services
make init-db       # Initialize database
make shell-backend # Open shell in backend container
make shell-db      # Open MySQL shell
make rebuild       # Rebuild and restart
make clean         # Remove everything (⚠️ Deletes data)
make dev           # Start in development mode
```

### Using Docker Compose Directly

```bash
# View Logs
docker-compose logs -f                    # All services
docker-compose logs -f backend            # Backend only
docker-compose logs -f frontend           # Frontend only
docker-compose logs -f db                 # Database only

# Stop Services
docker-compose down                       # Stop
docker-compose down -v                   # Stop and remove volumes (⚠️ Deletes data)

# Rebuild
docker-compose build --no-cache
docker-compose up -d

# Access Services
docker-compose exec db mysql -u root -p gleentforms
docker-compose exec backend bash
docker-compose restart backend
```

## Environment Variables

Key environment variables in `.env`:

- `DB_HOST`: Database host (use `db` in Docker)
- `DB_NAME`: Database name (default: `gleentforms`)
- `DB_USER`: Database user
- `DB_PASSWORD`: Database password
- `SECRET_KEY`: Flask secret key (change in production!)
- `FRONTEND_PORT`: Frontend port (default: 8080)

## Production Deployment

For production:

1. **Change `SECRET_KEY`** in `.env` to a strong random value
2. **Update database credentials**
3. **Use production Docker images** or build your own
4. **Set up SSL/TLS** (use a reverse proxy like Traefik or Nginx)
5. **Configure backups** for the database volume

## Troubleshooting

### Database Connection Issues
- Check if database is healthy: `docker-compose ps`
- Check database logs: `docker-compose logs db`
- Ensure database is ready before backend starts (healthcheck handles this)

### Port Already in Use
- Change ports in `.env` or `docker-compose.yml`
- Stop conflicting services

### Frontend Can't Connect to Backend
- Ensure backend is running: `docker-compose ps`
- Check backend logs: `docker-compose logs backend`
- Verify API proxy in `nginx.conf`

### Database Not Initialized
- Run manually: `docker-compose exec backend python database/init_db.py`
- Check if schema.sql was loaded: `docker-compose logs db`

## Architecture

```
┌─────────────┐
│  Frontend   │ (Nginx serving React SPA)
│  Port 8080  │
└──────┬──────┘
       │ /api → proxy
       ↓
┌─────────────┐
│  Backend    │ (Flask API)
│  Port 5000  │
└──────┬──────┘
       │
       ↓
┌─────────────┐
│  Database   │ (MySQL)
│  Port 3306  │
└─────────────┘
```

All services communicate through Docker's internal network.

