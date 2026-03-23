#!/bin/bash
# Autostart einrichten – Dashboard startet automatisch beim Server-Start
# Einmalig ausführen mit: sudo bash setup-autostart.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVICE_FILE="/etc/systemd/system/ki-dashboard.service"
CURRENT_USER="${SUDO_USER:-$USER}"
USER_HOME=$(eval echo "~$CURRENT_USER")
PORT=${DASHBOARD_PORT:-7433}

echo "🔧 Autostart für KI-Mitarbeiter Kontrollzentrum einrichten..."
echo "   Benutzer: $CURRENT_USER"
echo "   Pfad: $SCRIPT_DIR"
echo ""

# ─────────────────────────────────────────
# Systemd-Service erstellen
# ─────────────────────────────────────────
cat > "$SERVICE_FILE" << SERVICEEOF
[Unit]
Description=KI-Mitarbeiter Kontrollzentrum (jasmindipardo.de)
After=network.target tailscaled.service

[Service]
WorkingDirectory=$SCRIPT_DIR
ExecStart=$(which node) $SCRIPT_DIR/server/index.js
Restart=always
RestartSec=5
User=$CURRENT_USER
Environment=HOME=$USER_HOME
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SERVICEEOF

systemctl daemon-reload
systemctl enable ki-dashboard
systemctl start ki-dashboard

# ─────────────────────────────────────────
# Firewall: Port nur für Tailscale-Netz öffnen
# Das Kontrollzentrum ist so nur über dein
# privates Tailscale-Netzwerk erreichbar.
# ─────────────────────────────────────────
if command -v ufw &>/dev/null; then
  # Prüfen ob Regel bereits existiert
  if ! ufw status | grep -q "${PORT}/tcp.*100.64.0.0/10"; then
    echo "🔒 Firewall-Regel wird gesetzt (nur Tailscale-Zugriff)..."
    ufw allow from 100.64.0.0/10 to any port "$PORT" proto tcp comment "KI-Kontrollzentrum (nur Tailscale)" 2>/dev/null
    echo "   ✅ Port $PORT nur für Tailscale-Netz freigegeben."
  else
    echo "🔒 Firewall-Regel bereits vorhanden – kein Update nötig."
  fi
elif command -v firewall-cmd &>/dev/null; then
  # firewalld (CentOS/RHEL/Fedora)
  echo "🔒 Firewall-Regel (firewalld) wird gesetzt..."
  firewall-cmd --permanent --add-rich-rule="rule family='ipv4' source address='100.64.0.0/10' port port='$PORT' protocol='tcp' accept" 2>/dev/null
  firewall-cmd --reload 2>/dev/null
  echo "   ✅ Port $PORT nur für Tailscale-Netz freigegeben."
else
  echo "⚠️  Keine bekannte Firewall gefunden."
  echo "   Bitte manuell sicherstellen, dass Port $PORT"
  echo "   nur aus dem Tailscale-Netz (100.64.0.0/10) erreichbar ist."
fi

echo ""

# ─────────────────────────────────────────
# Status und URL anzeigen
# ─────────────────────────────────────────
sleep 2

if systemctl is-active --quiet ki-dashboard; then
  TAILSCALE_IP=$(tailscale ip -4 2>/dev/null)
  URL=${TAILSCALE_IP:+"http://$TAILSCALE_IP:$PORT"}
  URL=${URL:-"http://localhost:$PORT"}

  echo "✅ Autostart eingerichtet!"
  echo ""
  echo "══════════════════════════════════════"
  echo "  🔗 Dashboard-Link: $URL"
  echo "══════════════════════════════════════"
  echo ""
  echo "Das Dashboard startet ab jetzt automatisch."
  echo "Diesen Link bookmarken!"
else
  echo "⚠️  Service gestartet, aber Status unklar."
  echo "Prüfen mit: sudo systemctl status ki-dashboard"
fi
