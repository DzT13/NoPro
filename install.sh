#!/bin/bash

# Function to install npm if it's not found
install_npm() {
  echo "npm tidak ditemukan. Menginstal npm..."
  if command -v apt &> /dev/null; then
    sudo apt update
    sudo apt install -y nodejs npm
  elif command -v yum &> /dev/null; then
    sudo yum install -y nodejs npm
  else
    echo "Tidak dapat menginstal npm secara otomatis. Silakan instal secara manual."
    exit 1
  fi
  echo "npm telah berhasil diinstal."
}

# Function to get and validate a port number (0-65535) with UFW check
get_valid_port() {
  local prompt="$1"
  local port
  while true; do
    read -p "$prompt (0 untuk port dinamis): " port
    if [[ ! ( $port =~ ^[0-9]+$ && ( $port -ge 0 && $port -le 65535 ) ) ]]; then
      echo "Port tidak valid. Harap masukkan angka antara 0 dan 65535."
    else
      # Check UFW status and handle errors
      if [[ $port -ne 0 ]]; then
        if ! command -v ufw &> /dev/null; then
          echo "UFW tidak terinstal. Tidak dapat memeriksa status port."
        else
          if ! sudo ufw status | grep -q "$port"; then  
            echo "Port $port belum dibuka di UFW. Apakah Anda ingin membukanya sekarang? (y/n)"
            read ufwChoice
            if [[ $ufwChoice == "y" ]]; then
              if ! sudo ufw allow $port; then
                echo "Gagal membuka port $port di UFW. Pastikan Anda memiliki hak akses sudo dan UFW dikonfigurasi dengan benar."
                continue
              else
                echo "Port $port telah dibuka di UFW."
              fi
            else
              echo "Pilih port lain atau buka port $port di UFW secara manual."
              continue 
            fi
          fi
        fi 
      fi # End of UFW check

      echo "$port"
      break
    fi
  done
}

# Check for npm and install if necessary
if ! command -v npm &> /dev/null; then
  install_npm
fi

# Install Node.js dependencies (automatically)
#echo "Menginstal dependensi Node.js..."
#npm install

echo "Selamat datang di Installer Proxy!"
echo "Berapa banyak remote host yang ingin Anda jalankan (1-5)?"
read numHosts

if [[ ! $numHosts =~ ^[1-5]$ ]]; then
  echo "Input tidak valid. Harap masukkan angka antara 1 dan 5."
  exit 1
fi

# Remove existing .env file if it exists
rm -f .env

# Create new .env file
touch .env

for (( i=1; i<=$numHosts; i++ )); do
  echo "Masukkan informasi untuk Remote Host $i:"
  read -p "REMOTE_HOST$i: " remoteHost
  read -p "REMOTE_PORT$i: " remotePort
  localPort=$(get_valid_port "Masukkan LOCAL_PORT$i")

  echo "REMOTE_HOST$i=$remoteHost" >> .env
  echo "REMOTE_PORT$i=$remotePort" >> .env
  echo "LOCAL_PORT$i=$localPort" >> .env
done

echo "LOCAL_HOST=0.0.0.0" >> .env

echo "File .env telah dibuat:"
cat .env

echo "Anda dapat mengeditnya lebih lanjut jika diperlukan. (y/n)?"
read editChoice

if [[ $editChoice == "y" ]]; then
  # Open .env in the default text editor
  if command -v xdg-open &> /dev/null; then
    xdg-open .env
  elif command -v open &> /dev/null; then
    open .env
  else
    echo "Tidak dapat membuka editor teks secara otomatis. Silakan edit .env secara manual."
  fi
fi

echo "Apakah Anda ingin menjalankan proxy sekarang? (y/n)?"
read startChoice

if [[ $startChoice == "y" ]]; then
  # Get the name of the proxy application from package.json
  proxyApplicationName=$(grep -m 1 '"name":' package.json | awk -F'"' '{print $4}')
  if [[ -z $proxyApplicationName ]]; then
    echo "Nama aplikasi tidak ditemukan di package.json. Harap tentukan nama aplikasi secara manual:"
    read proxyApplicationName
  fi
  
  echo "Menjalankan proxy..."
  if [[ $localPort -le 1023 ]]; then
    echo "Menjalankan proxy dengan sudo (karena port privileged)..."
    sudo screen -dmS "$proxyApplicationName" npm start 
  else
    screen -dmS "$proxyApplicationName" npm start 
  fi

  echo "Proxy sedang berjalan di latar belakang. Anda dapat melihatnya menggunakan perintah:"
  echo "sudo screen -r $proxyApplicationName"

else
  echo "Anda dapat menjalankan proxy nanti dengan perintah:"
  echo "screen -dmS <nama_aplikasi> npm start"
  echo "Dan kemudian melihatnya dengan:"
  echo "screen -r <nama_aplikasi>"
fi
