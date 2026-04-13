# 🎛️ KI-Mitarbeiter Kontrollzentrum

Ein vollständiges, abgesichertes Web-Dashboard für deinen KI-Assistenten – erreichbar über Tailscale von überall.

---

## Was du im Dashboard tun kannst

| Tab | Funktion |
|-----|----------|
| 📊 Übersicht | Tailscale-Geräte, System-Status, OpenClaw-Version, Schnellübersicht |
| ⏰ Cron Jobs | Anzeigen, aktivieren, pausieren, manuell starten, löschen |
| 🔑 Env-Variablen | Neue Variable eintragen, vorhandene anzeigen (maskiert), löschen |
| 📝 Dokumente | Workspace-Dateien öffnen, lesen, bearbeiten, speichern (Ctrl+S) |

---

## Einrichtung (10 Minuten)

### Schritt 1: Repo klonen
```bash
git clone https://github.com/jasmindipardo/ki-mitarbeiter-kontrollzentrum.git
cd ki-mitarbeiter-kontrollzentrum/dashboard
```

### Schritt 2: Abhängigkeiten installieren
```bash
npm install
```

### Schritt 3: Passwort einrichten (Pflicht!)
```bash
bash setup-password.sh
```
Das Skript fragt dich nach einem Passwort und speichert es sicher unter `~/.openclaw/dashboard.password` (nur du kannst es lesen).

Alternativ über Umgebungsvariable:
```bash
export DASHBOARD_PASSWORD="dein-passwort"
```

### Schritt 4: Dashboard starten
```bash
npm start
```

### Schritt 5: Im Browser öffnen
- **Lokal:** http://localhost:7433
- **Von überall via Tailscale:** http://DEINE-TAILSCALE-IP:7433 (empfohlen und standardmäßig vorgesehen)

Deine Tailscale-IP: `tailscale ip -4`

Wichtig: Das Dashboard sollte nicht öffentlich auf `0.0.0.0` lauschen. Für den Autostart wird deshalb `DASHBOARD_HOST` auf die aktuelle Tailscale-IP gesetzt. Wenn keine Tailscale-IP verfügbar ist, fällt das Setup auf `127.0.0.1` zurück.

---

## Sicherheits-Funktionen

| Schutz | Details |
|--------|---------|
| 🔐 Login-Pflicht | Passwort-Schutz vor dem ersten Aufruf |
| ⏱️ Session-Ablauf | Automatisch nach 8 Stunden ausgeloggt |
| 🔒 CORS-Sperre | Nur Tailscale-IPs (100.x.x.x) und localhost erlaubt |
| 🌐 Bindung nur an Tailscale | Server bindet standardmäßig an `DASHBOARD_HOST` bzw. die Tailscale-IP statt an `0.0.0.0` |
| 🚫 Brute-Force-Schutz | Nach 5 falschen Versuchen: 15 Minuten Sperre |
| ⏱️ Timing-sicherer Login | Verhindert Passwort-Erraten über Antwortzeiten |
| 🛡️ Input-Validierung | Alle IDs und Keys werden auf gültige Zeichen geprüft |
| 💉 Shell-Sanitizing | Sonderzeichen gefiltert → kein Command Injection möglich |
| 📁 Path-Traversal-Schutz | `realpathSync` verhindert `../../` Angriffe |
| 📋 Audit-Log | Alle Logins/Aktionen werden protokolliert |
| 🔑 Env-Werte maskiert | Echte Werte niemals sichtbar im Browser |
| 📏 Payload-Limit | Maximale Request-Größe: 100 KB |
| 🔒 Security-Header | X-Frame-Options, CSP, XSS-Protection aktiv |

---

## Autostart einrichten (für Server)

```bash
sudo nano /etc/systemd/system/ki-dashboard.service
```

```ini
[Unit]
Description=KI-Mitarbeiter Kontrollzentrum
After=network.target tailscaled.service

[Service]
WorkingDirectory=/pfad/zu/ki-mitarbeiter-kontrollzentrum/dashboard
ExecStart=/usr/bin/node server/index.js
Restart=always
User=DEIN-USERNAME
Environment=HOME=/home/DEIN-USERNAME

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable ki-dashboard
sudo systemctl start ki-dashboard
```

---

## Port ändern
```bash
DASHBOARD_PORT=8080 npm start
```

---

## Neben einem anderen Dashboard betreiben

Beide laufen in eigenen Ordnern – kein Konflikt:
```bash
# Unser Dashboard: Port 7433
cd ki-mitarbeiter-kontrollzentrum/dashboard && npm start

# Anderes Dashboard: Port 3112 (in anderem Terminal)
cd vip-mission-control && PORT=3112 npm start
```

Zum Löschen: `rm -rf ki-mitarbeiter-kontrollzentrum` – rückstandslos weg.

---

---

*© Jasmin Di Pardo – Nur für Kunden von Jasmin Di Pardo. Keine kommerzielle Weiterverwendung oder Weitergabe ohne ausdrückliche Genehmigung. Kontakt: *
