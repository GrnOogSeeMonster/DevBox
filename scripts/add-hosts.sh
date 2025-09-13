#!/usr/bin/env bash
set -euo pipefail

LINE="127.0.0.1 studio.devbox.local api.devbox.local sandboxes.devbox.local"
FILE="/etc/hosts"

if grep -q "studio.devbox.local" "$FILE" && grep -q "api.devbox.local" "$FILE"; then
  echo "Hosts already contain devbox domains. Skipping."
  exit 0
fi

echo "The following line should be present in $FILE:\n$LINE"
read -r -p "Attempt to append it automatically? [y/N] " yn
case $yn in
  [Yy]*)
    if [ -w "$FILE" ]; then
      echo "$LINE" | sudo tee -a "$FILE" >/dev/null
      echo "Added."
    else
      echo "$LINE" | sudo tee -a "$FILE" >/dev/null
    fi
    ;;
  *)
    echo "Please add it manually with sudo privileges."
    ;;
esac
