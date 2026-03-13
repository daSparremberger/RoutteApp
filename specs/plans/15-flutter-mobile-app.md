# Flutter Mobile App Implementation Plan

> **For agentic workers:** This plan covers the Flutter project structure and architecture. Implementation requires Flutter/Dart expertise.

**Goal:** Create a Flutter mobile app for drivers with route navigation, stop management, and student pickup/dropoff tracking.

**Architecture:** Clean architecture with service layer. Screens consume services that wrap HTTP (app-api on port 3001) and Socket.IO. Auth uses Firebase Google Sign-In to obtain a Firebase ID token, then exchanges it with app-api for a JWT. State management via Provider or Riverpod. Background location tracking via a foreground service. Push notifications via FCM with token registration on the backend.

**Tech Stack:** Flutter, Dart, Firebase Auth, Google Maps/Mapbox, Socket.IO client

---

## Project Structure

### Folder Layout

```
apps/mobile/
  lib/
    main.dart
    app.dart                          # MaterialApp, routes, theme
    config/
      env.dart                        # API_BASE_URL, SOCKET_URL, MAPBOX_TOKEN
      routes.dart                     # Named route constants
    models/
      user.dart                       # Driver profile (from /auth/profile)
      rota.dart                       # Route with paradas list
      parada.dart                     # Stop: ordem, lat, lng, aluno_nome, aluno_endereco
      execucao.dart                   # Execution state (id, status, current stop)
    services/
      api_service.dart                # HTTP client wrapping app-api
      auth_service.dart               # Firebase + JWT exchange
      socket_service.dart             # Socket.IO location tracking
      location_service.dart           # GPS + foreground service
      notification_service.dart       # FCM setup + token registration
      storage_service.dart            # SharedPreferences / secure storage
    screens/
      login_screen.dart
      home_screen.dart                # Today's routes list
      route_detail_screen.dart        # Stop list for a route
      navigation_screen.dart          # Map + turn-by-turn
      stop_action_screen.dart         # Embarque / desembarque actions
      profile_screen.dart             # Driver profile
    widgets/
      stop_card.dart                  # Single stop in a list
      route_card.dart                 # Route summary card
      status_badge.dart               # Execution status indicator
      map_view.dart                   # Reusable map widget
      loading_overlay.dart
    providers/
      auth_provider.dart              # Auth state (logged in, JWT, profile)
      route_provider.dart             # Current route + execution state
      location_provider.dart          # Live location stream
  pubspec.yaml
  android/
  ios/
```

---

## Chunk 1: Project Bootstrap

### Task 1: Create Flutter project

Run `flutter create` inside `apps/` to produce `apps/mobile/`. Set `org` to `com.rotavans`. Minimum Android SDK 21, target SDK 34.

### Task 2: Configure pubspec.yaml dependencies

Key dependencies to add:

| Package | Purpose |
|---------|---------|
| `firebase_core` | Firebase init |
| `firebase_auth` | Google Sign-In via Firebase |
| `google_sign_in` | Native Google sign-in flow |
| `firebase_messaging` | FCM push notifications |
| `dio` | HTTP client for app-api |
| `socket_io_client` | Socket.IO for location events |
| `google_maps_flutter` or `mapbox_maps_flutter` | Map rendering |
| `geolocator` | GPS location |
| `flutter_local_notifications` | Local notification display |
| `provider` or `flutter_riverpod` | State management |
| `shared_preferences` | Local key-value storage |
| `flutter_secure_storage` | JWT token storage |
| `image_picker` | Photo capture for uploads |
| `permission_handler` | Runtime permissions |

### Task 3: Firebase project setup

- Add `google-services.json` (Android) and `GoogleService-Info.plist` (iOS) to the project.
- Initialize Firebase in `main.dart` before `runApp()`.

---

## Chunk 2: Auth Flow

### Task 4: Implement AuthService

**File:** `lib/services/auth_service.dart`

Responsibilities:
- `signInWithGoogle()` - triggers `GoogleSignIn` flow, obtains Firebase ID token.
- `exchangeForJwt(String firebaseIdToken)` - calls `POST /auth/firebase` on app-api, receives app JWT + refresh token.
- `storeTokens(String jwt, String refresh)` - persists in secure storage.
- `getJwt()` - retrieves stored JWT for API calls.
- `logout()` - clears tokens, signs out of Firebase.
- `isAuthenticated` - checks if valid JWT exists.

Auth exchange flow:
1. Driver taps "Sign in with Google"
2. Firebase Auth returns `idToken`
3. App sends `POST /auth/firebase { idToken }` to app-api
4. Backend verifies Firebase token, finds/creates driver, returns `{ token, refreshToken, user }`
5. App stores JWT and navigates to Home

### Task 5: Implement AuthProvider

**File:** `lib/providers/auth_provider.dart`

Wraps `AuthService`. Exposes `user`, `isLoading`, `isAuthenticated`. Notifies listeners on state change.

### Task 6: Login Screen

**File:** `lib/screens/login_screen.dart`

Simple screen: Rotavans logo, "Entrar com Google" button. On success, navigate to Home. On error, show snackbar.

---

## Chunk 3: API and Core Services

### Task 7: Implement ApiService

**File:** `lib/services/api_service.dart`

Dio-based HTTP client:
- Base URL from `env.dart` (e.g., `http://10.0.2.2:3001` for emulator).
- Interceptor that attaches `Authorization: Bearer <jwt>` header.
- Interceptor for 401 → attempt token refresh → retry or force logout.
- Methods mapping to driver endpoints:

```
getProfile()             → GET  /auth/profile
getMinhasRotas()         → GET  /motorista/rotas
getRotaDetalhes(id)      → GET  /motorista/rotas/:id
iniciarExecucao(rotaId)  → POST /execucao/iniciar
registrarEmbarque(data)  → POST /execucao/embarque
registrarDesembarque(data) → POST /execucao/desembarque
pularParada(data)        → POST /execucao/pular
concluirExecucao(id)     → POST /execucao/concluir
uploadFile(File)         → POST /uploads (multipart)
registerDeviceToken(tok) → POST /device-tokens
```

### Task 8: Implement SocketService

**File:** `lib/services/socket_service.dart`

- Connect to app-api Socket.IO with JWT in `auth.token` handshake.
- `startTracking()` - subscribes to location stream, emits `location_update { lat, lng, timestamp, execucao_id }` at configurable interval (default 5s).
- `stopTracking()` - stops emitting.
- Listen for server events: `rota_atualizada`, `mensagem_nova`, `execucao_cancelada`.

### Task 9: Implement LocationService

**File:** `lib/services/location_service.dart`

- Uses `geolocator` for high-accuracy GPS.
- Runs as Android foreground service (persistent notification: "Rotavans - Rastreamento ativo").
- Exposes `Stream<Position>` for consumers.
- Handles permission requests via `permission_handler`.

### Task 10: Implement NotificationService

**File:** `lib/services/notification_service.dart`

- Initialize FCM, request notification permission.
- On token refresh, call `ApiService.registerDeviceToken(token)`.
- Handle foreground notifications with `flutter_local_notifications`.
- Handle notification tap → deep link to relevant screen (e.g., route detail).

---

## Chunk 4: Core Screens

### Task 11: Home Screen (Today's Routes)

**File:** `lib/screens/home_screen.dart`

- Fetches `GET /motorista/rotas` on load.
- Displays list of `RouteCard` widgets grouped by period (manha/tarde).
- Each card shows: route name, school, number of stops, departure time, status badge.
- Tap → navigate to RouteDetailScreen.
- Pull-to-refresh.
- Bottom nav or drawer with: Home, Profile, Settings.

### Task 12: Route Detail Screen

**File:** `lib/screens/route_detail_screen.dart`

- Shows route info header (school, vehicle, time).
- Ordered list of stops (`rota_paradas` sorted by `ordem`).
- Each `StopCard` shows: order number, `aluno_nome`, `aluno_endereco`, status icon.
- "Iniciar Rota" button → calls `POST /execucao/iniciar`, then navigates to NavigationScreen.
- If execution already active, show "Continuar" button instead.

### Task 13: Navigation Screen

**File:** `lib/screens/navigation_screen.dart`

- Full-screen map (Google Maps or Mapbox) showing the route polyline.
- Driver's live position marker.
- Stop markers along the route.
- Current/next stop highlighted with info panel at bottom.
- Panel shows: student name, address, distance/ETA to next stop.
- "Chegou na parada" button → opens StopActionScreen.
- "Pular" button → calls `POST /execucao/pular` and advances to next stop.
- On last stop completed → calls `POST /execucao/concluir` and returns to Home.
- SocketService actively sending location updates during this screen.

### Task 14: Stop Action Screen

**File:** `lib/screens/stop_action_screen.dart`

- Modal bottom sheet or full screen overlay.
- Shows student name, address, photo if available.
- Two primary actions:
  - "Embarque" → `POST /execucao/embarque { parada_id, timestamp }`
  - "Desembarque" → `POST /execucao/desembarque { parada_id, timestamp }`
- Optional: capture photo (camera) and upload via `POST /uploads`.
- Optional: add observation text.
- On confirm → return to NavigationScreen, advance to next stop.

### Task 15: Profile Screen

**File:** `lib/screens/profile_screen.dart`

- Displays driver info from `/auth/profile`.
- Photo, name, phone, vehicle info.
- Logout button.

---

## Chunk 5: Models

### Task 16: Define Dart models

Create model classes with `fromJson` / `toJson` factory methods:

**`lib/models/user.dart`** - `DriverUser { id, nome, email, telefone, foto_url, tenant_id }`

**`lib/models/rota.dart`** - `Rota { id, nome, escola_nome, periodo, horario_saida, status, paradas: List<Parada> }`

**`lib/models/parada.dart`** - `Parada { id, ordem, lat, lng, aluno_nome, aluno_endereco, aluno_foto_url, status }`

**`lib/models/execucao.dart`** - `Execucao { id, rota_id, status, parada_atual_ordem, iniciada_em, concluida_em }`

---

## Chunk 6: Background Location and Offline Basics

### Task 17: Background location foreground service

- Android: configure foreground service in `AndroidManifest.xml` with `ACCESS_FINE_LOCATION`, `ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE` permissions.
- Show persistent notification while tracking is active.
- Location updates continue even when app is in background.
- Battery optimization: reduce frequency to 10s when speed < 5 km/h.

### Task 18: Offline queue (basic)

- When network is unavailable, queue embarque/desembarque actions locally (SharedPreferences or SQLite).
- On reconnect, flush queue to API in order.
- Show offline indicator in UI.
- This is a basic implementation; full offline-first sync is out of scope for v1.

---

## Chunk 7: Build and Distribution

### Task 19: Android build configuration

- Configure `android/app/build.gradle`: signing config, minSdkVersion 21, release build type with ProGuard/R8.
- Google Maps API key in `AndroidManifest.xml` (or Mapbox token in appropriate config).
- `flutter build apk --release` produces APK.
- `flutter build appbundle --release` for Play Store.

### Task 20: iOS build configuration (future)

- Configure `ios/Runner/Info.plist` with location usage descriptions.
- Background modes: location, fetch, remote-notification.
- Code signing with Apple Developer account.
- `flutter build ios --release`.

---

## API Endpoints Summary

| Screen | Endpoint | Method |
|--------|----------|--------|
| Auth | `/auth/firebase` | POST |
| Auth | `/auth/profile` | GET |
| Home | `/motorista/rotas` | GET |
| Route Detail | `/motorista/rotas/:id` | GET |
| Navigation | `/execucao/iniciar` | POST |
| Stop Action | `/execucao/embarque` | POST |
| Stop Action | `/execucao/desembarque` | POST |
| Navigation | `/execucao/pular` | POST |
| Navigation | `/execucao/concluir` | POST |
| Uploads | `/uploads` | POST |
| Notifications | `/device-tokens` | POST |

## Socket.IO Events

| Direction | Event | Payload |
|-----------|-------|---------|
| Client → Server | `location_update` | `{ lat, lng, timestamp, execucao_id }` |
| Server → Client | `rota_atualizada` | `{ rota_id, changes }` |
| Server → Client | `mensagem_nova` | `{ mensagem }` |
| Server → Client | `execucao_cancelada` | `{ execucao_id, motivo }` |

---

## Dependencies on Other Plans

- **Plan 05** (App API Auth): Firebase auth exchange endpoint must exist.
- **Plan 06** (Operational Flows): Execution endpoints and Socket.IO server must be implemented.
- **Plan 09** (File Uploads): `POST /uploads` endpoint must be available.
- **Plan 12** (Push Notifications): `POST /device-tokens` endpoint must be available.
- **Mapbox Strategy Spec**: Navigation screen follows the `RoutingProvider` abstraction; mobile app calls app-api for route geometry rather than calling Mapbox directly.

## Completion Criteria

- Driver can sign in with Google and land on Home screen.
- Driver sees today's assigned routes with stop lists.
- Driver can start execution and navigate through stops on map.
- Embarque/desembarque actions are recorded per stop.
- Location is tracked in background and sent via Socket.IO.
- Push notifications are received and device token is registered.
- APK builds successfully.
