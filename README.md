# KI-Mitarbeiter Kontrollzentrum

Verwalte deinen KI-Assistenten bequem im Browser – von jedem Gerät, von überall.

---

## Was kannst du damit machen?

Sobald das Kontrollzentrum eingerichtet ist, öffnest du einfach einen Link im Browser und siehst dein persönliches Dashboard:

**⏰ Automatische Aufgaben (Cron Jobs)**
Dein KI-Assistent erledigt viele Dinge automatisch – zum Beispiel morgens einen Bericht schicken oder abends Ideen sammeln. Hier siehst du alle diese Aufgaben auf einen Blick, kannst sie ein- und ausschalten, sofort starten oder den Zeitplan anpassen.

**Legende der Statussymbole:**
| Symbol | Bedeutung |
|---|---|
| 🟢 Grün | Letzter Lauf erfolgreich |
| 🔴 Rot | Letzter Lauf fehlgeschlagen |
| ⚪ Weiß/Grau | Noch nie gelaufen oder einmaliger Job ohne Wiederholung |
| Badge „aktiv" | Job ist eingeplant und läuft automatisch |
| Badge „pausiert" | Job ist deaktiviert und läuft nicht |

**🔑 Zugangsdaten (Env-Variablen)**
Damit dein Assistent mit anderen Tools zusammenarbeiten kann (z. B. ClickUp, Brevo), braucht er bestimmte Zugangsdaten. Die trägst du hier sicher ein – sie werden niemals im Klartext angezeigt.

**📝 Dateien einsehen & bearbeiten**
Alle wichtigen Dateien deines KI-Assistenten auf einen Blick – direkt lesbar und bearbeitbar, ohne technische Kenntnisse:
- **SOUL.md** – Persönlichkeit & Verhalten deines Assistenten
- **MEMORY.md** – Langzeitgedächtnis (was er dauerhaft über dich weiß)
- **USER.md** – Dein Profil und deine Vorlieben
- **AGENTS.md** – Verhaltensregeln und Arbeitsweise
- **TOOLS.md** – Welche Tools er nutzen darf
- **memory/** – Tagesnotizen und kurzzeitiges Gedächtnis
- **skills/** – Alle aktivierten Fähigkeiten (Content, YouTube, Newsletter, etc.)

**📊 Status auf einen Blick**
Ist der Assistent aktiv? Welche Geräte sind verbunden? Wie viel Speicher ist frei? Das siehst du hier auf einen Blick.

---

## Wie richtest du es ein?

Die vollständige Anleitung findest du in ClickUp – Schritt für Schritt, auch ohne technische Vorkenntnisse:

👉 [Zur Einrichtungsanleitung in ClickUp](https://app.clickup.com/24323460/v/dc/q69c4-9915)

**Kurzversion (4 Befehle, einmalig):**

```
git clone https://github.com/jasmindipardo/ki-mitarbeiter-kontrollzentrum.git
cd ki-mitarbeiter-kontrollzentrum/dashboard
bash setup-password.sh
bash start.sh
```

Danach erscheint dein persönlicher Link – den einfach im Browser aufrufen und bookmarken.

---

## Ist es sicher?

Ja. Das Kontrollzentrum ist durch mehrere Schutzschichten abgesichert:

- Passwort-Abfrage beim Öffnen
- Nur über dein privates Netzwerk erreichbar – kein fremder Zugriff von außen
- Automatischer Logout nach 8 Stunden
- Zugangsdaten werden nie im Klartext angezeigt

---

## Fragen?

Schreibe an 

---

*© Jasmin Di Pardo – Nur für Kunden von Jasmin Di Pardo. Keine kommerzielle Weiterverwendung oder Weitergabe ohne ausdrückliche Genehmigung.*
