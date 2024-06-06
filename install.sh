#!/bin/bash

echo "Selamat datang di Installer Proxy!"
echo "Berapa banyak remote host yang ingin Anda jalankan (1-5)?"
read numHosts

if [[ ! $numHosts =~ ^[1-5]$ ]]; then
  echo "Input tidak valid. Harap masukkan angka antara 1 dan 5."
  exit 1
fi

# Hapus file .env jika sudah ada
if [[ -f .env ]]; then
  rm .env
fi

# Buat file .env baru
touch .env

for (( i=1; i<=$numHosts; i++ )); do
  echo "Masukkan informasi untuk Remote Host $i:"
  read -p "REMOTE_HOST$i: " remoteHost
  read -p "REMOTE_PORT$i: " remotePort

  echo "REMOTE_HOST$i=$remoteHost" >> .env
  echo "REMOTE_PORT$i=$remotePort" >> .env
done

# Minta input dan validasi port lokal
for (( i=1; i<=$numHosts; i++ )); do
  while true; do
    read -p "Masukkan LOCAL_PORT$i: " localPort

    # Cek apakah port valid (angka antara 1024 dan 65535)
    if [[ ! $localPort =~ ^[1-9][0-9]{3,4}$ ]]; then
      echo "Port tidak valid. Harap masukkan angka antara 1024 dan 65535."
      continue
    fi

    # Cek apakah port sudah digunakan (coba ss dulu, lalu netstat)
    if command -v ss >/dev/null 2>&1; then
      if ss -tulpn | grep -q ":$localPort "; then
        echo "Port $localPort sudah digunakan. Silakan pilih port lain."
        continue
      fi
    elif command -v netstat >/dev/null 2>&1; then
      if netstat -tulpn | grep -q ":$localPort "; then
        echo "Port $localPort sudah digunakan. Silakan pilih port lain."
        continue
      fi
    else
      echo "Perintah ss dan netstat tidak ditemukan. Tidak dapat memeriksa penggunaan port."
      echo "Harap pastikan port $localPort tidak digunakan oleh aplikasi lain."
    fi

    echo "LOCAL_PORT$i=$localPort" >> .env
    break
  done
done

echo "LOCAL_HOST=0.0.0.0" >> .env

echo "File .env telah dibuat. Anda dapat mengeditnya lebih lanjut jika diperlukan."
echo "Jalankan 'node proxy.js' untuk memulai proxy."