#!/bin/bash
# Tailscale Server-Setup für KI-Kurs
# Jasmin Di Pardo – jasmindipardo.de

set -e

echo "🔒 Tailscale Setup startet..."

# Installation
if ! command -v tailscale &> /dev/null; then
    echo "📦 Installiere Tailscale..."
    curl -fsSL https://tailscale.com/install.sh | sh
else
    echo "✅ Tailscale bereits installiert"
fi

# Service aktivieren
echo "⚙️  Aktiviere Tailscale Service..."
sudo systemctl enable tailscaled
sudo systemctl start tailscaled

# Einloggen
echo ""
echo "👇 Jetzt einloggen:"
sudo tailscale up

# Status anzeigen
echo ""
echo "✅ Setup abgeschlossen!"
echo "📊 Status:"
tailscale status
