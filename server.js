require('dotenv').config();
const net = require('net');

process.on('uncaughtException', console.error);

// Array untuk menyimpan konfigurasi semua remote host dan port
const remoteHosts = [];
// Array untuk menyimpan port lokal yang digunakan
const localPorts = [];

// Baca konfigurasi dari file .env
for (let i = 1; i <= 5; i++) {
  const host = process.env[`REMOTE_HOST${i}`];
  const port = process.env[`REMOTE_PORT${i}`];
  const localPort = process.env[`LOCAL_PORT${i}`]; // Baca juga local port
  if (host && port && localPort) {
    remoteHosts.push({ host, port });
    localPorts.push(parseInt(localPort, 10)); // Ubah localPort menjadi integer
  }
}

if (remoteHosts.length === 0) {
  console.error('Error: No remote host configurations found in .env!');
  process.exit(1);
}

const localHost = process.env.LOCAL_HOST || '0.0.0.0';

function handleConnection(remoteHost, remotePort) {
  return (localSocket) => {
    let remoteSocket = new net.Socket();
    let reconnectAttempts = 0;
    let reconnectInterval;

    function connectToRemote() {
      remoteSocket.connect(remotePort, remoteHost);
      reconnectAttempts++;
    }

    connectToRemote(); // Initial connection attempt

    localSocket.on('connect', () => {
      const serverIndex = localPorts.indexOf(localSocket.localPort);
      console.log(`>>> ${remoteHost} - connection #%d from %s:%d`, serverIndex !== -1 ? servers[serverIndex].connections : '?', localSocket.remoteAddress, localSocket.remotePort);
    });

    localSocket.on('data', (data) => {
      console.log(`>>> ${remoteHost} - %s:%d - writing data to remote`, localSocket.remoteAddress, localSocket.remotePort);
      if (!remoteSocket.write(data)) {
        localSocket.pause();
      }
    }).on('drain', () => remoteSocket.resume());

    remoteSocket.on('data', (data) => {
      console.log(`>>> ${remoteHost} - %s:%d - writing data to local`, localSocket.remoteAddress, localSocket.remotePort);
      if (!localSocket.write(data)) {
        remoteSocket.pause();
      }
    }).on('drain', () => localSocket.resume());

    localSocket.on('close', () => {
      clearInterval(reconnectInterval);
      remoteSocket.end();
    });

    remoteSocket.on('close', (hadError) => {
      console.log(`>>> ${remoteHost} - connection closed${hadError ? ' with error' : ''}`);
      localSocket.end();

      if (reconnectAttempts < 5) {
        const delay = Math.min(Math.pow(2, reconnectAttempts) * 1000, 30000);
        reconnectInterval = setTimeout(connectToRemote, delay);
      } else {
        console.error(`>>> ${remoteHost} - Max reconnect attempts reached. Giving up.`);
      }
    });

    remoteSocket.on('error', (err) => {
      console.error(`>>> ${remoteHost} - Error:`, err);
      remoteSocket.destroy();
      remoteSocket = new net.Socket();

      if (reconnectAttempts < 5) {
        const delay = Math.min(Math.pow(2, reconnectAttempts) * 1000, 30000);
        reconnectInterval = setTimeout(connectToRemote, delay);
      } else {
        console.error(`>>> ${remoteHost} - Max reconnect attempts reached. Giving up.`);
      }
    });
  };
}


// Array untuk menyimpan objek server
const servers = [];
for (let i = 0; i < remoteHosts.length; i++) {
  const server = net.createServer(handleConnection(remoteHosts[i].host, remoteHosts[i].port));
  servers.push(server);
  server.listen(localPorts[i], localHost, () => {
    console.log(`Redirecting from ${localHost}:${localPorts[i]} to ${remoteHosts[i].host}:${remoteHosts[i].port}`);
  });
}
