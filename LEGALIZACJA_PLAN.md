# Plan implementacji — Moduł Legalizacja

> Status: **Do implementacji** | Utworzono: 2026-04-12

---

## Założenia

- Nowa baza danych: **nowy plik Google Sheets** o nazwie `Legalizacja` (osobny od głównego Spreadsheet)
- Zdjęcia paszportów: zapisywane w **Google Drive lub Firebase Storage**
- OCR: **Gemini Vision API** (klucz `GOOGLE_GENAI_API_KEY` już jest w `.env.local`)
- Dostęp: **nowa rola** — koordynator działu Legalizacji (`isLegalizacja`)

---

## Struktura arkusza Google Sheets "Legalizacja"

Nowy plik Sheets z arkuszem `Zezwolenia`:

| # | Kolumna | Źródło |
|---|---|---|
| 1 | ID | Auto (timestamp + random) |
| 2 | Nazwisko i imię | OCR z paszportu |
| 3 | Numer paszportu | OCR z paszportu |
| 4 | Data urodzenia | OCR z paszportu |
| 5 | Narodowość | OCR z paszportu |
| 6 | Numer zezwolenia | Ręcznie |
| 7 | Data wydania zezwolenia | Ręcznie |
| 8 | Rok | Auto z daty wydania |
| 9 | Początek terminu ważności | Ręcznie |
| 10 | Koniec terminu ważności | Ręcznie |
| 11 | Klient | Wybór z listy |
| 12 | Zamawiający | Ręcznie |
| 13 | Aktualny status | Wybór z listy |
| 14 | Notatki | Ręcznie |
| 15 | Data zmiany statusu | Auto |
| 16 | URL zdjęcia paszportu | Auto (Drive/Storage) |
| 17 | Dodane przez | Auto (uid koordynatora) |
| 18 | Data dodania | Auto |

---

## Nowa rola użytkownika

Dodać pole `isLegalizacja: boolean` do:

- Tabeli `Coordinators` w Google Sheets (główny plik)
- Interfejsu `SessionData` w `src/types.ts`
- Funkcji `getSession()` / `login()` w `src/lib/auth.ts`
- Panelu zarządzania koordynatorami (ustawienia admina)

Dostęp do zakładki Legalizacja: `isAdmin === true` LUB `isLegalizacja === true`

---

## Fazy implementacji

### Faza 1 — Baza i konfiguracja

- [ ] Stworzyć nowy plik Google Sheets `Legalizacja` na tym samym Google Drive
- [ ] Dodać ID nowego Spreadsheeta do `.env.local` jako `LEGALIZACJA_SPREADSHEET_ID`
- [ ] Stworzyć `src/lib/legalizacja-sheets.ts` — funkcje CRUD dla nowego arkusza
- [ ] Dodać rolę `isLegalizacja` do modelu użytkownika

### Faza 2 — Nowa zakładka w nawigacji

- [ ] Dodać "Legalizacja" do menu (widoczne dla admin + isLegalizacja)
- [ ] Nowy route: `src/app/dashboard/legalizacja/page.tsx`
- [ ] Tabela z listą wszystkich wpisów
  - Kolumny: Nazwisko, Status, Klient, Koniec ważności, Zamawiający
  - Filtrowanie po statusie, kliencie, dacie wygaśnięcia
  - Kolorowanie wierszy: 🔴 wygasło / 🟡 ≤30 dni / 🟢 OK

### Faza 3 — Formularz z OCR paszportu

- [ ] Przycisk "Dodaj zezwolenie" → modal/drawer
- [ ] Upload zdjęcia paszportu (`capture="environment"` — aparat na telefonie)
- [ ] API route `src/app/api/legalizacja/ocr/route.ts`:
  - Wysyła zdjęcie do Gemini Vision API
  - Zwraca: nazwisko, imię, data urodzenia, numer paszportu, narodowość
- [ ] Auto-uzupełnienie pól formularza po OCR
- [ ] Zapis zdjęcia do Google Drive / Firebase Storage
- [ ] API route `src/app/api/legalizacja/route.ts` — zapis do Google Sheets

### Faza 4 — Alerty o wygasaniu

- [ ] Sprawdzanie zezwoleń wygasających za 30 / 14 / 7 dni
- [ ] Push notyfikacje do koordynatorów Legalizacji (infrastruktura push już istnieje)

---

## Pliki do stworzenia

```
src/
├── app/
│   ├── dashboard/
│   │   └── legalizacja/
│   │       └── page.tsx              # Główna strona zakładki
│   └── api/
│       └── legalizacja/
│           ├── route.ts              # GET (lista) + POST (dodaj)
│           ├── [id]/route.ts         # PUT (edytuj) + DELETE
│           └── ocr/route.ts          # POST (analiza zdjęcia paszportu)
└── lib/
    └── legalizacja-sheets.ts         # CRUD dla nowego Spreadsheeta
```

## Pliki do modyfikacji

```
src/
├── types.ts                          # Dodać isLegalizacja, typ LegalizacjaEntry
├── lib/auth.ts                       # Obsługa roli isLegalizacja w login()
└── lib/session.ts                    # Dodać isLegalizacja do SessionData
```

---

## Zależności (już dostępne)

| Zależność | Status |
|---|---|
| `GOOGLE_GENAI_API_KEY` — Gemini Vision OCR | ✅ w `.env.local` |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_PRIVATE_KEY` | ✅ w `.env.local` |
| `google-spreadsheet` npm package | ✅ zainstalowany |
| Web Push infrastruktura (alerty) | ✅ gotowa |

---

## Do ustalenia przed implementacją

- [ ] Zdjęcia paszportów: **Google Drive** (folder) czy **Firebase Storage**?
- [ ] Lista statusów zezwoleń (np. "W trakcie", "Wydane", "Wygasłe", "Odrzucone")
- [ ] Lista klientów — z istniejącej bazy SmartHouse czy osobna?
