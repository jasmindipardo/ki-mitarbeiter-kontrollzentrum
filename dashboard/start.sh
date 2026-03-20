#!/bin/bash
# ─────────────────────────────────────────────
# KI-Team Dashboard – Einfacher Start
# Einfach ausführen: bash start.sh
# ─────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Farben
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo -e "${CYAN}🎛️  KI-Team Dashboard wird gestartet...${NC}"
echo ""

# Node.js prüfen
if ! command -v node &>/dev/null; then
  echo "❌ Node.js nicht gefunden!"
  echo "   Bitte installieren: https://nodejs.org"
  exit 1
fi

# npm install falls node_modules fehlt
if [ ! -d "node_modules" ]; then
  echo "📦 Abhängigkeiten werden installiert (einmalig)..."
  npm install --silent
  echo "✅ Fertig!"
  echo ""
fi

# Passwort prüfen
PW_FILE="$HOME/.openclaw/dashboard.password"
if [ -z "$DASHBOARD_PASSWORD" ] && [ ! -f "$PW_FILE" ]; then
  echo -e "${YELLOW}⚠️  Noch kein Passwort eingerichtet!${NC}"
  echo ""
  echo "Passwort jetzt einrichten? (empfohlen)"
  read -r -p "   Weiter? (j/n): " setup_pw
  if [ "$setup_pw" = "j" ]; then
    bash "$SCRIPT_DIR/setup-password.sh"
  fi
  echo ""
fi

# Dashboard starten
echo -e "${GREEN}▶ Dashboard startet auf Port ${DASHBOARD_PORT:-7433}...${NC}"
echo ""
node server/index.js &
DASHBOARD_PID=$!

# Kurz warten bis Server bereit
sleep 2

# URL ermitteln
TAILSCALE_IP=$(tailscale ip -4 2>/dev/null)
PORT=${DASHBOARD_PORT:-7433}
if [ -n "$TAILSCALE_IP" ]; then
  URL="http://$TAILSCALE_IP:$PORT"
else
  URL="http://localhost:$PORT"
fi

echo ""
echo "══════════════════════════════════════"
echo -e "  ${GREEN}✅ Dashboard läuft!${NC}"
echo "══════════════════════════════════════"
echo ""
echo -e "  🔗 ${CYAN}$URL${NC}"
echo ""
echo "  👆 Diesen Link im Browser öffnen"
echo "  (funktioniert von jedem Gerät im Tailscale-Netz)"
echo ""
echo "══════════════════════════════════════"
echo ""
echo "  Mit Strg+C stoppen"
echo ""

# Browser automatisch öffnen (wenn möglich)
if command -v xdg-open &>/dev/null; then
  xdg-open "$URL" &>/dev/null &
elif command -v open &>/dev/null; then
  open "$URL" &>/dev/null &
fi

# Warten bis Strg+C
wait $DASHBOARD_PID
