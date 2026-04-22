# Synchronizacja zdjęć na serwer firmy

> Status: **Do wdrożenia** | Utworzono: 2026-04-17
> Opcja: **Hybrid** — Firebase Storage (podgląd w app) + kopia na serwer (bezpieczeństwo)

---

## Kontekst

Zdjęcia z aplikacji (Karty Kontroli, OCR paszportów) muszą być:
1. **Podglądane w aplikacji** — użytkownik klika i widzi zdjęcie
2. **Przechowywane na serwerze firmy** — bezpieczeństwo i backup

Serwer firmy jest **za VPN** — niedostępny z internetu. Firebase App Hosting (chmura) nie może bezpośrednio zapisywać na serwer.

---

## Architektura

```
┌─────────────────────────────┐         ┌──────────────────────────┐
│   APLIKACJA                  │         │  SERWER FIRMY             │
│   (Firebase App Hosting)     │         │  (za VPN)                 │
│                              │         │                            │
│  ┌──────────────┐            │         │  ┌──────────────────┐     │
│  │ Użytkownik    │            │         │  │ Skrypt sync       │     │
│  │ wgrywa zdjęcie│            │         │  │ (cron / service)  │     │
│  └──────┬───────┘            │         │  └────────┬─────────┘     │
│         ▼                    │         │           ▼               │
│  ┌──────────────┐            │         │  ┌──────────────────┐     │
│  │ Next.js API   │            │         │  │ Pobiera nowe     │     │
│  │ → Firebase    │            │         │  │ pliki z Firebase  │     │
│  │   Storage     │───internet───VPN──→│  │ Storage co 5 min │     │
│  │ → Firestore   │            │         │  │ i zapisuje       │     │
│  │   (flaga sync)│            │         │  │ lokalnie         │     │
│  └──────┬───────┘            │         │  └────────┬─────────┘     │
│         ▼                    │         │           ▼               │
│  ┌──────────────┐            │         │  ┌──────────────────┐     │
│  │ <img src>     │            │         │  │ /dane/zdjecia/   │     │
│  │ Signed URL    │            │         │  │ ├── karty-kontroli│     │
│  │ (podgląd OK)  │            │         │  │ └── paszporty/   │     │
│  └──────────────┘            │         │  └──────────────────┘     │
└─────────────────────────────┘         └──────────────────────────┘
```

### Przepływ danych

1. Użytkownik wgrywa zdjęcie w aplikacji
2. Next.js API zapisuje plik do **Firebase Storage** + tworzy rekord w **Firestore** (`pending-sync`) z flagą `synced: false`
3. Aplikacja wyświetla zdjęcie przez **signed URL** z Firebase Storage — podgląd działa natychmiast
4. Skrypt na serwerze firmy (wewnątrz VPN, ale z dostępem do internetu) co 5 minut sprawdza kolekcję `pending-sync` w Firestore
5. Dla każdego rekordu z `synced: false` — pobiera plik z Firebase Storage i zapisuje lokalnie
6. Po udanym zapisie — ustawia `synced: true` w Firestore
7. Zdjęcia zostają w **obu** miejscach — Firebase Storage (podgląd) + serwer (bezpieczeństwo/backup)

---

## Co trzeba zrobić — podział prac

### A. Zmiany w aplikacji (Claude implementuje)

#### 1. OCR paszportów — zapis zdjęcia do Storage

Obecnie zdjęcie paszportu po OCR jest **tracone** — nie zapisywane nigdzie.

**Plik:** `src/ai/flows/extract-passport-data-flow.ts`

**Zmiany:**
- Po wywołaniu OCR, zapisać oryginalne zdjęcie do Firebase Storage w folderze `passports/`
- Zwrócić URL zdjęcia w odpowiedzi
- Dodać pole `passportPhotoUrl` do formularza Legalizacja (przyszły moduł)

```typescript
// Obecny flow:
foto → base64 → Gemini OCR → { firstName, lastName } → foto tracone

// Nowy flow:
foto → base64 → Gemini OCR → { firstName, lastName, photoUrl }
                                          ↓
                              Firebase Storage: passports/{timestamp}_{name}.jpg
                              Firestore pending-sync: { filePath, synced: false }
```

#### 2. Karty kontroli — dodanie flagi sync

Obecnie zdjęcia kart kontroli już idą do Firebase Storage (`actions.ts:2257`).

**Plik:** `src/lib/actions.ts` — funkcja `uploadControlCardPhotoAction`

**Zmiany:**
- Po zapisie do Storage, utworzyć rekord w Firestore `pending-sync`:

```typescript
// Po linii 2272 (po wygenerowaniu signed URL):
await db.collection('pending-sync').add({
  storagePath: safeFileName,      // np. "control-cards/1713288000_kuchnia.jpg"
  syncType: 'control-card',       // lub 'passport'
  uploadedAt: admin.firestore.FieldValue.serverTimestamp(),
  synced: false,
  syncedAt: null,
  metadata: {
    addressId: null,                // opcjonalnie
    employeeName: null,            // opcjonalnie
  }
});
```

#### 3. Nowa kolekcja Firestore: `pending-sync`

| Pole | Typ | Opis |
|------|-----|------|
| `storagePath` | string | Ścieżka pliku w Firebase Storage |
| `syncType` | string | `control-card` lub `passport` |
| `uploadedAt` | timestamp | Kiedy wgrano do Storage |
| `synced` | boolean | Czy serwer już pobrał |
| `syncedAt` | timestamp | Kiedy serwer potwierdził pobranie |
| `metadata` | map | Dodatkowe info (adres, pracownik) |

---

### B. Skrypt synchronizacji na serwer firmy (do uruchomienia przez admina)

#### Opcja 1: Skrypt Node.js (rekomendowana)

**Wymagania na serwerze:**
- Node.js 18+ zainstalowany
- Dostęp do internetu (przez VPN — serwer wychodzi do chmury)
- Dostęp do zapisu w folderze `/dane/zdjecia/`
- Zmienne środowiskowe: `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`

**Plik:** `scripts/sync-photos-to-server.mjs`

```javascript
// scripts/sync-photos-to-server.mjs
import admin from 'firebase-admin';
import { createWriteStream, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';

// --- Konfiguracja ---
const STORAGE_BUCKET = 'studio-6821761262-fdf39.firebasestorage.app';
const LOCAL_BASE_DIR = '/dane/zdjecia';  // ← ZMIEŃ na właściwą ścieżkę
const POLL_INTERVAL_MS = 5 * 60 * 1000;  // 5 minut

// --- Inicjalizacja Firebase Admin ---
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: 'studio-6821761262-fdf39',
    clientEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    privateKey: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
  storageBucket: STORAGE_BUCKET,
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

async function syncPendingFiles() {
  const snapshot = await db.collection('pending-sync')
    .where('synced', '==', false)
    .limit(50)
    .get();

  if (snapshot.empty) return;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const storagePath = data.storagePath;

    try {
      // Pobierz plik z Firebase Storage
      const file = bucket.file(storagePath);
      const localPath = join(LOCAL_BASE_DIR, storagePath);

      // Utwórz foldery jeśli nie istnieją
      const dir = dirname(localPath);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

      // Zapisz lokalnie
      await file.download({ destination: localPath });
      console.log(`✅ Pobrano: ${storagePath} → ${localPath}`);

      // Oznacz jako zsynchronizowane
      await doc.ref.update({
        synced: true,
        syncedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (error) {
      console.error(`❌ Błąd pobierania ${storagePath}:`, error.message);
    }
  }
}

// Główna pętla
console.log(`🔄 Sync uruchomiony — sprawdzanie co ${POLL_INTERVAL_MS / 1000}s`);
syncPendingFiles();
setInterval(syncPendingFiles, POLL_INTERVAL_MS);
```

#### Opcja 2: Skrypt Python

**Wymagania:** Python 3.8+, `firebase-admin` pip package

```bash
pip install firebase-admin
```

**Plik:** `scripts/sync-photos-to-server.py` (do napisania przy wdrożeniu)

#### Uruchomienie jako usługę (Linux — systemd)

```ini
# /etc/systemd/system/smarthouse-photo-sync.service
[Unit]
Description=SmartHouse Photo Sync
After=network.target

[Service]
Type=simple
User=smarthouse
WorkingDirectory=/opt/smarthouse-sync
ExecStart=/usr/bin/node /opt/smarthouse-sync/sync-photos-to-server.mjs
Environment=GOOGLE_SERVICE_ACCOUNT_EMAIL=twoj-email@project.iam.gserviceaccount.com
Environment=GOOGLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable smarthouse-photo-sync
sudo systemctl start smarthouse-photo-sync
sudo systemctl status smarthouse-photo-sync  # sprawdź
journalctl -u smarthouse-photo-sync -f       # logi
```

#### Uruchomienie jako usługę (Windows — Task Scheduler)

1. Otwórz **Task Scheduler** → **Create Task**
2. Trigger: **On startup** + **Repeat every 5 minutes**
3. Action: `node.exe C:\smarthouse-sync\sync-photos-to-server.mjs`
4. Ustaw zmienne środowiskowe w skrypcie `.env`

---

### C. Struktura folderów na serwerze

```
/dane/zdjecia/
├── control-cards/
│   ├── 2026-04/
│   │   ├── 1713288000_kuchnia.jpg
│   │   ├── 1713288100_lazienka.jpg
│   │   └── 1713288200_pokoj_1.jpg
│   └── 2026-05/
│       └── ...
└── passports/
    ├── 2026-04/
    │   ├── 1713288000_nowak_jan.jpg
    │   └── 1713288100_garcia_maria.jpg
    └── 2026-05/
        └── ...
```

---

## Zależności i koszty

| Element | Koszt | Uwagi |
|---------|-------|-------|
| Firebase Storage | ~$0.026/GB/miesiąc | Małe zdjęcia压缩owane do ~200KB |
| Firestore (pending-sync) | Free tier: 50K read/day, 20K write/day | Znacznie poniżej limitu |
| Skrypt sync na serwerze | $0 | Działa na waszym sprzęcie |
| Transfer download | ~$0.12/GB | Raz — przy pobraniu na serwer |

### Szacunkowe zużycie

- 100 zdjęć/miesiąc × 200KB = ~20MB/miesiąc w Storage
- Koszt Firebase Storage: < $1/miesiąc
- Koszt transferu: < $1/miesiąc

---

## Kolejność wdrożenia

### Faza 1 — Przygotowanie w aplikacji (Claude)
- [ ] Dodać zapis zdjęć paszportów do Firebase Storage (obecnie tracone)
- [ ] Dodać tworzenie rekordów `pending-sync` w Firestore przy każdym uploadzie
- [ ] Przetestować że `pending-sync` tworzy się poprawnie

### Faza 2 — Skrypt synchronizacji (Claude pisze, admin uruchamia)
- [ ] Napisać `scripts/sync-photos-to-server.mjs`
- [ ] Naprawdować instrukcję instalacji dla admina (Linux/Windows)
- [ ] Przetestować na serwerze z VPN

### Faza 3 — Monitoring
- [ ] Dodać panel w aplikacji (admin) pokazujący status synchronizacji
- [ ] Alert gdy kolejka `pending-sync` rośnie (serwer offline)

---

## Bezpieczeństwo

- Skrypt na serwerze używa **Service Account** — tylko dostęp do Storage + Firestore, nie do całego projektu
- Zalecane: utworzyć dedykowany Service Account z uprawnieniami:
  - `storage.objects.get` — tylko odczyt Storage
  - `firestore.documents.get/update` — tylko kolekcja `pending-sync`
- Hasło/klucz Service Account przechowywane w `.env` na serwerze, nie w kodzie
- Skrypt loguje każdą operację — audytowalny

---

## Pytania do ustalenia przed wdrożeniem

- [ ] Jaka jest ścieżka bazowa na serwerze? (zamiast `/dane/zdjecia/`)
- [ ] Linux czy Windows na serwerze?
- [ ] Czy Node.js jest zainstalowany na serwerze? Jeśli nie — instalacja Python?
- [ ] Czy chcesz dedykowany Service Account z minimalnymi uprawnieniami?
- [ ] Czy skrypt ma wysyłać powiadomienie email gdy awaria synchronizacji?