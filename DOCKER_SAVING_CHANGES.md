# Paano I-save ang Changes sa Docker

## Problema
Kapag gumagamit ka ng Docker, ang mga changes mo sa code ay hindi na-save o hindi nagre-reflect sa running container.

## Solusyon

### Para sa Development (Recommended)

Gamitin ang **development mode** na may volume mounts:

```bash
# Start development containers
docker-compose -f docker-compose.dev.yml up -d

# O gamitin ang Make command
make dev
```

**Ano ang nangyayari:**
- Ang lahat ng files mo (`client/`, `backend/`, etc.) ay naka-mount as volumes
- Kapag nag-edit ka ng file, automatic na magre-reflect sa container
- Hindi mo na kailangan i-rebuild ang container

### Para sa Production

Kung production mode (`docker-compose.yml`):
- Ang code ay na-copy sa container during build time
- Kailangan mo i-rebuild para makita ang changes:

```bash
docker-compose build --no-cache frontend
docker-compose up -d frontend
```

## Quick Commands

### Development Mode (Recommended para sa pag-edit)
```bash
make dev          # Start development containers
make dev-logs     # View logs
make dev-down     # Stop development containers
```

### Production Mode
```bash
make build        # Build containers
make up           # Start containers
make logs         # View logs
make down         # Stop containers
```

## Important Notes

1. **Development Mode** (`docker-compose.dev.yml`):
   - ✅ Volume mounts enabled - changes save automatically
   - ✅ Hot reload enabled
   - ✅ Perfect for coding and testing

2. **Production Mode** (`docker-compose.yml`):
   - ❌ No volume mounts - need to rebuild
   - ✅ Optimized build
   - ✅ For deployment only

## Troubleshooting

### Changes hindi nagre-reflect?
1. Check kung development mode ang gamit mo:
   ```bash
   docker-compose -f docker-compose.dev.yml ps
   ```

2. Restart ang frontend container:
   ```bash
   docker-compose -f docker-compose.dev.yml restart frontend
   ```

3. Check logs kung may error:
   ```bash
   docker-compose -f docker-compose.dev.yml logs frontend
   ```

### Volume mounts hindi gumagana?
1. Check kung naka-mount ang volumes:
   ```bash
   docker-compose -f docker-compose.dev.yml config
   ```

2. Rebuild development containers:
   ```bash
   make dev-rebuild
   ```

## Summary

**Para sa pag-edit at pag-test:**
```bash
make dev
```

**Para sa production/deployment:**
```bash
make build
make up
```

Ang development mode ay dapat gamitin kapag nag-e-edit ka ng code para automatic na ma-save at ma-reflect ang changes!

