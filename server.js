require('dotenv').config();
const net = require('net');

process.on('uncaughtException', console.error);

const remoteHosts = [];

// Read and validate configuration from .env
Object.keys(process.env).forEach(key => {
  if (key.startsWith('REMOTE_HOST') && process.env[key]) {
    const index = key.replace('REMOTE_HOST', '');
    const portKey = `REMOTE_PORT${index}`;
    const localPortKey = `LOCAL_PORT${index}`;

    if (process.env[portKey] && process.env[localPortKey]) {
      const remotePort = parseInt(process.env[portKey], 10);
      const localPort = parseInt(process.env[localPortKey], 10);
      if (!isNaN(remotePort) && !isNaN(localPort) && remotePort > 0 && localPort > 0) {
        remoteHosts.push({ 
          host: process.env[key],
          port: remotePort,
          localPort
        });
      } else {
        console.error(`Invalid port configuration for ${key}. Ports must be positive integers.`);
      }
    }
  }
});

if (remoteHosts.length === 0) {
  console.error('Error: No valid remote host configurations found in .env!');
  process.exit(1);
}

const localHost = process.env.LOCAL_HOST || '0.0.0.0';

function handleConnection(remoteHost, remotePort, localPort) {
  return (localSocket) => {
    let remoteSocket = new net.Socket();
    let reconnectAttempts = 0;
    let reconnectInterval;

    function connectToRemote() {
      remoteSocket.connect(remotePort, remoteHost, () => {
        reconnectAttempts = 0; // Reset attempts on successful reconnect
      });
      reconnectAttempts++;
    }

    connectToRemote(); // Initial connection attempt

    localSocket.on('connect', () => {
      const serverIndex = remoteHosts.findIndex(server => server.localPort === localPort);
      console.log(`>>> ${remoteHost}:${remotePort} - connection #%d from %s:%d`, serverIndex !== -1 ? servers[serverIndex].connections : '?', localSocket.remoteAddress, localSocket.remotePort);
    });

    localSocket.on('data', (data) => {
      console.log(`>>> ${remoteHost}:${remotePort} - %s:%d - writing data to remote`, localSocket.remoteAddress, localSocket.remotePort);
      if (!remoteSocket.write(data)) {
        localSocket.pause();
      }
    }).on('drain', () => remoteSocket.resume());

    remoteSocket.on('data', (data) => {
      console.log(`>>> ${remoteHost}:${remotePort} - %s:%d - writing data to local`, localSocket.remoteAddress, localSocket.remotePort);
      if (!localSocket.write(data)) {
        remoteSocket.pause();
      }
    }).on('drain', () => localSocket.resume());


    // Enhanced Error Handling
    const handleSocketError = (socket, type) => (err) => {
      console.error(`>>> ${remoteHost}:${remotePort} - ${type} socket error:`, err);
      clearInterval(reconnectInterval);
      socket.destroy();
      
      // Attempt reconnect only if it's the remote socket
      if (type === 'remote' && reconnectAttempts < 5) {
        const delay = Math.min(Math.pow(2, reconnectAttempts) * 1000, 30000);
        reconnectInterval = setTimeout(connectToRemote, delay);
      } else {
        console.error(`>>> ${remoteHost}:${remotePort} - Max reconnect attempts reached or local socket error. Closing connection.`);
        localSocket.end(); // Ensure local socket is closed
      }
    };

    localSocket.on('error', handleSocketError(localSocket, 'local'));
    remoteSocket.on('error', handleSocketError(remoteSocket, 'remote')); 

    // Simplified close handling
    const handleSocketClose = (socket, type) => (hadError) => {
      console.log(`>>> ${remoteHost}:${remotePort} - ${type} socket closed${hadError ? ' with error' : ''}`);
      if (type === 'remote') {
        localSocket.end(); // Close local on remote close
      } else if (type === 'local') {
        clearInterval(reconnectInterval); 
        remoteSocket.end(); // Close remote on local close
      }
    };

    localSocket.on('close', handleSocketClose(localSocket, 'local'));
    remoteSocket.on('close', handleSocketClose(remoteSocket, 'remote'));
  };
}


const servers = [];

for (const config of remoteHosts) {
  const server = net.createServer(handleConnection(config.host, config.port, config.localPort));
  servers.push(server);
  server.listen(config.localPort, localHost, () => {
    console.log(`Redirecting from ${localHost}:${config.localPort} to ${config.host}:${config.port}`);
  });
}
