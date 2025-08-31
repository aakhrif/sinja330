# 🔑 License Key Generator - Anleitung

## Übersicht
Der License Key Generator erstellt zeitbasierte 24-Stunden-Lizenzschlüssel für den Solana Volume Bot. Jeder Key ist kryptographisch signiert und kann nur einmal verwendet werden.

## Voraussetzungen
- Node.js installiert
- Terminal/PowerShell Zugriff
- Arbeitsverzeichnis: `VolumeBot/`

## 📋 Verwendung

### 1. Einfacher License Key (Standard)
```powershell
node scripts/license-generator.js
```

**Output:**
```
🔑 License Key Generator for Volume Bot

Generated License Key:
📋 VB-eyJ......

Validation:
✅ Valid: true
⏰ Expires: 01.09.2025 15:30:00
🕒 Remaining: 23h 59m

💡 Usage:
  node license-generator.js                 - Generate new key
  node license-generator.js validate <key>  - Validate existing key
  node license-generator.js user <name>     - Generate key for specific user
```

### 2. License Key für spezifischen User
```powershell
node scripts/license-generator.js user "KundenName"
```

**Output:**
```
🔑 License Key for user "KundenName":
📋 VB-eyJleHAiOjE3MjUxMzQ0MDAwMDAsInVzZXIiOiJLdW5kZW5OYW1lIiwiaXNzdWVkIjoxNzI1MDQ4MDAwMDAwfQ==.k9l4m0nLQrS8tY5vZ3oafC7eD9uB6xF2
```

### 3. Bestehenden Key validieren
```powershell
node scripts/license-generator.js validate "VB-eyJl..."
```

**Output (Gültig):**
```
🔍 Validation Result: ✅ VALID
⏰ Expires: 01.09.2025 15:30:00
🕒 Remaining: 12h 45m
👤 User: KundenName
```

**Output (Ungültig/Abgelaufen):**
```
🔍 Validation Result: ❌ INVALID
❌ Error: License key expired on 31.08.2025 15:30:00
```

## 🔧 Technische Details

### Key-Format
```
VB-[BASE64_PAYLOAD].[HMAC_SIGNATURE]
```

### Payload-Struktur
```json
{
  "exp": 1725134400000,     // Ablaufzeit (Unix Timestamp)
  "user": "KundenName",     // User-Identifier
  "issued": 1725048000000   // Ausstellungszeit
}
```

### Sicherheitsfeatures
- **HMAC-SHA256 Signierung**: Verhindert Manipulation
- **24h Gültigkeit**: Automatisches Ablaufen
- **Einmalverwendung**: Jeder Key ist unique
- **User-Tracking**: Optional verfolgbar

## 📦 Kundenprozess

### Für den Entwickler (Du):
1. Key generieren: `node scripts/license-generator.js user "Kunde1"`
2. Key an Kunden senden
3. Kunden nutzt Key im Volume Bot

### Für den Kunden:
1. Erhält License Key vom Entwickler
2. Startet Volume Bot
3. Trägt Key in "🔑 License Key" Feld ein
4. Status wird automatisch validiert
5. Bot startet nur bei gültigem Key

## ⚠️ Wichtige Hinweise

### Sicherheit
- Generator wird **NIEMALS** mit der App distribuiert
- Generator bleibt **nur lokal** bei dir
- Keys sind **nicht rückgängig machbar**
- Secret Key **niemals** verändern (bricht alle bestehenden Keys)

### Kundenservice
- Bei abgelaufenen Keys: Neuen Key generieren
- Bei Problemen: Key mit `validate` Befehl prüfen
- Jeder Key funktioniert **genau 24 Stunden**

## 🚀 Produktiver Einsatz

### Empfohlener Workflow:
1. **Kundendaten sammeln**: Name, Kontakt
2. **Key generieren**: `node scripts/license-generator.js user "Kunde_2025-08-31"`
3. **Key versenden**: Sicherer Kanal (Email, etc.)
4. **Support**: Bei Bedarf neue Keys ausstellen

### Automatisierung (Optional):
Du könntest später ein Web-Interface erstellen, das:
- Kundendaten verwaltet
- Keys automatisch generiert
- Ablaufzeiten trackt
- Automatische Verlängerungen anbietet

## 🔍 Troubleshooting

### "License key expired"
- **Lösung**: Neuen Key generieren
- **Befehl**: `node scripts/license-generator.js user "KundenName"`

### "Invalid license key signature"
- **Ursache**: Key wurde manipuliert oder Secret Key geändert
- **Lösung**: Neuen Key ausstellen

### "Malformed license key"
- **Ursache**: Key beim Kopieren beschädigt
- **Lösung**: Key erneut senden oder validieren

### Generator funktioniert nicht
- **Prüfen**: Node.js installiert?
- **Prüfen**: Im richtigen Verzeichnis?
- **Befehl**: `node --version` (sollte v16+ sein)

## 📈 Statistiken & Tracking

Der aktuelle Generator ist basis-funktional. Für professionellen Einsatz könntest du erweitern:

- **Key-Datenbank**: SQLite für User-Tracking
- **Usage-Analytics**: Wie oft wird ein Key verwendet
- **Auto-Renewal**: Automatische Verlängerung
- **Key-Pools**: Vorgenerierte Keys für Verkauf

---

**🎯 Zusammenfassung**: Du generierst Keys lokal, sendest sie an Kunden, Kunden nutzen sie 24h im Bot. Einfach, sicher, effektiv!
