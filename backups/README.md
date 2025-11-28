# Database Backup & Restore Guide

## 📦 Automatic Backup
- Backups run **every hour** automatically
- Only the **latest backup** is kept (old ones auto-delete)
- Backup location: `./backups/goldhallmark-YYYYMMDD-HHMM.gz`

## 🔄 How to Restore Backup

### Method 1: Using the restore script (Easiest)
```bash
cd /Users/safi/Desktop/gold-hallmark
./scripts/restore-backup.sh
```
- It will find the latest backup automatically
- Asks for confirmation before restoring
- Deletes existing data and restores from backup

### Method 2: Manual restore
```bash
cd /Users/safi/Desktop/gold-hallmark
docker exec -i mongodb mongorestore \
  --db goldhallmark \
  --archive=/backups/goldhallmark-YYYYMMDD-HHMM.gz \
  --gzip \
  --drop
```
Replace `YYYYMMDD-HHMM` with the actual backup filename.

## ⚠️ Important Notes
- **Restore will DELETE all current data** - make sure you want to do this!
- Docker containers must be running before restore
- The backup file must exist in `./backups/` folder

## 🔍 Check Available Backups
```bash
ls -lh /Users/safi/Desktop/gold-hallmark/backups/
```

## 🛠️ Troubleshooting

### If restore fails:
1. Make sure Docker is running: `docker ps`
2. Check if MongoDB container is up: `docker ps | grep mongodb`
3. Verify backup file exists: `ls -lh backups/`

### Manual backup (if needed):
```bash
./scripts/hourly-backup.sh
```

