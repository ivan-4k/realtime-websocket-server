 const WebSocket = require('ws');
 const express = require('express');
 const cors = require('cors');
 const http = require('http');
const path = require('path');
 
 const app = express();
 app.use(cors());
 app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
 
 const server = http.createServer(app);
 const wss = new WebSocket.Server({ server, path: '/ws/antrian' });
 
 // Data Store (in-memory untuk demo)
 let antrianList = [];
 let dokterList = [
    { id: 1, nama: "Dr. Andi", spesialisasi: "Umum", status: "available", ruangan: "Ruang 101" },
    { id: 2, nama: "Dr. Sinta", spesialisasi: "Anak", status: "available", ruangan: "Ruang 102" }
 ];
 let nomorAntrianTerakhir = 0;
 let connectedClients = new Set();
 
 // Broadcast message ke semua client
 function broadcast(message) {
     const messageStr = JSON.stringify(message);
     connectedClients.forEach(client => {
         if (client.readyState === WebSocket.OPEN) {
             client.send(messageStr);
         }
     });
     console.log(`[BROADCAST] ${message.type} ke ${connectedClients.size} client`);
 }
 
 // WebSocket Connection Handler
 wss.on('connection', (ws, req) => {
     console.log('[CONNECT] Client terhubung dari:', req.socket.remoteAddress);
     connectedClients.add(ws);
     
     // Kirim data initial ke client baru
     ws.send(JSON.stringify({
         type: 'INITIAL_DATA',
         data: {
             antrian: antrianList.filter(a => a.status !== 'SELESAI'),
             dokter: dokterList,
             statistik: getStatistik()
         }
     }));
     
     ws.on('message', (message) => {
         try {
             const parsed = JSON.parse(message.toString());
             console.log('[MESSAGE] Received:', parsed.type);
             handleMessage(ws, parsed);
         } catch (e) {
             console.error('[ERROR] Parse message:', e.message);
         }
     });
     
     ws.on('close', () => {
         connectedClients.delete(ws);
         console.log('[DISCONNECT] Client terputus. Total:', connectedClients.size);
     });
     
     ws.on('error', (error) => {
         console.error('[ERROR] WebSocket:', error.message);
     });
 });
 
 // Handle incoming messages
 function handleMessage(ws, message) {
     switch (message.type) {
         case 'AMBIL_ANTRIAN':
             handleAmbilAntrian(message.data);
             break;
         case 'PANGGIL_ANTRIAN':
             handlePanggilAntrian(message.data);
             break;
         case 'UPDATE_STATUS':
             handleUpdateStatus(message.data);
             break;
         case 'UPDATE_DOKTER':
             handleUpdateDokter(message.data);
             break;
         case 'REQUEST_DATA':
             handleRequestData(ws, message.data);
             break;
         default:
             console.log('[UNKNOWN] Message type:', message.type);
     }
 }
 
 // FITUR 1: Antrian Baru
 function handleAmbilAntrian(data) {
     nomorAntrianTerakhir++;
     
     const antrian = {
         id: Date.now(),
         nomor: nomorAntrianTerakhir,
         namaPasien: data.namaPasien,
         keluhan: data.keluhan || '',
         dokterId: data.dokterId,
         namaDokter: dokterList.find(d => d.id === data.dokterId)?.nama || 'Unknown',
         ruangan: dokterList.find(d => d.id === data.dokterId)?.ruangan || 'Ruang 1',
         status: 'MENUNGGU',
         waktuDaftar: new Date().toISOString(),
         waktuPanggil: null,
         waktuSelesai: null
     };
     
     antrianList.push(antrian);
     
     // Broadcast ANTRIAN_BARU ke semua client
     broadcast({
         type: 'ANTRIAN_BARU',
         data: antrian
     });
     
     // Broadcast dashboard update
     broadcastDashboard();
     
     console.log(`[ANTRIAN_BARU] No.${antrian.nomor} - ${antrian.namaPasien}`);
 }
 
 // FITUR 2: Panggil Antrian
 function handlePanggilAntrian(data) {
     let antrian;
     
     if (data.action === 'PANGGIL_BERIKUTNYA') {
         // Cari antrian MENUNGGU dengan nomor terkecil
         antrian = antrianList
             .filter(a => a.status === 'MENUNGGU')
             .sort((a, b) => a.nomor - b.nomor)[0];
     } else if (data.nomor) {
         antrian = antrianList.find(a => a.nomor === data.nomor);
     }
     
     if (antrian) {
         antrian.status = 'DILAYANI';
         antrian.waktuPanggil = new Date().toISOString();
         
         // Update status dokter jadi busy
         const dokter = dokterList.find(d => d.id === antrian.dokterId);
         if (dokter) {
             dokter.status = 'busy';
             broadcast({
                 type: 'DOKTER_STATUS',
                 data: dokter
             });
         }
         
         // Broadcast PANGGIL_ANTRIAN
         broadcast({
             type: 'PANGGIL_ANTRIAN',
             data: antrian
         });
         
         // Broadcast status update
         broadcast({
             type: 'STATUS_UPDATED',
             data: antrian
         });
         
         broadcastDashboard();
         
         console.log(`[PANGGIL] No.${antrian.nomor} - ${antrian.namaPasien} ke ${antrian.ruangan}`);
     }
 }
 
 // FITUR 3: Update Status Antrian
 function handleUpdateStatus(data) {
     const antrian = antrianList.find(a => a.nomor === data.nomor);
     
     if (antrian) {
         antrian.status = data.status;
         
         if (data.status === 'SELESAI') {
             antrian.waktuSelesai = new Date().toISOString();
             
             // Update dokter jadi available lagi
             const dokter = dokterList.find(d => d.id === antrian.dokterId);
             if (dokter) {
                 dokter.status = 'available';
                 broadcast({
                     type: 'DOKTER_STATUS',
                     data: dokter
                 });
             }
         }
         
         // Broadcast STATUS_UPDATED
         broadcast({
             type: 'STATUS_UPDATED',
             data: antrian
         });
         
         broadcastDashboard();
         
         console.log(`[STATUS] No.${antrian.nomor} -> ${data.status}`);
     }
 }
 
 // FITUR 4: Update Status Dokter
 function handleUpdateDokter(data) {
     const dokter = dokterList.find(d => d.id === data.dokterId);
     
     if (dokter) {
         dokter.status = data.status;
         
         // Broadcast DOKTER_STATUS ke semua client
         broadcast({
             type: 'DOKTER_STATUS',
             data: dokter
         });
         
         console.log(`[DOKTER] ${dokter.nama} -> ${data.status}`);
     }
 }
 
 // FITUR 5: Dashboard Update
 function getStatistik() {
     const today = new Date().toDateString();
     const todayAntrian = antrianList.filter(a => 
         new Date(a.waktuDaftar).toDateString() === today
     );
     
     return {
         totalMenunggu: todayAntrian.filter(a => a.status === 'MENUNGGU').length,
         totalDilayani: todayAntrian.filter(a => a.status === 'DILAYANI').length,
         totalSelesai: todayAntrian.filter(a => a.status === 'SELESAI').length,
         totalHariIni: todayAntrian.length,
         dokterAvailable: dokterList.filter(d => d.status === 'available').length,
         dokterBusy: dokterList.filter(d => d.status === 'busy').length
     };
 }
 
 function broadcastDashboard() {
     broadcast({
         type: 'DASHBOARD_UPDATE',
         data: getStatistik()
     });
 }
 
 // Handle request data
 function handleRequestData(ws, data) {
     if (data.action === 'GET_DASHBOARD') {
         ws.send(JSON.stringify({
             type: 'DASHBOARD_UPDATE',
             data: getStatistik()
         }));
     } else if (data.action === 'GET_ANTRIAN') {
         ws.send(JSON.stringify({
             type: 'ANTRIAN_LIST',
             data: antrianList.filter(a => a.status !== 'SELESAI')
         }));
     } else if (data.action === 'GET_DOKTER') {
         ws.send(JSON.stringify({
             type: 'DOKTER_LIST',
             data: dokterList
         }));
     }
 }
 
 // REST API Endpoints (untuk integrasi dengan PHP Application Tier)
 app.get('/api/status', (req, res) => {
     res.json({
         status: 'running',
         clients: connectedClients.size,
         statistik: getStatistik()
     });
 });
 
 app.post('/api/antrian', (req, res) => {
     handleAmbilAntrian(req.body);
     res.json({ success: true, message: 'Antrian berhasil ditambahkan' });
 });
 
 app.post('/api/panggil', (req, res) => {
     handlePanggilAntrian(req.body);
     res.json({ success: true, message: 'Antrian dipanggil' });
 });
 
 app.put('/api/antrian/:nomor/status', (req, res) => {
     handleUpdateStatus({ nomor: parseInt(req.params.nomor), status: req.body.status });
     res.json({ success: true, message: 'Status diupdate' });
 });
 
 app.put('/api/dokter/:id/status', (req, res) => {
     handleUpdateDokter({ dokterId: parseInt(req.params.id), status: req.body.status });
     res.json({ success: true, message: 'Status dokter diupdate' });
 });
 
 // Start server
 const PORT = 3000;
 server.listen(PORT, () => {
     console.log('================================================');
     console.log('  WEBSOCKET SERVER - SISTEM ANTRIAN KLINIK');
     console.log('  Tugas Besar PBO - Kelompok 6');
     console.log('================================================');
     console.log(`  HTTP Server : http://localhost:${PORT}`);
     console.log(`  WebSocket   : ws://localhost:${PORT}/ws/antrian`);
     console.log('================================================');
     console.log('  FITUR REALTIME:');
     console.log('  1. ANTRIAN_BARU    - Notifikasi pasien baru');
     console.log('  2. STATUS_UPDATED  - Update status antrian');
     console.log('  3. PANGGIL_ANTRIAN - Panggilan antrian');
     console.log('  4. DOKTER_STATUS   - Status dokter realtime');
     console.log('  5. DASHBOARD_UPDATE- Statistik realtime');
     console.log('================================================');
 });
