# Backup ar Restore

Database er backup **nije nije** hoy. Kichu korte hoy na, shudhu app ta (Docker) chalu thakle hobe.

## Kibhabe kaj kore

- App chalu thakle proti 6 ghonta por por ekta backup hoy. PC chalu korar sathe sathe o ekta hoy, jodi shesh backup 6 ghontar beshi purono hoy.
- **Shesh 14 ta** backup thake, ar proti shoptaher ekta copy `weekly/` folder e **8 shoptah** thake.
- Protita backup er por check kora hoy je file ta thik ache. Kharap hole `.BAD.gz` nam hoy, ar **purono bhalo backup muchha hoy na**.
- Order er sonkha hotat ordheker niche neme gele backup ta `.CHECK.gz` nam e rakha hoy, ar purono gula muchha hoy na. Emon file dekhle developer ke janan.
- Shob kaj er hishab: `backup-log.txt`

File er nam: `goldhallmark-20261119-1430.gz` = 19 Nov 2026, dupur 2:30.

## Backup ache kina dekha

`gold-hallmark` folder e Terminal (Mac) ba PowerShell (Windows) khule:

```
docker compose run --rm backup list
```

## Ekhoni ekta backup neya

```
docker compose run --rm backup now
```

## Restore (purono data ferot ana)

**Sabdhan:** restore korle ekhonkar data muche backup er data boshe. Tai age developer er sathe kotha bolun.

Shobcheye notun backup theke:

```
docker compose run --rm backup restore
```

Nirdishto ekta backup theke (nam `list` theke nin):

```
docker compose run --rm backup restore goldhallmark-20261119-1430.gz
```

- Restore er age ekhonkar data ar sonkha dekhabe, ar `yes` likhte bolbe.
- Restore er **age ekhonkar data r ekta safety copy** nibe (`...-before-restore.gz`). Bhul restore holeo oita diye ferot ana jabe.
- Mac e eta o cholbe: `./scripts/restore-backup.sh`

## Photo (customer ar memo r chhobi)

- App er chhobi thake `gold-hallmark/uploads` folder e.
- Proti backup er por notun chhobi gulo `backups/photos/` e copy hoy. Kono chhobi muchha hoy na.
- Chhobi harale: `backups/photos/` er file gulo `uploads/` folder e copy kore din. Database restore er sathe eta alada.

## PC er baire copy (Google Drive)

Google Drive app PC te thakle, `gold-hallmark` folder e `.env` namer file e ei line ta likhun (path ta apnar Drive folder er):

```
BACKUP_HOST_DIR=G:/My Drive/gold-hallmark-backups
```

Tarpor `docker compose up -d`. Ekhon theke backup Drive folder e jabe, Drive nije nije cloud e tule rakhbe.

## Purono script

`scripts/hourly-backup.sh` purono niyom (shudhu shesh copy rakhto). Eta ar lagbe na, `backup` service tar jayga niyeche.
