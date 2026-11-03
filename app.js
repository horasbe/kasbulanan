const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzhZiTOuvJBroA6RgivhAbvJcmluVP8JLvYRINwZABx1eZDxqY2Ch709054y8JgqyjC/exec";

const DAFTAR_BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

let cacheDataMutasi = [];
let cacheAnggota = [];
let filterArahAktif = "Semua";
let pendingActionData = { rowId: null, status: null };
let dataIuranAktif = null;     // data iuran yang sedang dibuka di modal detail (tab Status)
let editModeAdmin = false;     // true saat admin mengoreksi data yang sudah disetujui

// State Pagination Riwayat Transaksi
let halamanAktif = 1;
const itemPerHalaman = 5;

// State Pilihan Bulan Multi-select
let pilihanBulanForm = [];
let pilihanBulanEdit = [];

document.addEventListener("DOMContentLoaded", function() {
  isiDropdownBulan();         // 1. ISI OPTION DROPDOWN BULAN
  isiDropdownTahunForm();     // 2. ISI OPTION DROPDOWN TAHUN
  penyesuaianFormKategori();  // 3. SET NILAI DEFAULT & LOGIKA FORM
  memuatData();               // 4. AMBIL DATA DARI SERVER

  // 5. ATUR EVENT LISTENER UNTUK DETEKSI PELUNASAN GANDA
  document.getElementById("masukNamaSelect")?.addEventListener("change", cekStatusBulanLunas);
  document.getElementById("masukTipe")?.addEventListener("change", cekStatusBulanLunas);
  document.getElementById("masukTahunSelect")?.addEventListener("change", cekStatusBulanLunas);
  document.getElementById("masukBulanSelect")?.addEventListener("change", cekStatusBulanLunas);
  document.getElementById("masukTahunSelectChips")?.addEventListener("change", cekStatusBulanLunas);
});

// ==========================================
// HELPER URL GAMBAR (GOOGLE DRIVE CONVERTER)
// ==========================================
function dapatkanUrlGambar(buktiUrl) {
  if (!buktiUrl || buktiUrl === "-" || String(buktiUrl).trim() === "") return "-";
  let url = String(buktiUrl).trim();
  if (url.includes("drive.google.com")) {
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return "https://lh3.googleusercontent.com/d/" + match[1];
    }
  }
  return url;
}

// ==========================================
// SISTEM TOAST NOTIFICATION
// ==========================================
function tampilkanToast(pesan, tipe = "sukses") {
  const toast = document.getElementById("toastNotification");
  const toastMsg = document.getElementById("toastMessage");
  const toastIcon = document.getElementById("toastIcon");

  if (!toast || !toastMsg || !toastIcon) return;

  toastMsg.innerText = pesan;

  if (tipe === "error") {
    toast.className = "fixed top-5 right-5 z-50 flex items-center gap-3 bg-rose-600 text-white px-4 py-3 rounded-2xl shadow-xl transform translate-y-0 opacity-100 transition-all duration-300 pointer-events-auto";
    toastIcon.className = "fa-solid fa-circle-exclamation text-lg";
  } else {
    toast.className = "fixed top-5 right-5 z-50 flex items-center gap-3 bg-emerald-600 text-white px-4 py-3 rounded-2xl shadow-xl transform translate-y-0 opacity-100 transition-all duration-300 pointer-events-auto";
    toastIcon.className = "fa-solid fa-circle-check text-lg";
  }

  setTimeout(() => {
    toast.classList.add("-translate-y-20", "opacity-0");
    toast.classList.remove("translate-y-0", "opacity-100");
    toast.classList.add("pointer-events-none");
  }, 3500);
}

// ==========================================
// FUNGSI SALIN REKENING
// ==========================================
function salinRekening(nomorRekening) {
  navigator.clipboard.writeText(nomorRekening).then(() => {
    tampilkanToast("Nomor rekening berhasil disalin!", "sukses");
  }).catch(() => {
    tampilkanToast("Gagal menyalin nomor rekening", "error");
  });
}

// ==========================================
// SISTEM NAVIGASI TAB UTAMA & SUB-TAB
// ==========================================
function pindahTabUtama(tab) {
  const listTab = ['ringkasan', 'status', 'userPending', 'form', 'admin'];
  
  listTab.forEach(t => {
    const konten = document.getElementById(`tabKonten${t.charAt(0).toUpperCase() + t.slice(1)}`);
    const btn = document.getElementById(`nav${t.charAt(0).toUpperCase() + t.slice(1)}`);
    
    if (konten) {
      if (t === tab) {
        konten.classList.remove("hidden");
        if (btn) {
          btn.classList.add("text-indigo-600");
          btn.classList.remove("text-slate-400");
        }
      } else {
        konten.classList.add("hidden");
        if (btn) {
          btn.classList.add("text-slate-400");
          btn.classList.remove("text-indigo-600");
        }
      }
    }
  });
}

function gantiSubTabForm(tab) {
  const formMasuk = document.getElementById("formMasuk");
  const formKeluar = document.getElementById("formKeluar");
  const tabMasukBtn = document.getElementById("tabMasukBtn");
  const tabKeluarBtn = document.getElementById("tabKeluarBtn");

  if (tab === 'masuk') {
    formMasuk.classList.remove("hidden");
    formKeluar.classList.add("hidden");
    tabMasukBtn.className = "flex-1 py-3 text-center font-bold text-xs md:text-sm text-indigo-600 border-b-2 border-indigo-600 transition flex items-center justify-center gap-2";
    tabKeluarBtn.className = "flex-1 py-3 text-center font-bold text-xs md:text-sm text-slate-500 hover:text-indigo-600 transition flex items-center justify-center gap-2";
  } else {
    formMasuk.classList.add("hidden");
    formKeluar.classList.remove("hidden");
    tabMasukBtn.className = "flex-1 py-3 text-center font-bold text-xs md:text-sm text-slate-500 hover:text-indigo-600 transition flex items-center justify-center gap-2";
    tabKeluarBtn.className = "flex-1 py-3 text-center font-bold text-xs md:text-sm text-rose-600 border-b-2 border-rose-600 transition flex items-center justify-center gap-2";
  }
}

// ==========================================
// LOGIKA TAMPILAN BULAN (DROPDOWN VS CHIPS)
// ==========================================
function isiDropdownBulan() {
  const selForm = document.getElementById("masukBulanSelect");
  const selEdit = document.getElementById("editBulanSelect");
  
  if (selForm) {
    selForm.innerHTML = '<option value="">-- Pilih Bulan --</option>';
    DAFTAR_BULAN.forEach(b => {
      selForm.innerHTML += `<option value="${b}">${b}</option>`;
    });
  }

  if (selEdit) {
    selEdit.innerHTML = '<option value="">-- Pilih Bulan --</option>';
    DAFTAR_BULAN.forEach(b => {
      selEdit.innerHTML += `<option value="${b}">${b}</option>`;
    });
  }
}

function isiDropdownTahunForm() {
  const selTahun = document.getElementById("masukTahunSelect");
  const selTahunChips = document.getElementById("masukTahunSelectChips");
  if (!selTahun) return;

  const tahunSekarang = new Date().getFullYear();
  const rentangAwal = tahunSekarang - 2;
  const rentangAkhir = tahunSekarang + 2;

  let optionsHtml = "";
  for (let t = rentangAwal; t <= rentangAkhir; t++) {
    optionsHtml += `<option value="${t}" ${t === tahunSekarang ? 'selected' : ''}>${t}</option>`;
  }

  selTahun.innerHTML = optionsHtml;
  if (selTahunChips) selTahunChips.innerHTML = optionsHtml;
}

function cekModeInputBulanForm() {
  const kategori = document.getElementById("masukTipe").value;
  const inputNominal = document.getElementById("masukNominal").value;
  const nominal = Number(dapatkanAngkaMurni(inputNominal)) || 0;

  const containerChips = document.getElementById("gridBulanWrapper");
  const containerDropdown = document.getElementById("dropdownBulanWrapper");
  const selectBulan = document.getElementById("masukBulanSelect");
  const selectTahun = document.getElementById("masukTahunSelect");

  const skrg = new Date();
  const bulanSekarangIdx = skrg.getMonth();
  const tahunSekarang = skrg.getFullYear();

  if (selectTahun && selectTahun.options.length === 0) {
    isiDropdownTahunForm();
  }

  if (kategori === "Donasi" || kategori === "Lainnya") {
    containerChips.classList.add("hidden");
    containerDropdown.classList.remove("hidden");
    
    selectBulan.value = DAFTAR_BULAN[bulanSekarangIdx];
    if (selectTahun) selectTahun.value = tahunSekarang;
    
    pilihanBulanForm = [];
    cekStatusBulanLunas();
    return;
  }

  if (nominal > 100000 && nominal % 100000 === 0) {
    containerChips.classList.remove("hidden");
    containerDropdown.classList.add("hidden");
    renderGridBulanForm();
  } else {
    containerChips.classList.add("hidden");
    containerDropdown.classList.remove("hidden");

    if (nominal === 100000) {
      selectBulan.value = DAFTAR_BULAN[bulanSekarangIdx];
      if (selectTahun) selectTahun.value = tahunSekarang;
    }
  }

  cekStatusBulanLunas();
}

function cekModeInputBulanEdit() {
  const kategori = document.getElementById("editTipe").value;
  const inputNominal = document.getElementById("editNominal").value;
  const nominal = Number(dapatkanAngkaMurni(inputNominal)) || 0;

  const containerChips = document.getElementById("gridEditBulanWrapper");
  const containerDropdown = document.getElementById("dropdownEditBulanWrapper");

  if ((kategori === "Kas Bulanan" || kategori === "Dana Sosial") && nominal > 100000 && nominal % 100000 === 0) {
    containerChips.classList.remove("hidden");
    containerDropdown.classList.add("hidden");
    renderGridBulanEdit();
  } else {
    containerChips.classList.add("hidden");
    containerDropdown.classList.remove("hidden");
  }
}

function renderGridBulanForm() {
  const container = document.getElementById("gridBulanContainer");
  if (!container) return;
  container.innerHTML = "";

  DAFTAR_BULAN.forEach(bln => {
    const isSelected = pilihanBulanForm.includes(bln);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1 ${
      isSelected 
        ? "bg-indigo-600 text-white border-indigo-600 shadow-sm" 
        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
    }`;
    btn.innerText = bln;
    btn.onclick = () => togglePilihanBulanForm(bln);
    container.appendChild(btn);
  });
}

function togglePilihanBulanForm(bln) {
  if (pilihanBulanForm.includes(bln)) {
    pilihanBulanForm = pilihanBulanForm.filter(b => b !== bln);
  } else {
    pilihanBulanForm.push(bln);
  }
  renderGridBulanForm();
  cekStatusBulanLunas();
}

function renderGridBulanEdit() {
  const container = document.getElementById("gridEditBulanContainer");
  if (!container) return;
  container.innerHTML = "";

  DAFTAR_BULAN.forEach(bln => {
    const isSelected = pilihanBulanEdit.includes(bln);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `py-2 px-2 rounded-xl border text-[11px] font-bold transition flex items-center justify-center ${
      isSelected 
        ? "bg-amber-500 text-white border-amber-500 shadow-sm" 
        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
    }`;
    btn.innerText = bln;
    btn.onclick = () => togglePilihanBulanEdit(bln);
    container.appendChild(btn);
  });
}

function togglePilihanBulanEdit(bln) {
  if (pilihanBulanEdit.includes(bln)) {
    pilihanBulanEdit = pilihanBulanEdit.filter(b => b !== bln);
  } else {
    pilihanBulanEdit.push(bln);
  }
  renderGridBulanEdit();
}

// ==========================================
// HELPER & FORMATTER DATA
// ==========================================
function formatInputRibuan(input, mode = 'form') {
  let val = input.value.replace(/\D/g, '');
  input.value = val ? new Intl.NumberFormat('id-ID').format(val) : '';

  if (mode === 'form') {
    cekModeInputBulanForm();
  } else {
    cekModeInputBulanEdit();
  }
}

function dapatkanAngkaMurni(str) {
  return str ? String(str).replace(/\D/g, '') : '0';
}

function formatRupiah(angka) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(angka || 0);
}

const toBase64 = file => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => {
    let encoded = reader.result.toString().replace(/^data:(.*,)?/, '');
    if ((encoded.length % 4) !== 0) {
      encoded += '='.repeat((4 - encoded.length % 4) % 4);
    }
    resolve({ base64: encoded, mime: file.type });
  };
  reader.onerror = error => reject(error);
});

function penyesuaianFormKategori() {
  const kategori = document.getElementById("masukTipe").value;
  const labelNama = document.getElementById("labelNama");
  const selectNama = document.getElementById("masukNamaSelect");
  const inputNama = document.getElementById("masukNamaInput");
  const inputNominal = document.getElementById("masukNominal");

  pilihanBulanForm = [];

  if (kategori === "Donasi" || kategori === "Lainnya") {
    labelNama.innerHTML = `2. Nama Donatur / Penyumbang <span class="text-rose-500">*</span>`;
    selectNama.classList.add("hidden");
    selectNama.removeAttribute("required");
    
    inputNama.classList.remove("hidden");
    inputNama.setAttribute("required", "true");
    
    inputNominal.value = "";
  } else {
    labelNama.innerHTML = `2. Nama Anggota <span class="text-rose-500">*</span>`;
    inputNama.classList.add("hidden");
    inputNama.removeAttribute("required");
    
    selectNama.classList.remove("hidden");
    selectNama.setAttribute("required", "true");

    inputNominal.value = new Intl.NumberFormat('id-ID').format(100000);
  }

  cekModeInputBulanForm();
}

// ==========================================
// URUTKAN RIWAYAT: TERBARU -> TERLAMA
// ==========================================
function urutkanTerbaru(daftar) {
  // Ubah "dd/MM/yyyy" menjadi angka yyyyMMdd agar mudah dibandingkan
  const keAngkaTanggal = (str) => {
    const m = String(str || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    return m ? Number(m[3]) * 10000 + Number(m[2]) * 100 + Number(m[1]) : 0;
  };

  // Dibalik dulu supaya untuk tanggal yang sama, baris yang lebih baru di sheet tampil lebih atas
  return daftar
    .slice()
    .reverse()
    .sort((a, b) => keAngkaTanggal(b.tanggal) - keAngkaTanggal(a.tanggal));
}

// ==========================================
// KONEKSI SERVER & FETCH DATA
// ==========================================
async function memuatData() {
  const icon = document.getElementById("refreshIcon");
  if (icon) icon.classList.add("fa-spin");

  try {
    const res = await fetch(WEB_APP_URL);
    const data = await res.json();

    document.getElementById("totalMasuk").innerText = formatRupiah(data.saldo.totalMasuk);
    document.getElementById("totalKeluar").innerText = formatRupiah(data.saldo.totalKeluar);
    document.getElementById("sisaSaldo").innerText = formatRupiah(data.saldo.sisa);

    cacheAnggota = data.anggota || [];
    const selectAnggota = document.getElementById("masukNamaSelect");
    selectAnggota.innerHTML = '<option value="">-- Pilih Nama Anggota --</option>';
    cacheAnggota.forEach(nama => {
      selectAnggota.innerHTML += `<option value="${nama}">${nama}</option>`;
    });

    cacheDataMutasi = urutkanTerbaru(data.riwayatMutasi || []);

    hitungRincianKategori(cacheDataMutasi);
    tampilkanTabelLaporan();
    tampilkanRekapIuran();

    renderUserPending(data.pendingData || []);
    renderAdminPending(data.pendingData || []);

    cekStatusBulanLunas();

  } catch (err) {
    console.error("Gagal memuat data:", err);
    tampilkanToast("Gagal memuat data dari server.", "error");
  } finally {
    if (icon) icon.classList.remove("fa-spin");
  }
}

// ==========================================
// RENDER DATA & MODAL PREVIEW
// ==========================================
function tampilkanRekapIuran() {
  const tbody = document.getElementById("tabelRekapIuran");
  const tahunDipilih = document.getElementById("filterTahunIuran").value;
  tbody.innerHTML = "";

  if (!cacheAnggota || cacheAnggota.length === 0) {
    tbody.innerHTML = `<tr><td colspan="13" class="py-4 text-slate-400 text-center">Tidak ada data anggota.</td></tr>`;
    return;
  }

  const iuranDisetujui = cacheDataMutasi.filter(m => 
    m.arah === "Masuk" && m.tipe === "Kas Bulanan" && String(m.tahun) === String(tahunDipilih)
  );

  cacheAnggota.forEach(nama => {
    let trHtml = `<tr class="hover:bg-slate-50 border-b border-slate-100">`;
    trHtml += `<td class="px-3 py-2.5 text-left font-bold text-slate-700">${nama}</td>`;

    DAFTAR_BULAN.forEach(bln => {
      const dataLunas = iuranDisetujui.find(i => 
        i.nama && i.nama.trim().toLowerCase() === nama.trim().toLowerCase() && 
        i.bulan && i.bulan.trim().toLowerCase().includes(bln.toLowerCase())
      );

      if (dataLunas) {
        const jsonStr = JSON.stringify(dataLunas).replace(/"/g, '&quot;');
        trHtml += `
          <td class="px-1 py-2.5">
            <button onclick="bukaPreviewDetailIuran(${jsonStr})" class="inline-flex items-center justify-center w-5 h-5 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-full font-extrabold text-[10px] shadow-sm transition active:scale-95" title="Klik untuk lihat detail">
              ✓
            </button>
          </td>`;
      } else {
        trHtml += `<td class="px-1 py-2.5"><span class="inline-flex items-center justify-center w-5 h-5 bg-slate-100 text-slate-300 rounded-full font-bold text-[10px]">-</span></td>`;
      }
    });

    trHtml += `</tr>`;
    tbody.innerHTML += trHtml;
  });
}

function bukaPreviewDetailIuran(data) {
  dataIuranAktif = data;
  document.getElementById("detailNama").innerText = data.nama || "-";
  document.getElementById("detailPeriode").innerText = `${data.bulan || ''} ${data.tahun || ''}`;
  document.getElementById("detailTanggal").innerText = data.tanggal || "-";
  document.getElementById("detailNominal").innerText = formatRupiah(data.nominal);

  const imgEl = document.getElementById("detailBuktiImg");
  const noImgEl = document.getElementById("detailNoImg");
  const urlGambar = dapatkanUrlGambar(data.bukti);

  if (urlGambar !== "-") {
    imgEl.src = urlGambar;
    imgEl.classList.remove("hidden");
    noImgEl.classList.add("hidden");
  } else {
    imgEl.src = "";
    imgEl.classList.add("hidden");
    noImgEl.classList.remove("hidden");
  }

  document.getElementById("modalDetailIuran").classList.remove("hidden");
}

function tutupModalDetailIuran() {
  document.getElementById("modalDetailIuran").classList.add("hidden");
}

// Koreksi admin dari tab Status: edit data yang sudah disetujui
function editDariStatus() {
  if (!dataIuranAktif || dataIuranAktif.rowId === undefined || dataIuranAktif.rowId === null) {
    tampilkanToast("Data ini tidak memiliki rowId, cek respons server (riwayatMutasi).", "error");
    return;
  }
  const data = dataIuranAktif;
  tutupModalDetailIuran();
  bukaModalEdit(data, true);
}

// Koreksi admin dari tab Status: batalkan persetujuan (kembali ke Pending)
function kembalikanKePending() {
  if (!dataIuranAktif || dataIuranAktif.rowId === undefined || dataIuranAktif.rowId === null) {
    tampilkanToast("Data ini tidak memiliki rowId, cek respons server (riwayatMutasi).", "error");
    return;
  }
  const rowId = dataIuranAktif.rowId;
  tutupModalDetailIuran();
  bukaModalPin(rowId, "Pending");
}

function bukaModalDetailRiwayat(data) {
  document.getElementById("riwayatNama").innerText = data.nama || "-";
  document.getElementById("riwayatTipe").innerText = data.tipe || "-";
  document.getElementById("riwayatTanggal").innerText = data.tanggal || "-";
  document.getElementById("riwayatNominal").innerText = formatRupiah(data.nominal);

  const imgEl = document.getElementById("riwayatBuktiImg");
  const noImgEl = document.getElementById("riwayatNoImg");
  const urlGambar = dapatkanUrlGambar(data.bukti);

  if (urlGambar !== "-") {
    imgEl.src = urlGambar;
    imgEl.classList.remove("hidden");
    noImgEl.classList.add("hidden");
  } else {
    imgEl.src = "";
    imgEl.classList.add("hidden");
    noImgEl.classList.remove("hidden");
  }

  document.getElementById("modalDetailRiwayat").classList.remove("hidden");
}

function tutupModalDetailRiwayat() {
  document.getElementById("modalDetailRiwayat").classList.add("hidden");
}

function renderUserPending(pendingData) {
  const container = document.getElementById("containerUserPending");
  const badge = document.getElementById("badgeUserPending");
  const navUserPending = document.getElementById("navUserPending");
  const navContainer = document.getElementById("navContainer");

  container.innerHTML = "";

  if (pendingData.length > 0) {
    navUserPending.classList.remove("hidden");
    navUserPending.classList.add("flex");
    navContainer.className = "max-w-3xl mx-auto grid grid-cols-5 text-center";

    badge.innerText = pendingData.length;
    badge.classList.remove("hidden");

    pendingData.forEach(item => {
      const periodeStr = (item.bulan && item.bulan !== '-' && item.bulan !== 'Tidak Ada / Insidental') 
        ? `${item.bulan} ${item.tahun || ''}` : 'Insidental';

      const jsonString = JSON.stringify(item).replace(/"/g, '&quot;');
      const imgUrl = dapatkanUrlGambar(item.bukti);

      container.innerHTML += `
        <div class="bg-amber-50/60 border border-amber-200 rounded-2xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
          <div class="flex items-center gap-3 w-full sm:w-auto">
            <div class="w-16 h-16 bg-white border border-amber-200 rounded-xl overflow-hidden shrink-0 flex items-center justify-center cursor-pointer" onclick="bukaModal('${imgUrl}')">
              ${imgUrl !== "-" 
                ? `<img src="${imgUrl}" class="w-full h-full object-cover hover:scale-105 transition" alt="Bukti">` 
                : `<i class="fa-solid fa-image text-slate-300 text-lg"></i>`}
            </div>

            <div class="space-y-0.5">
              <div class="flex items-center gap-2">
                <span class="font-bold text-slate-800 text-xs">${item.nama}</span>
                <span class="bg-amber-200 text-amber-800 text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase">Pending</span>
              </div>
              <p class="text-[11px] text-slate-500 font-medium">${item.tipe} • <span class="text-indigo-600 font-bold">${periodeStr}</span></p>
              <p class="text-xs font-extrabold text-emerald-600">${formatRupiah(item.nominal)}</p>
            </div>
          </div>

          <div class="flex items-center gap-2 w-full sm:w-auto border-t sm:border-t-0 pt-2 sm:pt-0 border-amber-200 justify-end">
            ${imgUrl !== "-" ? `<button onclick="bukaModal('${imgUrl}')" class="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 flex items-center gap-1"><i class="fa-solid fa-eye"></i> Perbesar Foto</button>` : ''}
            <button onclick="bukaModalEdit(${jsonString})" class="px-3.5 py-1.5 bg-amber-500 text-white rounded-xl text-xs font-bold hover:bg-amber-600 transition flex items-center gap-1 shadow-sm">
              <i class="fa-solid fa-pen-to-square"></i> Edit Data
            </button>
          </div>
        </div>
      `;
    });
  } else {
    navUserPending.classList.add("hidden");
    navUserPending.classList.remove("flex");
    navContainer.className = "max-w-3xl mx-auto grid grid-cols-4 text-center";

    badge.classList.add("hidden");
    container.innerHTML = `<div class="text-center py-6 text-slate-400 text-xs">Tidak ada setoran yang pending.</div>`;

    const tabKontenPending = document.getElementById("tabKontenUserPending");
    if (tabKontenPending && !tabKontenPending.classList.contains("hidden")) {
      pindahTabUtama('ringkasan');
    }
  }
}

function renderAdminPending(pendingData) {
  const containerAdmin = document.getElementById("containerAdminPending");
  const badgePending = document.getElementById("badgePendingNav");
  containerAdmin.innerHTML = "";

  if (pendingData.length > 0) {
    badgePending.innerText = pendingData.length;
    badgePending.classList.remove("hidden");

    pendingData.forEach(item => {
      const periodeStr = (item.bulan && item.bulan !== '-' && item.bulan !== 'Tidak Ada / Insidental') 
        ? `${item.bulan} ${item.tahun || ''}` : '-';

      const imgUrl = dapatkanUrlGambar(item.bukti);

      containerAdmin.innerHTML += `
        <div class="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between gap-3 hover:border-indigo-200 transition">
          <div class="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
            <div>
              <h3 class="font-bold text-slate-800 text-xs md:text-sm">${item.nama}</h3>
              <p class="text-[11px] text-indigo-600 font-semibold">${item.tipe}</p>
            </div>
            <span class="bg-amber-100 text-amber-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase">Perlu Persetujuan</span>
          </div>

          <div class="flex items-center gap-3 my-1">
            <div class="w-16 h-16 bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shrink-0 flex items-center justify-center cursor-pointer" onclick="bukaModal('${imgUrl}')">
              ${imgUrl !== "-" 
                ? `<img src="${imgUrl}" class="w-full h-full object-cover hover:scale-105 transition" alt="Bukti">` 
                : `<i class="fa-solid fa-image text-slate-300 text-lg"></i>`}
            </div>

            <div class="flex-1 space-y-1">
              <div class="flex items-center justify-between text-xs">
                <span class="text-[10px] text-slate-400 uppercase font-bold">Periode</span>
                <span class="font-semibold text-slate-700">${periodeStr}</span>
              </div>
              <div class="flex items-center justify-between text-xs">
                <span class="text-[10px] text-slate-400 uppercase font-bold">Nominal</span>
                <span class="font-extrabold text-emerald-600 text-sm">${formatRupiah(item.nominal)}</span>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-2 border-t border-slate-100 pt-3">
            ${imgUrl !== "-" ? `
              <button onclick="bukaModal('${imgUrl}')" class="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition flex items-center gap-1">
                <i class="fa-solid fa-eye"></i> Perbesar
              </button>
            ` : ''}
            
            <div class="flex items-center gap-1.5 ml-auto">
              <button onclick="bukaModalPin(${item.rowId}, 'Ditolak')" class="bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs px-3 py-1.5 rounded-xl font-bold transition">
                Tolak
              </button>
              <button onclick="bukaModalPin(${item.rowId}, 'Disetujui')" class="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3.5 py-1.5 rounded-xl font-bold transition shadow-sm flex items-center gap-1">
                <i class="fa-solid fa-check"></i> Setujui
              </button>
            </div>
          </div>
        </div>
      `;
    });
  } else {
    badgePending.classList.add("hidden");
    containerAdmin.innerHTML = `<div class="text-center py-6 text-slate-400 text-xs md:col-span-2">Tidak ada transaksi pending.</div>`;
  }
}

// ==========================================
// MODAL EDIT & AKSI TRANSAKSI
// ==========================================
function bukaModalEdit(item, modeAdmin = false) {
  editModeAdmin = modeAdmin;
  document.getElementById("editPinWrapper").classList.toggle("hidden", !modeAdmin);
  document.getElementById("editPinAdmin").value = "";
  document.getElementById("editJudul").innerText = modeAdmin ? "Koreksi Data Disetujui (Admin)" : "Edit Setoran Pending";

  document.getElementById("editRowId").value = item.rowId;
  document.getElementById("editNama").value = item.nama;
  document.getElementById("editTipe").value = item.tipe;
  document.getElementById("editTahun").value = item.tahun || new Date().getFullYear().toString();
  document.getElementById("editNominal").value = new Intl.NumberFormat('id-ID').format(item.nominal);
  document.getElementById("editBuktiUrlLama").value = item.bukti;
  document.getElementById("editFile").value = "";

  if (item.bulan && item.bulan !== '-' && item.bulan !== 'Tidak Ada / Insidental') {
    pilihanBulanEdit = item.bulan.split(',').map(b => b.trim());
    document.getElementById("editBulanSelect").value = pilihanBulanEdit[0] || "";
  } else {
    pilihanBulanEdit = [];
    document.getElementById("editBulanSelect").value = "";
  }

  cekModeInputBulanEdit();
  document.getElementById("modalEditSetoran").classList.remove("hidden");
}

function tutupModalEdit() {
  document.getElementById("modalEditSetoran").classList.add("hidden");
  editModeAdmin = false;
}

async function prosesKirimEdit(e) {
  e.preventDefault();

  const kategori = document.getElementById("editTipe").value;
  const nominal = Number(dapatkanAngkaMurni(document.getElementById("editNominal").value)) || 0;
  let stringBulanEdit = "";

  if ((kategori === "Kas Bulanan" || kategori === "Dana Sosial") && nominal > 100000 && nominal % 100000 === 0) {
    stringBulanEdit = pilihanBulanEdit.join(", ");
  } else {
    stringBulanEdit = document.getElementById("editBulanSelect").value;
  }

  if (!stringBulanEdit) {
    tampilkanToast("Silakan pilih bulan transaksi!", "error");
    return;
  }

  const pinEdit = document.getElementById("editPinAdmin").value;
  if (editModeAdmin && !pinEdit) {
    tampilkanToast("PIN Admin wajib diisi untuk mengoreksi data!", "error");
    return;
  }

  const btn = document.getElementById("btnSubmitEdit");
  btn.disabled = true;
  btn.innerText = "Saving...";

  try {
    const fileInput = document.getElementById("editFile").files[0];
    let fileData = "-", fileMime = "";

    if (fileInput) {
      const resFile = await toBase64(fileInput);
      fileData = resFile.base64;
      fileMime = resFile.mime;
    }

    const payload = {
      action: "editSetoran",
      rowId: document.getElementById("editRowId").value,
      nama: document.getElementById("editNama").value,
      tipe: kategori,
      bulan: stringBulanEdit,
      tahun: document.getElementById("editTahun").value,
      nominal: nominal,
      buktiUrlLama: document.getElementById("editBuktiUrlLama").value,
      fileData: fileData,
      fileMime: fileMime
    };

    if (editModeAdmin) {
      payload.adminEdit = true;
      payload.pin = pinEdit;
    }

    const res = await fetch(WEB_APP_URL, {
      method: "POST",
      body: JSON.stringify(payload)
    });

    const result = await res.json();

    if (result.status === "error_pin") {
      tampilkanToast("PIN Admin Salah!", "error");
      return;
    }

    if (result.status === "success") {
      tampilkanToast("Data setoran berhasil diperbarui!", "sukses");
      tutupModalEdit();
      memuatData();
    } else {
      tampilkanToast(result.message, "error");
    }
  } catch (err) {
    tampilkanToast("Gagal mengedit data: " + err.message, "error");
  } finally {
    btn.disabled = false;
    btn.innerText = "Simpan Perubahan";
  }
}

function hitungRincianKategori(mutasi) {
  let kasBulanan = 0, danaSosial = 0, donasi = 0;
  let acara = 0, santunan = 0, peralatanLain = 0;

  mutasi.forEach(m => {
    const nom = Number(m.nominal) || 0;
    if (m.arah === "Masuk") {
      if (m.tipe === "Kas Bulanan") kasBulanan += nom;
      else if (m.tipe === "Dana Sosial") danaSosial += nom;
      else donasi += nom;
    } else {
      if (m.tipe === "Acara/Konsumsi") acara += nom;
      else if (m.tipe === "Santunan/Sosial") santunan += nom;
      else peralatanLain += nom;
    }
  });

  document.getElementById("rinciKasBulanan").innerText = formatRupiah(kasBulanan);
  document.getElementById("rinciDanaSosial").innerText = formatRupiah(danaSosial);
  document.getElementById("rinciDonasi").innerText = formatRupiah(donasi);

  document.getElementById("rinciAcara").innerText = formatRupiah(Math.abs(acara));
  document.getElementById("rinciSantunan").innerText = formatRupiah(Math.abs(santunan));
  document.getElementById("rinciLainnya").innerText = formatRupiah(Math.abs(peralatanLain));
}

function setFilterArah(arah) {
  filterArahAktif = arah;
  halamanAktif = 1;

  const btnAll = document.getElementById("filterAll");
  const btnMasuk = document.getElementById("filterMasuk");
  const btnKeluar = document.getElementById("filterKeluar");

  const activeStyle = "px-2.5 py-1 rounded-lg bg-white text-slate-800 shadow-sm";
  const inactiveStyle = "px-2.5 py-1 rounded-lg text-slate-500 hover:text-slate-800";

  btnAll.className = arah === 'Semua' ? activeStyle : inactiveStyle;
  btnMasuk.className = arah === 'Masuk' ? activeStyle : inactiveStyle;
  btnKeluar.className = arah === 'Keluar' ? activeStyle : inactiveStyle;

  tampilkanTabelLaporan();
}

function gantiHalaman(arah) {
  halamanAktif += arah;
  tampilkanTabelLaporan();
}

// ==========================================
// TAMPILAN RIWAYAT E-WALLET & PAGINATION
// ==========================================
// ==========================================
// TAMPILAN RIWAYAT E-WALLET / M-BANKING & PAGINATION
// ==========================================
function tampilkanTabelLaporan() {
  const container = document.getElementById("tabelMutasi");
  container.innerHTML = "";

  let dataFiltered = cacheDataMutasi;
  if (filterArahAktif !== "Semua") {
    dataFiltered = cacheDataMutasi.filter(m => m.arah === filterArahAktif);
  }

  const totalData = dataFiltered.length;
  const totalHalaman = Math.ceil(totalData / itemPerHalaman) || 1;

  if (halamanAktif > totalHalaman) halamanAktif = totalHalaman;
  if (halamanAktif < 1) halamanAktif = 1;

  const indeksMulai = (halamanAktif - 1) * itemPerHalaman;
  const dataHalaman = dataFiltered.slice(indeksMulai, indeksMulai + itemPerHalaman);

  if (dataHalaman.length > 0) {
    dataHalaman.forEach(m => {
      const isMasuk = m.arah === "Masuk";
      const jsonStr = JSON.stringify(m).replace(/"/g, '&quot;');
      const keteranganBulan = (m.bulan && m.bulan !== '-' && m.bulan !== 'Tidak Ada / Insidental') ? ` (${m.bulan})` : '';

      container.innerHTML += `
        <div onclick="bukaModalDetailRiwayat(${jsonStr})" class="flex items-center justify-between py-3 px-1 border-b border-slate-100 hover:bg-slate-50/80 cursor-pointer transition active:scale-[0.99]">
          <div class="space-y-0.5">
            <p class="font-bold text-xs text-slate-800 line-clamp-1">${m.nama}${keteranganBulan}</p>
            <div class="flex items-center gap-2">
              <span class="text-[10px] font-semibold text-slate-400">${m.tanggal}</span>
              <span class="text-[10px] font-bold text-slate-500">• ${m.tipe}</span>
            </div>
          </div>
          <div class="text-right shrink-0">
            <p class="font-extrabold text-xs md:text-sm ${isMasuk ? 'text-emerald-600' : 'text-slate-800'}">
              ${isMasuk ? '+' : '-'}${formatRupiah(m.nominal)}
            </p>
          </div>
        </div>
      `;
    });
  } else {
    container.innerHTML = `<div class="text-center py-6 text-slate-400 text-xs">Tidak ada data transaksi.</div>`;
  }


  // Render Kontrol Pagination
  const pageInfo = document.getElementById("pageInfo");
  const btnPrev = document.getElementById("btnPrevPage");
  const btnNext = document.getElementById("btnNextPage");

  if (pageInfo) pageInfo.innerText = `Halaman ${halamanAktif} dari ${totalHalaman}`;
  if (btnPrev) btnPrev.disabled = halamanAktif === 1;
  if (btnNext) btnNext.disabled = halamanAktif >= totalHalaman;
}

async function kirimPemasukan(e) {
  e.preventDefault();
  const btn = document.getElementById("btnSubmitMasuk");
  
  const kategori = document.getElementById("masukTipe").value;
  const nominal = Number(dapatkanAngkaMurni(document.getElementById("masukNominal").value)) || 0;
  const inputTahun = (nominal > 100000 && nominal % 100000 === 0)
    ? document.getElementById("masukTahunSelectChips").value
    : document.getElementById("masukTahunSelect").value;

  let stringBulan = "";

  if ((kategori === "Kas Bulanan" || kategori === "Dana Sosial") && nominal > 100000 && nominal % 100000 === 0) {
    stringBulan = pilihanBulanForm.join(", ");
  } else {
    stringBulan = document.getElementById("masukBulanSelect").value;
  }

  if (!stringBulan || stringBulan === "") {
    tampilkanToast("Silakan pilih bulan transaksi!", "error");
    return;
  }

  if (!inputTahun) {
    tampilkanToast("Silakan isi tahun transaksi!", "error");
    return;
  }

  btn.disabled = true;
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Mengirim...`;

  try {
    const namaPenyetor = (kategori === "Donasi" || kategori === "Lainnya") 
      ? document.getElementById("masukNamaInput").value 
      : document.getElementById("masukNamaSelect").value;

    const fileInput = document.getElementById("masukFile").files[0];
    let fileData = "-", fileMime = "";

    if (fileInput) {
      const resFile = await toBase64(fileInput);
      fileData = resFile.base64;
      fileMime = resFile.mime;
    }

    const payload = {
      action: "tambahSetoran",
      nama: namaPenyetor,
      tipe: kategori,
      bulan: stringBulan,
      tahun: inputTahun,
      nominal: nominal,
      fileName: fileInput ? fileInput.name : "bukti.png",
      fileData: fileData,
      fileMime: fileMime
    };

    await fetch(WEB_APP_URL, {
      method: "POST",
      body: JSON.stringify(payload)
    });

    tampilkanToast("Berhasil dikirim! Data Anda dapat dilihat/diedit di tab 'Pending (Edit)'.", "sukses");
    document.getElementById("formMasuk").reset();
    pilihanBulanForm = [];
    penyesuaianFormKategori();
    await memuatData();
    pindahTabUtama('userPending');

  } catch (err) {
    tampilkanToast("Gagal mengirim data: " + err.message, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Kirim Sekarang`;
  }
}

async function kirimPengeluaran(e) {
  e.preventDefault();
  const btn = document.getElementById("btnSubmitKeluar");
  btn.disabled = true;
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...`;

  try {
    const fileInput = document.getElementById("keluarFile").files[0];
    let fileData = "-", fileMime = "";

    if (fileInput) {
      const resFile = await toBase64(fileInput);
      fileData = resFile.base64;
      fileMime = resFile.mime;
    }

    const payload = {
      action: "tambahPengeluaran",
      kategori: document.getElementById("keluarKategori").value,
      nominal: dapatkanAngkaMurni(document.getElementById("keluarNominal").value),
      detail: document.getElementById("keluarDetail").value,
      admin: document.getElementById("keluarAdmin").value,
      pin: document.getElementById("keluarPinAdmin").value,
      fileData: fileData,
      fileMime: fileMime
    };

    const res = await fetch(WEB_APP_URL, {
      method: "POST",
      body: JSON.stringify(payload)
    });

    const result = await res.json();

    if (result.status === "error_pin") {
      tampilkanToast("PIN Admin Salah!", "error");
      return;
    }

    tampilkanToast("Pengeluaran kas berhasil dicatat!", "sukses");
    document.getElementById("formKeluar").reset();
    memuatData();
    pindahTabUtama('ringkasan');

  } catch (err) {
    tampilkanToast("Gagal menyimpan pengeluaran: " + err.message, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-receipt"></i> Simpan Pengeluaran Kas`;
  }
}

// ==========================================
// CONTROL MODAL UTAMA & ADMIN PIN
// ==========================================
function bukaModalPin(rowId, status) {
  pendingActionData = { rowId: rowId, status: status };
  const inputPin = document.getElementById("inputPinAdmin");
  
  inputPin.value = "";
  document.getElementById("pinErrorMsg").classList.add("hidden");
  document.getElementById("pinModalSub").innerText = `Status transaksi akan diubah menjadi '${status}'.`;
  document.getElementById("modalPin").classList.remove("hidden");
  
  setTimeout(() => {
    inputPin.focus();
    inputPin.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 100);
}

function tutupModalPin() {
  document.getElementById("modalPin").classList.add("hidden");
  pendingActionData = { rowId: null, status: null };
}

async function prosesKonfirmasiPin() {
  const inputPin = document.getElementById("inputPinAdmin").value;
  const errorMsg = document.getElementById("pinErrorMsg");
  const btnSubmit = document.getElementById("btnSubmitPin");

  errorMsg.classList.add("hidden");
  btnSubmit.disabled = true;
  btnSubmit.innerText = "Memproses...";

  try {
    const res = await fetch(WEB_APP_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "validasiSetoran",
        rowId: pendingActionData.rowId,
        status: pendingActionData.status,
        pin: inputPin
      })
    });

    const result = await res.json();

    if (result.status === "error_pin") {
      errorMsg.classList.remove("hidden");
      return;
    }

    tampilkanToast("Status transaksi berhasil diperbarui!", "sukses");
    tutupModalPin();
    memuatData();
  } catch (err) {
    tampilkanToast("Gagal memvalidasi status: " + err.message, "error");
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.innerText = "Konfirmasi";
  }
}

function bukaModal(url) {
  if (!url || url === "-") return;
  const imgUrl = dapatkanUrlGambar(url);
  document.getElementById("imgModal").src = imgUrl;
  document.getElementById("modalBukti").classList.remove("hidden");
}

function tutupModal() {
  document.getElementById("modalBukti").classList.add("hidden");
}

// ==========================================
// DETEKSI PELUNASAN KAS / DANA SOSIAL
// ==========================================
function cekStatusBulanLunas() {
  const infoEl = document.getElementById("infoSudahLunas");
  const teksEl = document.getElementById("teksSudahLunas");
  const btnSubmit = document.getElementById("btnSubmitMasuk");
  
  if (!infoEl || !teksEl) return;

  const kategori = document.getElementById("masukTipe").value;
  const nama = document.getElementById("masukNamaSelect").value;
  const inputNominal = document.getElementById("masukNominal").value;
  const nominal = Number(inputNominal.replace(/[^0-9]/g, "")) || 0;

  const tahun = (nominal > 100000 && nominal % 100000 === 0)
    ? document.getElementById("masukTahunSelectChips")?.value
    : document.getElementById("masukTahunSelect")?.value;

  const aturStatusTombol = (isLunas) => {
    if (!btnSubmit) return;
    if (isLunas) {
      btnSubmit.disabled = true;
      btnSubmit.classList.add("opacity-50", "cursor-not-allowed", "pointer-events-none");
      btnSubmit.classList.remove("hover:bg-indigo-700");
    } else {
      btnSubmit.disabled = false;
      btnSubmit.classList.remove("opacity-50", "cursor-not-allowed", "pointer-events-none");
      btnSubmit.classList.add("hover:bg-indigo-700");
    }
  };

  if ((kategori !== "Kas Bulanan" && kategori !== "Dana Sosial") || !nama || !tahun) {
    infoEl.classList.add("hidden");
    aturStatusTombol(false);
    return;
  }

  let bulanDipilih = [];
  if (nominal > 100000 && nominal % 100000 === 0 && typeof pilihanBulanForm !== 'undefined') {
    bulanDipilih = pilihanBulanForm;
  } else {
    const valBulan = document.getElementById("masukBulanSelect").value;
    if (valBulan) bulanDipilih = [valBulan];
  }

  if (bulanDipilih.length === 0) {
    infoEl.classList.add("hidden");
    aturStatusTombol(false);
    return;
  }

  const dataLunas = cacheDataMutasi.filter(m => 
    m.arah === "Masuk" &&
    m.tipe === kategori &&
    String(m.tahun) === String(tahun) &&
    m.nama && m.nama.trim().toLowerCase() === nama.trim().toLowerCase()
  );

  let bulanTerdeteksiLunas = [];

  bulanDipilih.forEach(bln => {
    const sudahAda = dataLunas.some(m => 
      m.bulan && m.bulan.toLowerCase().includes(bln.toLowerCase())
    );
    if (sudahAda) bulanTerdeteksiLunas.push(bln);
  });

  if (bulanTerdeteksiLunas.length > 0) {
    teksEl.innerText = `Anggota "${nama}" tercatat SUDAH LUNAS ${kategori} untuk periode: ${bulanTerdeteksiLunas.join(", ")} ${tahun}, pilih periode yang lain.`;
    infoEl.classList.remove("hidden");
    aturStatusTombol(true);
  } else {
    infoEl.classList.add("hidden");
    aturStatusTombol(false);
  }
}