# Anleitung für KI-Assistenten – KI-Mitarbeiter Kontrollzentrum

Diese Datei ist für dich, wenn du als KI-Assistent (in VS Code / Claude Code) gebeten wirst, das Kontrollzentrum einzurichten.

---

## Was du über die Situation weißt

Der Nutzer hat bereits:
- **VS Code** mit der Claude Code Erweiterung installiert
- Einen **Linux-Server** (z. B. bei Hetzner) gemietet und eingerichtet
- **OpenClaw** auf dem Server installiert — der KI-Assistent läuft bereits
- **Tailscale** ist auf dem Server aktiv (wurde beim Server-Sicherheitsschritt eingerichtet)
- Eine SSH-Verbindung zum Server über VS Code

Du kannst also Befehle **direkt auf dem Server ausführen** — kein Erklärbedarf für Terminals oder SSH.

---

## Was du einrichtest

Das KI-Mitarbeiter-Kontrollzentrum ist ein Web-Dashboard, das der Nutzer im Browser öffnet, um seinen KI-Assistenten zu verwalten:

- **Automatische Aufgaben (Cron Jobs)** — welche laufen, welche pausiert sind
- **Zugangsdaten (Env-Variablen)** — API-Keys sicher eintragen, ohne sie per Chat zu schicken
- **Workspace-Dateien** — SOUL.md, MEMORY.md, AGENTS.md direkt bearbeiten
- **System-Status** — Verbindungen, Version, Auslastung auf einen Blick

Das Dashboard läuft auf dem Server des Nutzers und ist nur über Tailscale erreichbar — kein öffentlicher Zugang, kein Sicherheitsrisiko.

---

## Wie du vorgehst

Erkläre jeden Schritt in einem Satz, führe ihn dann aus — warte kurz auf Bestätigung, dann weiter.

### Schritt 1: Voraussetzungen prüfen

Führe auf dem Server aus:
```bash
node --version
tailscale ip -4
```

- Node.js 18+ vorhanden? ✅ Weiter.
- Tailscale-IP vorhanden (100.x.x.x)? ✅ Weiter.
- Node.js fehlt → installieren: `curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs`

### Schritt 2: Repo herunterladen

```bash
cd ~
git clone https://github.com/jasmindipardo/ki-mitarbeiter-kontrollzentrum.git
cd ki-mitarbeiter-kontrollzentrum/dashboard
```

### Schritt 3: Passwort einrichten

```bash
bash setup-password.sh
```

Erkläre dem Nutzer: Er gibt jetzt ein Passwort ein — das braucht er jeden Mal wenn er das Dashboard öffnet. Es wird sicher auf dem Server gespeichert.

### Schritt 4: Dashboard starten und testen

```bash
bash start.sh
```

Das Skript installiert alles automatisch und gibt einen Link aus. Notiere dir die Tailscale-IP und den Port (7433).

### Schritt 5: Autostart einrichten

```bash
sudo bash setup-autostart.sh
```

Damit startet das Dashboard automatisch — auch nach einem Server-Neustart.

### Schritt 6: Link ausgeben und erklären

Zeige dem Nutzer seinen persönlichen Link:
```
http://TAILSCALE-IP:7433
```

Erkläre: Diesen Link im Browser öffnen → Passwort eingeben → Lesezeichen speichern. Ab jetzt immer so öffnen, kein Terminal mehr nötig.

---

## Wichtige Regeln

- Jeden Schritt kurz erklären — was passiert gerade, wozu ist das gut
- Nie einfach durchrasen — kurz nach OK fragen
- Fehler ruhig lösen, nicht eskalieren
- Am Ende: Link nennen, Lesezeichen erwähnen, kurz zusammenfassen was eingerichtet wurde

---

*© Jasmin Di Pardo – Nur für Kunden von Jasmin Di Pardo.*
