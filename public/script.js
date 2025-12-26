 // WebSocket Connection
 let ws = null;
 let reconnectAttempts = 0;
 const maxReconnectAttempts = 5;
 
 // Data stores
 let antrianList = [];
 let dokterList = [];
 
 // DOM Elements
 const statusDot = document.getElementById('statusDot');
 const connectionText = document.getElementById('connectionText');
 const clientCount = document.getElementById('clientCount');
 const statMenunggu = document.getElementById('statMenunggu');
 const statDilayani = document.getElementById('statDilayani');
 const statSelesai = document.getElementById('statSelesai');
 const formAntrian = document.getElementById('formAntrian');
 const dokterSelect = document.getElementById('dokter');
 const antrianListEl = document.getElementById('antrianList');
 const dokterListEl = document.getElementById('dokterList');
 const btnPanggil = document.getElementById('btnPanggil');
 const logContainer = document.getElementById('logContainer');
 const toast = document.getElementById('toast');
 const toastMessage = document.getElementById('toastMessage');
 
 // Initialize WebSocket connection
 function connectWebSocket() {
     const wsUrl = `ws://${window.location.host}/ws/antrian`;
     
     try {
         ws = new WebSocket(wsUrl);
         
         ws.onopen = () => {
             console.log('WebSocket connected');
             statusDot.className = 'status-dot connected';
             connectionText.textContent = 'Terhubung ke Server';
             reconnectAttempts = 0;
             addLog('Terhubung ke WebSocket server', 'highlight');
         };
         
         ws.onclose = () => {
             console.log('WebSocket disconnected');
             statusDot.className = 'status-dot disconnected';
             connectionText.textContent = 'Terputus dari Server';
             addLog('Koneksi terputus');
             
             // Attempt reconnection
             if (reconnectAttempts < maxReconnectAttempts) {
                 reconnectAttempts++;
                 setTimeout(connectWebSocket, 3000);
                 addLog(`Mencoba menghubungkan ulang (${reconnectAttempts}/${maxReconnectAttempts})...`);
             }
         };
         
         ws.onerror = (error) => {
             console.error('WebSocket error:', error);
             addLog('Error koneksi WebSocket');
         };
         
         ws.onmessage = (event) => {
             try {
                 const message = JSON.parse(event.data);
                 handleMessage(message);
             } catch (e) {
                 console.error('Error parsing message:', e);
             }
         };
     } catch (e) {
         console.error('Failed to connect:', e);
         statusDot.className = 'status-dot disconnected';
         connectionText.textContent = 'Gagal terhubung';
     }
 }
 
 // Handle incoming WebSocket messages
 function handleMessage(message) {
     console.log('Received:', message.type);
     
     switch (message.type) {
         case 'INITIAL_DATA':
             handleInitialData(message.data);
             break;
         case 'ANTRIAN_BARU':
             handleAntrianBaru(message.data);
             break;
         case 'PANGGIL_ANTRIAN':
             handlePanggilAntrian(message.data);
             break;
         case 'STATUS_UPDATED':
             handleStatusUpdated(message.data);
             break;
         case 'DOKTER_STATUS':
             handleDokterStatus(message.data);
             break;
         case 'DASHBOARD_UPDATE':
             handleDashboardUpdate(message.data);
             break;
         default:
             console.log('Unknown message type:', message.type);
     }
 }
 
 // Handle initial data
 function handleInitialData(data) {
     antrianList = data.antrian || [];
     dokterList = data.dokter || [];
     
     renderDokterOptions();
     renderDokterList();
     renderAntrianList();
     
     if (data.statistik) {
         updateStats(data.statistik);
     }
     
     addLog('Data awal dimuat', 'highlight');
 }
 
 // Handle new queue
 function handleAntrianBaru(antrian) {
     antrianList.push(antrian);
     renderAntrianList();
     showToast(`Antrian Baru: No. ${antrian.nomor} - ${antrian.namaPasien}`, 'info');
     addLog(`Antrian baru: No. ${antrian.nomor} - ${antrian.namaPasien}`, 'highlight');
 }
 
 // Handle queue call
 function handlePanggilAntrian(antrian) {
     updateAntrianInList(antrian);
     renderAntrianList();
     showToast(`PANGGILAN: No. ${antrian.nomor} ke ${antrian.ruangan}`, 'success');
     addLog(`Panggilan: No. ${antrian.nomor} - ${antrian.namaPasien} ke ${antrian.ruangan}`, 'highlight');
 }
 
 // Handle status update
 function handleStatusUpdated(antrian) {
     updateAntrianInList(antrian);
     renderAntrianList();
     addLog(`Status update: No. ${antrian.nomor} -> ${antrian.status}`);
 }
 
 // Handle doctor status
 function handleDokterStatus(dokter) {
     const index = dokterList.findIndex(d => d.id === dokter.id);
     if (index !== -1) {
         dokterList[index] = dokter;
     }
     renderDokterList();
     addLog(`Dokter ${dokter.nama}: ${dokter.status}`);
 }
 
 // Handle dashboard update
 function handleDashboardUpdate(stats) {
     updateStats(stats);
 }
 
 // Update antrian in list
 function updateAntrianInList(antrian) {
     const index = antrianList.findIndex(a => a.nomor === antrian.nomor);
     if (index !== -1) {
         antrianList[index] = antrian;
     }
     
     // Remove completed from active list
     if (antrian.status === 'SELESAI') {
         antrianList = antrianList.filter(a => a.nomor !== antrian.nomor);
     }
 }
 
 // Update statistics
 function updateStats(stats) {
     statMenunggu.textContent = stats.totalMenunggu || 0;
     statDilayani.textContent = stats.totalDilayani || 0;
     statSelesai.textContent = stats.totalSelesai || 0;
 }
 
 // Render doctor options in select
 function renderDokterOptions() {
     dokterSelect.innerHTML = '<option value="">-- Pilih Dokter --</option>';
     dokterList.forEach(dokter => {
         const option = document.createElement('option');
         option.value = dokter.id;
         option.textContent = `${dokter.nama} - ${dokter.spesialisasi}`;
         dokterSelect.appendChild(option);
     });
 }
 
 // Render doctor list
 function renderDokterList() {
     if (dokterList.length === 0) {
         dokterListEl.innerHTML = '<p class="empty-message">Tidak ada data dokter</p>';
         return;
     }
     
     dokterListEl.innerHTML = dokterList.map(dokter => `
         <div class="doctor-item">
             <div class="doctor-info">
                 <h4>${dokter.nama}</h4>
                 <p>${dokter.spesialisasi} - ${dokter.ruangan}</p>
             </div>
             <span class="doctor-status ${dokter.status}">${dokter.status === 'available' ? 'Tersedia' : 'Sibuk'}</span>
         </div>
     `).join('');
 }
 
 // Render queue list
 function renderAntrianList() {
     const activeAntrian = antrianList.filter(a => a.status !== 'SELESAI');
     
     if (activeAntrian.length === 0) {
         antrianListEl.innerHTML = '<p class="empty-message">Belum ada antrian</p>';
         return;
     }
     
     antrianListEl.innerHTML = activeAntrian.map(antrian => `
         <div class="queue-item ${antrian.status === 'MENUNGGU' ? 'waiting' : 'serving'}">
             <div class="queue-item-info">
                 <div class="queue-number">No. ${antrian.nomor}</div>
                 <div class="queue-name">${antrian.namaPasien} - ${antrian.namaDokter || 'Dokter'}</div>
             </div>
             <span class="queue-status ${antrian.status.toLowerCase()}">${antrian.status}</span>
         </div>
     `).join('');
 }
 
 // Add log entry
 function addLog(message, className = '') {
     const logItem = document.createElement('p');
     logItem.className = `log-item ${className}`;
     const time = new Date().toLocaleTimeString('id-ID');
     logItem.textContent = `[${time}] ${message}`;
     logContainer.insertBefore(logItem, logContainer.firstChild);
     
     // Limit log entries
     while (logContainer.children.length > 50) {
         logContainer.removeChild(logContainer.lastChild);
     }
 }
 
 // Show toast notification
 function showToast(message, type = '') {
     toastMessage.textContent = message;
     toast.className = `toast ${type}`;
     
     setTimeout(() => {
         toast.classList.add('hidden');
     }, 4000);
 }
 
 // Form submission handler
 formAntrian.addEventListener('submit', (e) => {
     e.preventDefault();
     
     const namaPasien = document.getElementById('namaPasien').value.trim();
     const keluhan = document.getElementById('keluhan').value.trim();
     const dokterId = parseInt(dokterSelect.value);
     
     if (!namaPasien || !dokterId) {
         showToast('Mohon lengkapi data pasien dan pilih dokter', 'error');
         return;
     }
     
     if (ws && ws.readyState === WebSocket.OPEN) {
         ws.send(JSON.stringify({
             type: 'AMBIL_ANTRIAN',
             data: {
                 namaPasien,
                 keluhan,
                 dokterId
             }
         }));
         
         // Reset form
         formAntrian.reset();
         addLog(`Mengambil antrian untuk: ${namaPasien}`);
     } else {
         showToast('Tidak terhubung ke server', 'error');
     }
 });
 
 // Call next queue button
 btnPanggil.addEventListener('click', () => {
     if (ws && ws.readyState === WebSocket.OPEN) {
         ws.send(JSON.stringify({
             type: 'PANGGIL_ANTRIAN',
             data: {
                 action: 'PANGGIL_BERIKUTNYA'
             }
         }));
         addLog('Memanggil antrian berikutnya...');
     } else {
         showToast('Tidak terhubung ke server', 'error');
     }
 });
 
 // Initialize on page load
 document.addEventListener('DOMContentLoaded', () => {
     connectWebSocket();
 });
