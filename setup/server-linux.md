# Tailscale einrichten – Linux Server / VPS

## Einzeiler-Installation (Ubuntu/Debian)
```bash
curl -fsSL https://tailscale.com/install.sh | sh
```

## Tailscale starten und einloggen
```bash
sudo tailscale up
```
→ Du bekommst einen Link zum Einloggen. Diesen Link im Browser öffnen und bestätigen.

## Als Exit-Node einrichten (optional)
Falls du deinen Server als VPN-Ausgang nutzen möchtest:
```bash
sudo tailscale up --advertise-exit-node
```
Im Tailscale-Dashboard diesen Server dann als Exit-Node genehmigen.

## Autostart aktivieren
```bash
sudo systemctl enable tailscaled
sudo systemctl start tailscaled
```

## Status prüfen
```bash
tailscale status
```

## 🔐 Wichtig für Kunden von Jasmin Di Pardo
Nach der Einrichtung kannst du deinen KI-Assistenten über die Tailscale-IP erreichen – auch wenn du unterwegs bist!

---

*© Jasmin Di Pardo – Nur für Kunden von Jasmin Di Pardo. Keine kommerzielle Weiterverwendung oder Weitergabe ohne ausdrückliche Genehmigung. Kontakt: *
