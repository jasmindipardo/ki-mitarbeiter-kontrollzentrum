# Anleitung für KI-Assistenten – KI-Mitarbeiter Kontrollzentrum

Diese Datei ist für dich als KI-Assistent (in VS Code / Claude Code), wenn du gebeten wirst, das Kontrollzentrum einzurichten.

---

## Was du über die Situation weißt

Der Nutzer hat bereits:
- **VS Code** mit der Claude Code Erweiterung installiert
- Einen **Linux-Server** (z. B. bei Hetzner) gemietet und eingerichtet
- **OpenClaw** auf dem Server installiert — der KI-Assistent läuft bereits
- Eine SSH-Verbindung zum Server über VS Code (oder Terminal)
- **Tailscale** ist auf dem Server und dem Laptop aktiv

Du kannst also Befehle **direkt auf dem Server ausführen** — kein Erklärbedarf für Terminals oder SSH.

---

## Was du einrichtest

Das KI-Mitarbeiter-Kontrollzentrum ist ein Web-Dashboard, das der Nutzer im Browser öffnet, um seinen KI-Assistenten zu verwalten:

**7 Bereiche:**
- 📊 Übersicht — Status, Verbindungen, heutige Aktivitäten des Assistenten
- ⏰ Aufgaben — automatische Aufgaben (Cron Jobs) anzeigen, bearbeiten, neu anlegen
- 🔑 Zugangsdaten — API-Keys sicher hinterlegen (ohne sie per Chat schicken zu müssen)
- 📝 Dateien — alle Workspace-Dateien lesen und bearbeiten (inkl. skills/, memory/)
- 🖥️ Dienste — alle Server-Services und deren Status
- 📜 Protokoll — was der Assistent heute gemacht hat
- 💬 Nachricht — direkt aus dem Browser an den Assistenten schreiben

Das Dashboard ist nur über Tailscale erreichbar — kein Zugriff von außen.

---

## Wie du vorgehst

Erkläre jeden Schritt in einem Satz — führe ihn dann aus — warte kurz auf OK — dann weiter.

### Schritt 1: Voraussetzungen prüfen

```bash
node --version   # muss 18+ sein
tailscale ip -4  # muss eine 100.x.x.x IP zeigen
```

- Node.js fehlt → `curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs`
- Tailscale nicht aktiv → Nutzer fragen ob Tailscale eingerichtet ist

### Schritt 2: Repo herunterladen

```bash
cd ~
git clone https://github.com/jasmindipardo/ki-mitarbeiter-kontrollzentrum.git
cd ki-mitarbeiter-kontrollzentrum/dashboard
npm install
```

### Schritt 3: Passwort einrichten

```bash
bash setup-password.sh
```

Der Nutzer gibt ein Passwort ein — er braucht es bei jedem Login. Darauf hinweisen, es zu notieren.

### Schritt 4: Dashboard starten

```bash
bash start.sh
```

Das Skript gibt einen Link aus:
```
http://100.xx.xx.xx:7433
```

### Schritt 5: Browser öffnen & einloggen

Nutzer öffnet den Link → Passwort eingeben → Dashboard erscheint.

### Schritt 6: Autostart einrichten (empfohlen)

```bash
sudo bash setup-autostart.sh
```

Danach startet das Dashboard automatisch beim Server-Start.

### Schritt 7: Abschluss

Den Link nennen, auf Lesezeichen hinweisen. Kurz erklären was die 7 Tabs tun.

---

## Wichtige Regeln

- Jeden Schritt kurz erklären — in normaler Sprache, ohne Fachbegriffe
- Auf OK warten — nie einfach durchrasen
- Fehler ruhig lösen — erklären was passiert ist und wie man es behebt
- Am Ende: Link nennen, Lesezeichen setzen, kurze Zusammenfassung

---

*© Jasmin Di Pardo – Nur für Kunden von Jasmin Di Pardo.*
