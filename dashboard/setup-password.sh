#!/bin/bash
# Passwort für das KI-Mitarbeiter Kontrollzentrum einrichten
# Ausführen mit: bash setup-password.sh

CONFIG_DIR="$HOME/.openclaw"
PW_FILE="$CONFIG_DIR/dashboard.password"

echo "🔒 KI-Mitarbeiter Kontrollzentrum – Passwort einrichten"
echo ""

if [ -f "$PW_FILE" ]; then
  echo "⚠️  Es gibt bereits ein Passwort. Überschreiben?"
  read -r -p "   Weiter? (j/n): " confirm
  if [ "$confirm" != "j" ]; then
    echo "Abgebrochen."
    exit 0
  fi
fi

echo "Neues Passwort eingeben (wird nicht angezeigt):"
read -r -s password

if [ -z "$password" ]; then
  echo "❌ Passwort darf nicht leer sein."
  exit 1
fi

echo "Passwort wiederholen:"
read -r -s password2

if [ "$password" != "$password2" ]; then
  echo "❌ Passwörter stimmen nicht überein."
  exit 1
fi

# Datei nur für den aktuellen User lesbar
mkdir -p "$CONFIG_DIR"
echo "$password" > "$PW_FILE"
chmod 600 "$PW_FILE"

echo ""
echo "✅ Passwort gespeichert in: $PW_FILE"
echo "   Nur du kannst diese Datei lesen (chmod 600)."
echo ""
echo "Dashboard starten: npm start"
