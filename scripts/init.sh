#!/usr/bin/env bash
set -euo pipefail

is_cmd() { command -v "$1" >/dev/null 2>&1; }

if grep -qi microsoft /proc/version 2>/dev/null; then
  echo "Detected WSL environment"
fi

if is_cmd apt-get; then
  echo "Updating apt cache and installing prerequisites..."
  sudo apt-get update -y
  sudo apt-get install -y --no-install-recommends ca-certificates curl libnss3-tools
  if ! is_cmd mkcert; then
    echo "Installing mkcert..."
    if sudo apt-get install -y mkcert; then
      echo "mkcert installed via apt"
    else
      echo "Falling back to downloading mkcert binary..."
      ARCH=$(uname -m)
      case "$ARCH" in
        x86_64|amd64) URL="https://dl.filippo.io/mkcert/latest?for=linux/amd64" ;;
        aarch64|arm64) URL="https://dl.filippo.io/mkcert/latest?for=linux/arm64" ;;
        *) echo "Unsupported arch $ARCH; install mkcert manually"; URL="" ;;
      esac
      if [ -n "$URL" ]; then
        curl -fsSL "$URL" -o mkcert
        chmod +x mkcert
        sudo mv mkcert /usr/local/bin/mkcert
      fi
    fi
  fi
fi

if ! is_cmd docker; then
  echo "Docker not found. Please install Docker Desktop and enable WSL integration."
fi

if ! docker compose version >/dev/null 2>&1; then
  if is_cmd apt-get; then
    echo "Installing docker-compose-plugin..."
    sudo apt-get install -y docker-compose-plugin || true
  fi
fi

if is_cmd mkcert; then
  echo "mkcert version: $(mkcert -version || true)"
else
  echo "mkcert still missing. See https://github.com/FiloSottile/mkcert"
fi

echo "Init checks complete."
