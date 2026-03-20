#!/bin/bash
# Autostart einrichten – Dashboard startet automatisch beim Server-Start
# Einmalig ausführen mit: sudo bash setup-autostart.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVICE_FILE="/etc/systemd/system/ki-dashboard.service"
CURRENT_USER="${SUDO_USER:-$USER}"
USER_HOME=$(eval echo "~$CURRENT_USER")

echo "🔧 Autostart für KI-Mitarbeiter Kontrollzentrum einrichten..."
echo "   Benutzer: $CURRENT_USER"
echo "   Pfad: $SCRIPT_DIR"
echo ""

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

sleep 2

# Status und URL anzeigen
if systemctl is-active --quiet ki-dashboard; then
  TAILSCALE_IP=$(tailscale ip -4 2>/dev/null)
  PORT=${DASHBOARD_PORT:-7433}
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
