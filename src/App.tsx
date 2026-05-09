import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { auth, db } from './firebase';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, onSnapshot, query, orderBy, limit, doc, getDocFromServer, setDoc, getDoc, runTransaction, where } from 'firebase/firestore';

// Types for Error Handling
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

// ==========================================
// 0. APLIKASI MENGGUNAKAN FIREBASE CDN UNTUK KLASEMEN GLOBAL REAL-TIME
// ==========================================

// ==========================================
// 1. DATA BANK SOAL (SILABUS OSN SD 2026)
// ==========================================
const questionBank = [
  // --- MATEMATIKA ---
  { id: 'm1', subject: 'matematika', category: 'Pecahan', difficulty: 'mudah', text: 'Berapakah hasil dari 3/4 + 2/5?', options: ['23/20', '5/9', '6/20', '1/4'], correct: 0, explanation: 'Samakan penyebut menjadi 20. (15/20) + (8/20) = 23/20.' },
  { id: 'm2', subject: 'matematika', category: 'FPB KPK', difficulty: 'sedang', text: 'KPK dari 12, 15, dan 20 adalah...', options: ['60', '120', '30', '45'], correct: 0, explanation: 'Faktorisasi: 12=2²×3, 15=3×5, 20=2²×5. KPK = 2²×3×5 = 60.' },
  { id: 'm3', subject: 'matematika', category: 'Kecepatan', difficulty: 'sulit', text: 'Andi berangkat pukul 06.15 dengan kecepatan 40 km/jam. Budi menyusul pukul 06.45 dengan kecepatan 60 km/jam. Pukul berapa Budi menyusul Andi?', options: ['07.45', '08.00', '07.15', '08.15'], correct: 0, explanation: 'Selisih waktu 30 menit (0,5 jam). Jarak Andi = 40 × 0,5 = 20 km. Waktu menyusul = Jarak / (V2 - V1) = 20 / (60 - 40) = 1 jam. 06.45 + 1 jam = 07.45.' },
  { id: 'm4', subject: 'matematika', category: 'Bangun Ruang', difficulty: 'sedang', text: 'Sebuah tabung memiliki jari-jari 7 cm dan tinggi 10 cm. Berapakah volumenya? (π = 22/7)', options: ['1540 cm³', '1450 cm³', '154 cm³', '220 cm³'], correct: 0, explanation: 'Volume tabung = π × r² × t = 22/7 × 7 × 7 × 10 = 1540 cm³.' },
  { id: 'm5', subject: 'matematika', category: 'Skala', difficulty: 'mudah', text: 'Jarak kota A dan B pada peta adalah 5 cm. Jika skala peta 1 : 1.200.000, jarak sebenarnya adalah...', options: ['60 km', '600 km', '6 km', '120 km'], correct: 0, explanation: 'Jarak sebenarnya = 5 × 1.200.000 = 6.000.000 cm = 60 km.' },
  { id: 'm6', subject: 'matematika', category: 'Perbandingan', difficulty: 'sedang', text: 'Perbandingan uang Ani dan Ina adalah 3 : 5. Jika jumlah uang mereka Rp 400.000, berapakah selisih uang mereka?', options: ['Rp 100.000', 'Rp 150.000', 'Rp 200.000', 'Rp 50.000'], correct: 0, explanation: 'Selisih rasio = 5 - 3 = 2. Jumlah rasio = 3 + 5 = 8. Selisih uang = (2/8) × 400.000 = 100.000.' },
  { id: 'm7', subject: 'matematika', category: 'Teori Bilangan', difficulty: 'sulit', text: 'Berapakah angka satuan dari 3 pangkat 2026?', options: ['9', '7', '1', '3'], correct: 0, explanation: 'Pola angka satuan 3^n berulang setiap 4 kali: 3, 9, 7, 1. 2026 dibagi 4 bersisa 2. Maka angka satuannya sama dengan 3^2, yaitu 9.' },
  { id: 'm8', subject: 'matematika', category: 'Kombinatorika', difficulty: 'sulit', text: 'Ada 5 orang bersalaman satu sama lain tepat satu kali. Berapa banyak total jabat tangan yang terjadi?', options: ['10', '20', '15', '25'], correct: 0, explanation: 'Gunakan rumus kombinasi C(n,2) = n(n-1)/2. Untuk 5 orang: 5(5-1)/2 = 5(4)/2 = 10 jabat tangan.' },
  { id: 'm9', subject: 'matematika', category: 'Soal Cerita', difficulty: 'sedang', text: 'Umur ayah 4 tahun yang lalu adalah 3 kali umur Budi. Jika umur Budi sekarang 12 tahun, berapa umur Ayah sekarang?', options: ['28 tahun', '32 tahun', '36 tahun', '24 tahun'], correct: 0, explanation: 'Umur Budi 4 tahun lalu = 12 - 4 = 8 tahun. Umur Ayah 4 tahun lalu = 3 × 8 = 24 tahun. Umur Ayah sekarang = 24 + 4 = 28 tahun.' },
  { id: 'm10', subject: 'matematika', category: 'Bangun Datar', difficulty: 'sulit', text: 'Sebuah persegi panjang panjangnya bertambah 20% dan lebarnya berkurang 20%. Bagaimana perubahan luasnya?', options: ['Berkurang 4%', 'Tetap', 'Bertambah 4%', 'Berkurang 20%'], correct: 0, explanation: 'Misal p=10, l=10, Luas awal=100. p baru=12, l baru=8, Luas baru = 12×8 = 96. Jadi luas berkurang 4%.' },
  { id: 'm11', subject: 'matematika', category: 'Aritmetika Sosial', difficulty: 'sedang', text: 'Pedagang membeli baju Rp 150.000 dan ingin untung 20%. Namun ia memberikan diskon 10% kepada pembeli. Berapa harga label yang harus dipasang?', options: ['Rp 200.000', 'Rp 180.000', 'Rp 198.000', 'Rp 165.000'], correct: 0, explanation: 'Harga jual (setelah untung) = 150.000 + 20% = 180.000. Harga label × 90% = 180.000. Harga label = 180.000 / 0.9 = 200.000.' },
  { id: 'm12', subject: 'matematika', category: 'Logika', difficulty: 'sulit', text: 'Di sebuah peternakan terdapat ayam dan kambing. Jumlah kepala ada 30 dan jumlah kaki ada 80. Berapa banyak ayam di peternakan tersebut?', options: ['20 ekor', '10 ekor', '15 ekor', '25 ekor'], correct: 0, explanation: 'Misal ayam=A, kambing=K. A+K=30. 2A+4K=80 (dibagi 2) -> A+2K=40. Kurangi: (A+2K) - (A+K) = 40 - 30 -> K=10. Jika kambing 10, maka ayam = 30-10 = 20 ekor.' },
  { id: 'm13', subject: 'matematika', category: 'Pola Bilangan', difficulty: 'sedang', text: 'Diketahui barisan 2, 6, 12, 20, 30, ... Berapakah suku ke-10 dari barisan tersebut?', options: ['110', '100', '90', '132'], correct: 0, explanation: 'Pola bilangan adalah n(n+1). Suku ke-1 = 1×2, ke-2 = 2×3, dst. Suku ke-10 = 10×11 = 110.' },
  { id: 'm14', subject: 'matematika', category: 'Statistika', difficulty: 'mudah', text: 'Rata-rata nilai 4 siswa adalah 80. Jika nilai Budi dimasukkan, rata-ratanya menjadi 82. Berapakah nilai Budi?', options: ['90', '85', '88', '92'], correct: 0, explanation: 'Total awal = 4 × 80 = 320. Total baru = 5 × 82 = 410. Nilai Budi = 410 - 320 = 90.' },
  { id: 'm15', subject: 'matematika', category: 'Pecahan', difficulty: 'sedang', text: 'Mana di antara pecahan berikut yang nilainya paling besar?', options: ['7/8', '5/6', '8/9', '4/5'], correct: 2, explanation: 'Bisa diubah ke desimal atau samakan penyebut. 7/8=0.875, 5/6=0.833, 8/9=0.888, 4/5=0.8. Nilai terbesar adalah 8/9.' },
  { id: 'm16', subject: 'matematika', category: 'Debit', difficulty: 'sedang', text: 'Air mengalir dengan debit 15 liter/menit. Berapa lama waktu untuk mengisi bak bervolume 900 liter?', options: ['1 jam', '45 menit', '30 menit', '1,5 jam'], correct: 0, explanation: 'Waktu = Volume / Debit = 900 / 15 = 60 menit = 1 jam.' },
  { id: 'm17', subject: 'matematika', category: 'Geometri', difficulty: 'sulit', text: 'Sebuah kubus memiliki luas permukaan 216 cm². Berapakah panjang diagonal ruang kubus tersebut?', options: ['6√3 cm', '6√2 cm', '6 cm', '12 cm'], correct: 0, explanation: 'Luas permukaan = 6 × s² = 216 -> s² = 36 -> s = 6 cm. Diagonal ruang kubus = s√3 = 6√3 cm.' },
  { id: 'm18', subject: 'matematika', category: 'Himpunan', difficulty: 'sedang', text: 'Dari 40 siswa, 25 suka Matematika, 20 suka IPA, dan 5 tidak suka keduanya. Berapa siswa yang suka keduanya?', options: ['10', '5', '15', '20'], correct: 0, explanation: 'Siswa yg suka mapel = 40 - 5 = 35. Yg suka keduanya = (Suka MTK + Suka IPA) - Total Suka Mapel = (25 + 20) - 35 = 45 - 35 = 10 siswa.' },
  { id: 'm19', subject: 'matematika', category: 'Waktu', difficulty: 'mudah', text: 'Jika hari ini adalah hari Rabu, hari apakah 100 hari yang akan datang?', options: ['Jumat', 'Kamis', 'Sabtu', 'Minggu'], correct: 0, explanation: '1 minggu = 7 hari. 100 dibagi 7 sama dengan 14 sisa 2. Dua hari setelah hari Rabu adalah hari Jumat.' },
  { id: 'm20', subject: 'matematika', category: 'Perbandingan Berbalik Nilai', difficulty: 'sulit', text: 'Sebuah pekerjaan dapat diselesaikan 12 orang dalam 20 hari. Jika ingin selesai dalam 15 hari, berapa tambahan pekerja yang diperlukan?', options: ['4 orang', '16 orang', '8 orang', '2 orang'], correct: 0, explanation: 'P1 × W1 = P2 × W2 -> 12 × 20 = P2 × 15 -> 240 = 15P2 -> P2 = 16 orang. Tambahan pekerja = 16 - 12 = 4 orang.' },
  { id: 'm21', subject: 'matematika', category: 'Pecahan', difficulty: 'mudah', text: 'Hasil dari 2/3 × 3/4 adalah...', options: ['1/2', '5/7', '6/12', '2/7'], correct: 0, explanation: '2/3 × 3/4 = 6/12 = 1/2.' },
  { id: 'm22', subject: 'matematika', category: 'FPB KPK', difficulty: 'mudah', text: 'FPB dari 24 dan 36 adalah...', options: ['12', '6', '18', '24'], correct: 0, explanation: 'Faktor terbesar yang sama dari 24 dan 36 adalah 12.' },
  { id: 'm23', subject: 'matematika', category: 'Bangun Datar', difficulty: 'mudah', text: 'Luas persegi dengan sisi 8 cm adalah...', options: ['64 cm²', '32 cm²', '16 cm²', '48 cm²'], correct: 0, explanation: 'Luas persegi = sisi × sisi = 8 × 8 = 64 cm².' },
  { id: 'm24', subject: 'matematika', category: 'Bangun Ruang', difficulty: 'sedang', text: 'Volume kubus dengan panjang sisi 5 cm adalah...', options: ['125 cm³', '25 cm³', '100 cm³', '75 cm³'], correct: 0, explanation: 'Volume kubus = s³ = 5 × 5 × 5 = 125 cm³.' },
  { id: 'm25', subject: 'matematika', category: 'Kecepatan', difficulty: 'mudah', text: 'Sebuah mobil menempuh jarak 120 km dalam 2 jam. Kecepatannya adalah...', options: ['60 km/jam', '40 km/jam', '80 km/jam', '100 km/jam'], correct: 0, explanation: 'Kecepatan = jarak ÷ waktu = 120 ÷ 2 = 60 km/jam.' },
  { id: 'm26', subject: 'matematika', category: 'Debit', difficulty: 'mudah', text: 'Sebuah keran mengalirkan air 10 liter per menit. Berapa air yang keluar dalam 5 menit?', options: ['50 liter', '15 liter', '40 liter', '60 liter'], correct: 0, explanation: 'Volume = debit × waktu = 10 × 5 = 50 liter.' },
  { id: 'm27', subject: 'matematika', category: 'Pola Bilangan', difficulty: 'sedang', text: 'Bilangan berikutnya dari pola 3, 6, 9, 12, ... adalah...', options: ['15', '14', '16', '18'], correct: 0, explanation: 'Pola bertambah 3 setiap langkah.' },
  { id: 'm28', subject: 'matematika', category: 'Statistika', difficulty: 'mudah', text: 'Rata-rata dari 6, 8, 10 adalah...', options: ['8', '7', '9', '10'], correct: 0, explanation: 'Jumlah = 24, lalu dibagi 3 = 8.' },
  { id: 'm29', subject: 'matematika', category: 'Geometri', difficulty: 'sedang', text: 'Keliling persegi panjang dengan panjang 12 cm dan lebar 5 cm adalah...', options: ['34 cm', '60 cm', '24 cm', '17 cm'], correct: 0, explanation: 'Keliling = 2 × (12 + 5) = 34 cm.' },
  { id: 'm30', subject: 'matematika', category: 'Aritmetika Sosial', difficulty: 'sedang', text: 'Harga sebuah buku Rp40.000 mendapat diskon 25%. Harga setelah diskon adalah...', options: ['Rp30.000', 'Rp35.000', 'Rp25.000', 'Rp20.000'], correct: 0, explanation: 'Diskon = 25% × 40.000 = 10.000. Harga akhir = 30.000.' },
  { id: 'm31', subject: 'matematika', category: 'Perbandingan', difficulty: 'mudah', text: 'Perbandingan 8 : 12 dapat disederhanakan menjadi...', options: ['2 : 3', '4 : 5', '3 : 2', '1 : 4'], correct: 0, explanation: '8 dan 12 dibagi 4 menghasilkan 2 : 3.' },
  { id: 'm32', subject: 'matematika', category: 'Bangun Datar', difficulty: 'sedang', text: 'Luas segitiga dengan alas 10 cm dan tinggi 8 cm adalah...', options: ['40 cm²', '80 cm²', '18 cm²', '20 cm²'], correct: 0, explanation: 'Luas segitiga = 1/2 × alas × tinggi = 40 cm².' },
  { id: 'm33', subject: 'matematika', category: 'Pecahan', difficulty: 'sedang', text: 'Hasil dari 5/6 - 1/3 adalah...', options: ['1/2', '2/3', '4/9', '5/9'], correct: 0, explanation: '1/3 = 2/6, maka 5/6 - 2/6 = 3/6 = 1/2.' },
  { id: 'm34', subject: 'matematika', category: 'Waktu', difficulty: 'mudah', text: '2 jam 30 menit sama dengan...', options: ['150 menit', '120 menit', '180 menit', '90 menit'], correct: 0, explanation: '2 jam = 120 menit, ditambah 30 menit menjadi 150 menit.' },
  { id: 'm35', subject: 'matematika', category: 'Bangun Ruang', difficulty: 'sedang', text: 'Jumlah rusuk pada balok adalah...', options: ['12', '8', '6', '10'], correct: 0, explanation: 'Balok memiliki 12 rusuk.' },
  { id: 'm36', subject: 'matematika', category: 'Logika', difficulty: 'sedang', text: 'Jika semua bunga harum dan mawar adalah bunga, maka...', options: ['Mawar harum', 'Mawar tidak harum', 'Semua harum mawar', 'Tidak dapat ditentukan'], correct: 0, explanation: 'Karena mawar termasuk bunga, maka mawar harum.' },
  { id: 'm37', subject: 'matematika', category: 'Kecepatan', difficulty: 'sedang', text: 'Seseorang berjalan dengan kecepatan 5 km/jam selama 3 jam. Jarak yang ditempuh adalah...', options: ['15 km', '10 km', '20 km', '8 km'], correct: 0, explanation: 'Jarak = kecepatan × waktu = 5 × 3 = 15 km.' },
  { id: 'm38', subject: 'matematika', category: 'Pola Bilangan', difficulty: 'sedang', text: 'Bilangan selanjutnya dari pola 2, 4, 8, 16, ... adalah...', options: ['32', '24', '18', '20'], correct: 0, explanation: 'Pola dikali 2 setiap langkah.' },
  { id: 'm39', subject: 'matematika', category: 'Statistika', difficulty: 'mudah', text: 'Nilai terbesar dari data 5, 7, 9, 4, 8 adalah...', options: ['9', '8', '7', '5'], correct: 0, explanation: 'Bilangan terbesar dalam data adalah 9.' },
  { id: 'm40', subject: 'matematika', category: 'Skala', difficulty: 'sedang', text: 'Skala 1 : 500.000 berarti 1 cm di peta mewakili...', options: ['5 km', '50 km', '500 km', '500 m'], correct: 0, explanation: '500.000 cm = 5 km.' },
  { id: 'm41', subject: 'matematika', category: 'Bangun Datar', difficulty: 'mudah', text: 'Keliling persegi dengan sisi 9 cm adalah...', options: ['36 cm', '18 cm', '81 cm', '27 cm'], correct: 0, explanation: 'Keliling persegi = 4 × sisi = 36 cm.' },
  { id: 'm42', subject: 'matematika', category: 'Pecahan', difficulty: 'sedang', text: 'Pecahan 0,75 sama dengan...', options: ['3/4', '1/2', '2/5', '4/5'], correct: 0, explanation: '0,75 = 75/100 = 3/4.' },
  { id: 'm43', subject: 'matematika', category: 'FPB KPK', difficulty: 'sedang', text: 'KPK dari 8 dan 12 adalah...', options: ['24', '12', '48', '6'], correct: 0, explanation: 'Kelipatan persekutuan terkecil dari 8 dan 12 adalah 24.' },
  { id: 'm44', subject: 'matematika', category: 'Bangun Ruang', difficulty: 'mudah', text: 'Bangun ruang yang memiliki alas berbentuk lingkaran adalah...', options: ['Tabung', 'Kubus', 'Balok', 'Prisma'], correct: 0, explanation: 'Tabung memiliki alas dan tutup berbentuk lingkaran.' },
  { id: 'm45', subject: 'matematika', category: 'Aritmetika Sosial', difficulty: 'sedang', text: 'Harga sepatu Rp200.000 mendapat diskon 10%. Harga akhirnya adalah...', options: ['Rp180.000', 'Rp190.000', 'Rp170.000', 'Rp150.000'], correct: 0, explanation: 'Diskon = 20.000, jadi harga akhir = 180.000.' },
  { id: 'm46', subject: 'matematika', category: 'Debit', difficulty: 'sedang', text: 'Sebuah kolam berisi 600 liter air. Jika debit air 20 liter/menit, waktu yang diperlukan untuk mengisi kolam adalah...', options: ['30 menit', '20 menit', '40 menit', '25 menit'], correct: 0, explanation: 'Waktu = volume ÷ debit = 600 ÷ 20 = 30 menit.' },
  { id: 'm47', subject: 'matematika', category: 'Geometri', difficulty: 'sedang', text: 'Sudut siku-siku besarnya adalah...', options: ['90°', '45°', '180°', '60°'], correct: 0, explanation: 'Sudut siku-siku memiliki besar 90 derajat.' },
  { id: 'm48', subject: 'matematika', category: 'Perbandingan', difficulty: 'sedang', text: 'Jika perbandingan laki-laki dan perempuan 2 : 3 dan jumlah siswa 25, maka jumlah perempuan adalah...', options: ['15', '10', '20', '5'], correct: 0, explanation: 'Jumlah rasio = 5. Perempuan = 3/5 × 25 = 15.' },
  { id: 'm49', subject: 'matematika', category: 'Logika', difficulty: 'sulit', text: 'Jika hari ini Senin, maka 10 hari lagi adalah...', options: ['Kamis', 'Rabu', 'Jumat', 'Sabtu'], correct: 0, explanation: '10 ÷ 7 sisa 3. Tiga hari setelah Senin adalah Kamis.' },
  { id: 'm50', subject: 'matematika', category: 'Pola Bilangan', difficulty: 'sedang', text: 'Bilangan berikutnya dari pola 1, 4, 9, 16, ... adalah...', options: ['25', '20', '24', '18'], correct: 0, explanation: 'Pola merupakan kuadrat bilangan: 1², 2², 3², 4², maka berikutnya 5² = 25.' },
  { id: 'm51', subject: 'matematika', category: 'Pecahan', difficulty: 'mudah', text: 'Hasil dari 1/2 + 1/4 adalah...', options: ['3/4', '2/6', '1/6', '1/8'], correct: 0, explanation: '1/2 = 2/4, lalu 2/4 + 1/4 = 3/4.' },
  { id: 'm52', subject: 'matematika', category: 'Bangun Datar', difficulty: 'mudah', text: 'Luas persegi panjang dengan panjang 15 cm dan lebar 4 cm adalah...', options: ['60 cm²', '38 cm²', '30 cm²', '45 cm²'], correct: 0, explanation: 'Luas = panjang × lebar = 15 × 4 = 60 cm².' },
  { id: 'm53', subject: 'matematika', category: 'Kecepatan', difficulty: 'sedang', text: 'Kereta melaju 80 km/jam selama 4 jam. Jarak yang ditempuh adalah...', options: ['320 km', '160 km', '240 km', '400 km'], correct: 0, explanation: 'Jarak = kecepatan × waktu = 80 × 4 = 320 km.' },
  { id: 'm54', subject: 'matematika', category: 'Bangun Ruang', difficulty: 'sedang', text: 'Sebuah balok memiliki panjang 8 cm, lebar 5 cm, dan tinggi 4 cm. Volumenya adalah...', options: ['160 cm³', '120 cm³', '180 cm³', '140 cm³'], correct: 0, explanation: 'Volume balok = p × l × t = 8 × 5 × 4 = 160 cm³.' },
  { id: 'm55', subject: 'matematika', category: 'FPB KPK', difficulty: 'mudah', text: 'FPB dari 18 dan 24 adalah...', options: ['6', '12', '18', '24'], correct: 0, explanation: 'Faktor terbesar yang sama dari 18 dan 24 adalah 6.' },
  { id: 'm56', subject: 'matematika', category: 'Statistika', difficulty: 'mudah', text: 'Median dari data 2, 4, 6, 8, 10 adalah...', options: ['6', '5', '8', '4'], correct: 0, explanation: 'Median adalah nilai tengah, yaitu 6.' },
  { id: 'm57', subject: 'matematika', category: 'Pola Bilangan', difficulty: 'sedang', text: 'Pola 5, 10, 15, 20, ... bertambah sebanyak...', options: ['5', '10', '15', '20'], correct: 0, explanation: 'Setiap bilangan bertambah 5.' },
  { id: 'm58', subject: 'matematika', category: 'Aritmetika Sosial', difficulty: 'sedang', text: 'Sebuah tas dibeli Rp100.000 lalu dijual Rp120.000. Besar keuntungan adalah...', options: ['Rp20.000', 'Rp10.000', 'Rp30.000', 'Rp15.000'], correct: 0, explanation: 'Keuntungan = harga jual - harga beli = 20.000.' },
  { id: 'm59', subject: 'matematika', category: 'Bangun Datar', difficulty: 'sedang', text: 'Keliling lingkaran dengan jari-jari 7 cm adalah... (π = 22/7)', options: ['44 cm', '49 cm', '22 cm', '14 cm'], correct: 0, explanation: 'Keliling = 2 × π × r = 2 × 22/7 × 7 = 44 cm.' },
  { id: 'm60', subject: 'matematika', category: 'Pecahan', difficulty: 'sedang', text: 'Hasil dari 4/5 ÷ 2/5 adalah...', options: ['2', '4', '1/2', '5/2'], correct: 0, explanation: '4/5 ÷ 2/5 = 4/5 × 5/2 = 2.' },
  { id: 'm61', subject: 'matematika', category: 'Perbandingan', difficulty: 'mudah', text: 'Perbandingan 15 : 20 dapat disederhanakan menjadi...', options: ['3 : 4', '5 : 6', '4 : 5', '2 : 3'], correct: 0, explanation: '15 dan 20 dibagi 5 menjadi 3 : 4.' },
  { id: 'm62', subject: 'matematika', category: 'Waktu', difficulty: 'mudah', text: '3 jam 15 menit sama dengan...', options: ['195 menit', '180 menit', '175 menit', '200 menit'], correct: 0, explanation: '3 jam = 180 menit, ditambah 15 menjadi 195 menit.' },
  { id: 'm63', subject: 'matematika', category: 'Bangun Ruang', difficulty: 'sedang', text: 'Jumlah sisi pada kubus adalah...', options: ['6', '8', '12', '10'], correct: 0, explanation: 'Kubus memiliki 6 sisi.' },
  { id: 'm64', subject: 'matematika', category: 'Geometri', difficulty: 'mudah', text: 'Sudut lurus besarnya adalah...', options: ['180°', '90°', '45°', '360°'], correct: 0, explanation: 'Sudut lurus memiliki besar 180 derajat.' },
  { id: 'm65', subject: 'matematika', category: 'Kecepatan', difficulty: 'sedang', text: 'Sepeda motor melaju 45 km/jam selama 2 jam. Jarak yang ditempuh adalah...', options: ['90 km', '80 km', '70 km', '100 km'], correct: 0, explanation: 'Jarak = 45 × 2 = 90 km.' },
  { id: 'm66', subject: 'matematika', category: 'Pecahan', difficulty: 'mudah', text: 'Bentuk desimal dari 1/5 adalah...', options: ['0,2', '0,5', '0,1', '0,25'], correct: 0, explanation: '1 ÷ 5 = 0,2.' },
  { id: 'm67', subject: 'matematika', category: 'Statistika', difficulty: 'sedang', text: 'Modus dari data 3, 4, 4, 5, 6 adalah...', options: ['4', '5', '6', '3'], correct: 0, explanation: 'Modus adalah nilai yang paling sering muncul, yaitu 4.' },
  { id: 'm68', subject: 'matematika', category: 'FPB KPK', difficulty: 'sedang', text: 'KPK dari 6 dan 8 adalah...', options: ['24', '12', '18', '48'], correct: 0, explanation: 'Kelipatan persekutuan terkecil dari 6 dan 8 adalah 24.' },
  { id: 'm69', subject: 'matematika', category: 'Bangun Datar', difficulty: 'sedang', text: 'Luas lingkaran dengan jari-jari 7 cm adalah... (π = 22/7)', options: ['154 cm²', '44 cm²', '77 cm²', '100 cm²'], correct: 0, explanation: 'Luas = π × r² = 22/7 × 49 = 154 cm².' },
  { id: 'm70', subject: 'matematika', category: 'Debit', difficulty: 'sedang', text: 'Debit air 25 liter/menit. Banyak air yang keluar selama 8 menit adalah...', options: ['200 liter', '150 liter', '100 liter', '250 liter'], correct: 0, explanation: 'Volume = debit × waktu = 25 × 8 = 200 liter.' },
  { id: 'm71', subject: 'matematika', category: 'Aritmetika Sosial', difficulty: 'sedang', text: 'Harga beli sebuah sepeda Rp1.500.000 dan dijual Rp1.700.000. Besar keuntungan adalah...', options: ['Rp200.000', 'Rp150.000', 'Rp100.000', 'Rp250.000'], correct: 0, explanation: 'Keuntungan = 1.700.000 - 1.500.000 = 200.000.' },
  { id: 'm72', subject: 'matematika', category: 'Bangun Ruang', difficulty: 'mudah', text: 'Bangun ruang yang memiliki titik puncak satu adalah...', options: ['Kerucut', 'Kubus', 'Balok', 'Tabung'], correct: 0, explanation: 'Kerucut memiliki satu titik puncak.' },
  { id: 'm73', subject: 'matematika', category: 'Pola Bilangan', difficulty: 'sedang', text: 'Bilangan selanjutnya dari pola 10, 20, 30, 40, ... adalah...', options: ['50', '45', '60', '55'], correct: 0, explanation: 'Pola bertambah 10.' },
  { id: 'm74', subject: 'matematika', category: 'Geometri', difficulty: 'mudah', text: 'Segitiga yang memiliki tiga sisi sama panjang disebut...', options: ['Segitiga sama sisi', 'Segitiga siku-siku', 'Segitiga sama kaki', 'Segitiga sembarang'], correct: 0, explanation: 'Segitiga sama sisi memiliki semua sisi sama panjang.' },
  { id: 'm75', subject: 'matematika', category: 'Pecahan', difficulty: 'sedang', text: 'Hasil dari 7/10 + 1/5 adalah...', options: ['9/10', '8/10', '7/15', '1'], correct: 0, explanation: '1/5 = 2/10, lalu 7/10 + 2/10 = 9/10.' },
  { id: 'm76', subject: 'matematika', category: 'Perbandingan', difficulty: 'sedang', text: 'Jika 4 buku seharga Rp20.000, maka harga 1 buku adalah...', options: ['Rp5.000', 'Rp4.000', 'Rp6.000', 'Rp10.000'], correct: 0, explanation: '20.000 ÷ 4 = 5.000.' },
  { id: 'm77', subject: 'matematika', category: 'Waktu', difficulty: 'mudah', text: '1 hari terdiri dari...', options: ['24 jam', '12 jam', '48 jam', '60 jam'], correct: 0, explanation: 'Satu hari memiliki 24 jam.' },
  { id: 'm78', subject: 'matematika', category: 'Bangun Datar', difficulty: 'sedang', text: 'Keliling segitiga dengan sisi 6 cm, 7 cm, dan 8 cm adalah...', options: ['21 cm', '20 cm', '18 cm', '22 cm'], correct: 0, explanation: 'Keliling = 6 + 7 + 8 = 21 cm.' },
  { id: 'm79', subject: 'matematika', category: 'Statistika', difficulty: 'mudah', text: 'Nilai terkecil dari data 9, 5, 7, 3, 8 adalah...', options: ['3', '5', '7', '8'], correct: 0, explanation: 'Bilangan terkecil adalah 3.' },
  { id: 'm80', subject: 'matematika', category: 'Kecepatan', difficulty: 'sedang', text: 'Jarak 150 km ditempuh dalam 3 jam. Kecepatannya adalah...', options: ['50 km/jam', '45 km/jam', '60 km/jam', '40 km/jam'], correct: 0, explanation: 'Kecepatan = 150 ÷ 3 = 50 km/jam.' },
  { id: 'm81', subject: 'matematika', category: 'Pecahan', difficulty: 'mudah', text: 'Pecahan 50% sama dengan...', options: ['1/2', '1/4', '2/5', '3/4'], correct: 0, explanation: '50% = 50/100 = 1/2.' },
  { id: 'm82', subject: 'matematika', category: 'Bangun Ruang', difficulty: 'sedang', text: 'Tabung memiliki ... sisi lengkung.', options: ['1', '2', '3', '4'], correct: 0, explanation: 'Tabung memiliki satu sisi lengkung.' },
  { id: 'm83', subject: 'matematika', category: 'FPB KPK', difficulty: 'sedang', text: 'FPB dari 16 dan 24 adalah...', options: ['8', '4', '12', '16'], correct: 0, explanation: 'Faktor terbesar yang sama adalah 8.' },
  { id: 'm84', subject: 'matematika', category: 'Geometri', difficulty: 'mudah', text: 'Bangun datar yang memiliki 4 sisi sama panjang adalah...', options: ['Persegi', 'Segitiga', 'Trapesium', 'Lingkaran'], correct: 0, explanation: 'Persegi memiliki empat sisi sama panjang.' },
  { id: 'm85', subject: 'matematika', category: 'Aritmetika Sosial', difficulty: 'sedang', text: 'Harga sebuah mainan Rp80.000 mendapat diskon Rp10.000. Harga akhirnya adalah...', options: ['Rp70.000', 'Rp60.000', 'Rp75.000', 'Rp50.000'], correct: 0, explanation: '80.000 - 10.000 = 70.000.' },
  { id: 'm86', subject: 'matematika', category: 'Pola Bilangan', difficulty: 'sedang', text: 'Pola 100, 90, 80, 70, ... berkurang sebanyak...', options: ['10', '20', '5', '15'], correct: 0, explanation: 'Setiap langkah berkurang 10.' },
  { id: 'm87', subject: 'matematika', category: 'Debit', difficulty: 'mudah', text: 'Sebuah ember berisi 120 liter air dan keluar 12 liter per menit. Ember akan kosong dalam...', options: ['10 menit', '12 menit', '8 menit', '15 menit'], correct: 0, explanation: 'Waktu = 120 ÷ 12 = 10 menit.' },
  { id: 'm88', subject: 'matematika', category: 'Bangun Datar', difficulty: 'sedang', text: 'Luas jajargenjang dengan alas 12 cm dan tinggi 5 cm adalah...', options: ['60 cm²', '30 cm²', '24 cm²', '50 cm²'], correct: 0, explanation: 'Luas = alas × tinggi = 12 × 5 = 60 cm².' },
  { id: 'm89', subject: 'matematika', category: 'Perbandingan', difficulty: 'sedang', text: 'Perbandingan umur A dan B adalah 2 : 5. Jika umur A 8 tahun, umur B adalah...', options: ['20 tahun', '16 tahun', '12 tahun', '24 tahun'], correct: 0, explanation: '2 bagian = 8 tahun, maka 1 bagian = 4 tahun. Umur B = 5 × 4 = 20 tahun.' },
  { id: 'm90', subject: 'matematika', category: 'Statistika', difficulty: 'sedang', text: 'Rata-rata dari 10, 20, dan 30 adalah...', options: ['20', '15', '25', '30'], correct: 0, explanation: 'Jumlah = 60, dibagi 3 = 20.' },
  { id: 'm91', subject: 'matematika', category: 'Waktu', difficulty: 'mudah', text: '1 minggu terdiri dari...', options: ['7 hari', '5 hari', '6 hari', '8 hari'], correct: 0, explanation: 'Satu minggu memiliki 7 hari.' },
  { id: 'm92', subject: 'matematika', category: 'Bangun Ruang', difficulty: 'sedang', text: 'Jumlah titik sudut pada balok adalah...', options: ['8', '6', '10', '12'], correct: 0, explanation: 'Balok memiliki 8 titik sudut.' },
  { id: 'm93', subject: 'matematika', category: 'Pecahan', difficulty: 'sedang', text: 'Hasil dari 3/8 + 1/8 adalah...', options: ['1/2', '4/8', '3/16', '2/8'], correct: 0, explanation: '3/8 + 1/8 = 4/8 = 1/2.' },
  { id: 'm94', subject: 'matematika', category: 'Geometri', difficulty: 'sedang', text: 'Jumlah sudut dalam segitiga adalah...', options: ['180°', '90°', '360°', '270°'], correct: 0, explanation: 'Total sudut segitiga adalah 180 derajat.' },
  { id: 'm95', subject: 'matematika', category: 'Kecepatan', difficulty: 'mudah', text: 'Mobil menempuh jarak 90 km dalam 3 jam. Kecepatannya adalah...', options: ['30 km/jam', '20 km/jam', '40 km/jam', '50 km/jam'], correct: 0, explanation: '90 ÷ 3 = 30 km/jam.' },
  { id: 'm96', subject: 'matematika', category: 'Bangun Datar', difficulty: 'mudah', text: 'Bangun datar yang tidak memiliki sudut adalah...', options: ['Lingkaran', 'Persegi', 'Segitiga', 'Trapesium'], correct: 0, explanation: 'Lingkaran tidak memiliki sudut.' },
  { id: 'm97', subject: 'matematika', category: 'Aritmetika Sosial', difficulty: 'sedang', text: 'Harga beli sepeda Rp500.000 lalu dijual Rp450.000. Pedagang mengalami...', options: ['Rugi Rp50.000', 'Untung Rp50.000', 'Untung Rp100.000', 'Rugi Rp100.000'], correct: 0, explanation: 'Kerugian = 500.000 - 450.000 = 50.000.' },
  { id: 'm98', subject: 'matematika', category: 'Pola Bilangan', difficulty: 'sedang', text: 'Bilangan berikutnya dari pola 1, 3, 5, 7, ... adalah...', options: ['9', '8', '10', '11'], correct: 0, explanation: 'Pola bilangan ganjil bertambah 2.' },
  { id: 'm99', subject: 'matematika', category: 'FPB KPK', difficulty: 'mudah', text: 'KPK dari 4 dan 5 adalah...', options: ['20', '10', '15', '5'], correct: 0, explanation: 'Kelipatan persekutuan terkecil dari 4 dan 5 adalah 20.' },
  { id: 'm100', subject: 'matematika', category: 'Logika', difficulty: 'sulit', text: 'Jika semua siswa suka olahraga dan Andi adalah siswa, maka...', options: ['Andi suka olahraga', 'Andi tidak suka olahraga', 'Semua olahraga suka Andi', 'Tidak dapat diketahui'], correct: 0, explanation: 'Karena Andi adalah siswa dan semua siswa suka olahraga, maka Andi suka olahraga.' },
  { id: 'm101', subject: 'matematika', category: 'Pecahan', difficulty: 'sedang', text: 'Hasil dari 5/8 + 1/4 adalah...', options: ['7/8', '6/8', '3/4', '1'], correct: 0, explanation: '1/4 = 2/8, lalu 5/8 + 2/8 = 7/8.' },
  { id: 'm102', subject: 'matematika', category: 'Bangun Datar', difficulty: 'mudah', text: 'Luas persegi panjang dengan panjang 20 cm dan lebar 6 cm adalah...', options: ['120 cm²', '100 cm²', '140 cm²', '80 cm²'], correct: 0, explanation: 'Luas = panjang × lebar = 20 × 6 = 120 cm².' },
  { id: 'm103', subject: 'matematika', category: 'Kecepatan', difficulty: 'sedang', text: 'Sebuah mobil melaju 70 km/jam selama 5 jam. Jarak yang ditempuh adalah...', options: ['350 km', '300 km', '250 km', '400 km'], correct: 0, explanation: 'Jarak = kecepatan × waktu = 70 × 5 = 350 km.' },
  { id: 'm104', subject: 'matematika', category: 'Bangun Ruang', difficulty: 'sedang', text: 'Volume balok dengan panjang 9 cm, lebar 4 cm, dan tinggi 3 cm adalah...', options: ['108 cm³', '96 cm³', '120 cm³', '100 cm³'], correct: 0, explanation: 'Volume = p × l × t = 9 × 4 × 3 = 108 cm³.' },
  { id: 'm105', subject: 'matematika', category: 'FPB KPK', difficulty: 'sedang', text: 'FPB dari 20 dan 30 adalah...', options: ['10', '5', '15', '20'], correct: 0, explanation: 'Faktor terbesar yang sama dari 20 dan 30 adalah 10.' },
  { id: 'm106', subject: 'matematika', category: 'Statistika', difficulty: 'mudah', text: 'Rata-rata dari 4, 8, dan 12 adalah...', options: ['8', '6', '10', '12'], correct: 0, explanation: 'Jumlah = 24, dibagi 3 = 8.' },
  { id: 'm107', subject: 'matematika', category: 'Pola Bilangan', difficulty: 'sedang', text: 'Bilangan berikutnya dari pola 7, 14, 21, 28, ... adalah...', options: ['35', '30', '36', '40'], correct: 0, explanation: 'Pola bertambah 7 setiap langkah.' },
  { id: 'm108', subject: 'matematika', category: 'Aritmetika Sosial', difficulty: 'sedang', text: 'Sebuah barang dibeli Rp250.000 lalu dijual Rp300.000. Besar keuntungan adalah...', options: ['Rp50.000', 'Rp25.000', 'Rp75.000', 'Rp100.000'], correct: 0, explanation: 'Keuntungan = harga jual - harga beli = 300.000 - 250.000 = 50.000.' },
  { id: 'm109', subject: 'matematika', category: 'Bangun Datar', difficulty: 'sedang', text: 'Keliling persegi panjang dengan panjang 14 cm dan lebar 9 cm adalah...', options: ['46 cm', '42 cm', '40 cm', '36 cm'], correct: 0, explanation: 'Keliling = 2 × (14 + 9) = 46 cm.' },
  { id: 'm110', subject: 'matematika', category: 'Pecahan', difficulty: 'mudah', text: 'Bentuk desimal dari 3/10 adalah...', options: ['0,3', '0,03', '3,0', '0,5'], correct: 0, explanation: '3 ÷ 10 = 0,3.' },
  { id: 'm111', subject: 'matematika', category: 'Perbandingan', difficulty: 'sedang', text: 'Perbandingan 18 : 24 dapat disederhanakan menjadi...', options: ['3 : 4', '2 : 3', '4 : 5', '5 : 6'], correct: 0, explanation: '18 dan 24 dibagi 6 menjadi 3 : 4.' },
  { id: 'm112', subject: 'matematika', category: 'Waktu', difficulty: 'mudah', text: '4 jam sama dengan...', options: ['240 menit', '200 menit', '180 menit', '300 menit'], correct: 0, explanation: '4 × 60 = 240 menit.' },
  { id: 'm113', subject: 'matematika', category: 'Bangun Ruang', difficulty: 'mudah', text: 'Kubus memiliki ... titik sudut.', options: ['8', '6', '12', '4'], correct: 0, explanation: 'Kubus memiliki 8 titik sudut.' },
  { id: 'm114', subject: 'matematika', category: 'Geometri', difficulty: 'mudah', text: 'Sudut penuh besarnya adalah...', options: ['360°', '180°', '90°', '270°'], correct: 0, explanation: 'Sudut penuh memiliki besar 360 derajat.' },
  { id: 'm115', subject: 'matematika', category: 'Kecepatan', difficulty: 'mudah', text: 'Sepeda melaju 15 km/jam selama 2 jam. Jarak yang ditempuh adalah...', options: ['30 km', '20 km', '25 km', '35 km'], correct: 0, explanation: 'Jarak = 15 × 2 = 30 km.' },
  { id: 'm116', subject: 'matematika', category: 'Pecahan', difficulty: 'sedang', text: 'Hasil dari 2/7 + 3/7 adalah...', options: ['5/7', '6/7', '1', '4/7'], correct: 0, explanation: 'Karena penyebut sama, jumlahkan pembilang: 2 + 3 = 5.' },
  { id: 'm117', subject: 'matematika', category: 'Statistika', difficulty: 'sedang', text: 'Median dari data 1, 3, 5, 7, 9 adalah...', options: ['5', '3', '7', '6'], correct: 0, explanation: 'Median adalah nilai tengah, yaitu 5.' },
  { id: 'm118', subject: 'matematika', category: 'FPB KPK', difficulty: 'sedang', text: 'KPK dari 9 dan 12 adalah...', options: ['36', '24', '18', '48'], correct: 0, explanation: 'Kelipatan persekutuan terkecil dari 9 dan 12 adalah 36.' },
  { id: 'm119', subject: 'matematika', category: 'Bangun Datar', difficulty: 'sedang', text: 'Luas trapesium dengan jumlah sisi sejajar 16 cm dan tinggi 5 cm adalah...', options: ['40 cm²', '80 cm²', '60 cm²', '45 cm²'], correct: 0, explanation: 'Luas trapesium = 1/2 × jumlah sisi sejajar × tinggi = 1/2 × 16 × 5 = 40 cm².' },
  { id: 'm120', subject: 'matematika', category: 'Debit', difficulty: 'sedang', text: 'Sebuah keran mengalirkan 18 liter air per menit. Banyak air selama 10 menit adalah...', options: ['180 liter', '150 liter', '200 liter', '160 liter'], correct: 0, explanation: 'Volume = debit × waktu = 18 × 10 = 180 liter.' },
  { id: 'm121', subject: 'matematika', category: 'Aritmetika Sosial', difficulty: 'sedang', text: 'Harga sebuah topi Rp60.000 mendapat diskon 20%. Harga akhirnya adalah...', options: ['Rp48.000', 'Rp50.000', 'Rp52.000', 'Rp40.000'], correct: 0, explanation: 'Diskon = 20% × 60.000 = 12.000. Harga akhir = 48.000.' },
  { id: 'm122', subject: 'matematika', category: 'Bangun Ruang', difficulty: 'mudah', text: 'Prisma segitiga memiliki ... sisi.', options: ['5', '6', '7', '8'], correct: 0, explanation: 'Prisma segitiga memiliki 5 sisi.' },
  { id: 'm123', subject: 'matematika', category: 'Pola Bilangan', difficulty: 'sedang', text: 'Bilangan berikutnya dari pola 4, 8, 12, 16, ... adalah...', options: ['20', '18', '24', '22'], correct: 0, explanation: 'Pola bertambah 4 setiap langkah.' },
  { id: 'm124', subject: 'matematika', category: 'Geometri', difficulty: 'mudah', text: 'Bangun datar dengan tiga sisi disebut...', options: ['Segitiga', 'Persegi', 'Lingkaran', 'Trapesium'], correct: 0, explanation: 'Segitiga memiliki tiga sisi.' },
  { id: 'm125', subject: 'matematika', category: 'Pecahan', difficulty: 'sedang', text: 'Hasil dari 9/10 - 2/10 adalah...', options: ['7/10', '6/10', '5/10', '1/10'], correct: 0, explanation: '9/10 - 2/10 = 7/10.' },
  { id: 'm126', subject: 'matematika', category: 'Perbandingan', difficulty: 'sedang', text: 'Jika 5 pensil seharga Rp15.000, maka harga 1 pensil adalah...', options: ['Rp3.000', 'Rp2.000', 'Rp4.000', 'Rp5.000'], correct: 0, explanation: '15.000 ÷ 5 = 3.000.' },
  { id: 'm127', subject: 'matematika', category: 'Waktu', difficulty: 'mudah', text: '30 menit sama dengan...', options: ['1/2 jam', '1 jam', '2 jam', '1/4 jam'], correct: 0, explanation: '30 menit = setengah jam.' },
  { id: 'm128', subject: 'matematika', category: 'Bangun Datar', difficulty: 'sedang', text: 'Luas belah ketupat dengan diagonal 12 cm dan 8 cm adalah...', options: ['48 cm²', '96 cm²', '40 cm²', '56 cm²'], correct: 0, explanation: 'Luas = 1/2 × d1 × d2 = 1/2 × 12 × 8 = 48 cm².' },
  { id: 'm129', subject: 'matematika', category: 'Statistika', difficulty: 'mudah', text: 'Nilai terbesar dari data 12, 15, 9, 20, 17 adalah...', options: ['20', '17', '15', '12'], correct: 0, explanation: 'Bilangan terbesar adalah 20.' },
  { id: 'm130', subject: 'matematika', category: 'Kecepatan', difficulty: 'sedang', text: 'Jarak 240 km ditempuh dalam 4 jam. Kecepatannya adalah...', options: ['60 km/jam', '50 km/jam', '70 km/jam', '80 km/jam'], correct: 0, explanation: 'Kecepatan = 240 ÷ 4 = 60 km/jam.' },
  { id: 'm131', subject: 'matematika', category: 'Pecahan', difficulty: 'mudah', text: '25% sama dengan pecahan...', options: ['1/4', '1/2', '3/4', '2/5'], correct: 0, explanation: '25% = 25/100 = 1/4.' },
  { id: 'm132', subject: 'matematika', category: 'Bangun Ruang', difficulty: 'sedang', text: 'Sebuah kubus memiliki sisi 4 cm. Volumenya adalah...', options: ['64 cm³', '16 cm³', '48 cm³', '32 cm³'], correct: 0, explanation: 'Volume kubus = s³ = 4 × 4 × 4 = 64 cm³.' },
  { id: 'm133', subject: 'matematika', category: 'FPB KPK', difficulty: 'mudah', text: 'FPB dari 14 dan 21 adalah...', options: ['7', '14', '3', '21'], correct: 0, explanation: 'Faktor terbesar yang sama adalah 7.' },
  { id: 'm134', subject: 'matematika', category: 'Geometri', difficulty: 'sedang', text: 'Jumlah sudut pada persegi adalah...', options: ['4', '3', '2', '5'], correct: 0, explanation: 'Persegi memiliki 4 sudut.' },
  { id: 'm135', subject: 'matematika', category: 'Aritmetika Sosial', difficulty: 'sedang', text: 'Harga jual sebuah barang Rp90.000 dan harga belinya Rp75.000. Keuntungan yang diperoleh adalah...', options: ['Rp15.000', 'Rp10.000', 'Rp20.000', 'Rp25.000'], correct: 0, explanation: 'Keuntungan = 90.000 - 75.000 = 15.000.' },
  { id: 'm136', subject: 'matematika', category: 'Pola Bilangan', difficulty: 'sedang', text: 'Pola 2, 5, 8, 11, ... bertambah sebanyak...', options: ['3', '2', '4', '5'], correct: 0, explanation: 'Setiap langkah bertambah 3.' },
  { id: 'm137', subject: 'matematika', category: 'Debit', difficulty: 'mudah', text: 'Debit air 30 liter/menit. Banyak air dalam 4 menit adalah...', options: ['120 liter', '100 liter', '90 liter', '150 liter'], correct: 0, explanation: 'Volume = 30 × 4 = 120 liter.' },
  { id: 'm138', subject: 'matematika', category: 'Bangun Datar', difficulty: 'sedang', text: 'Keliling lingkaran berjari-jari 14 cm adalah... (π = 22/7)', options: ['88 cm', '44 cm', '77 cm', '66 cm'], correct: 0, explanation: 'Keliling = 2 × π × r = 2 × 22/7 × 14 = 88 cm.' },
  { id: 'm139', subject: 'matematika', category: 'Perbandingan', difficulty: 'sedang', text: 'Perbandingan umur C dan D adalah 4 : 7. Jika umur C 12 tahun, umur D adalah...', options: ['21 tahun', '18 tahun', '24 tahun', '28 tahun'], correct: 0, explanation: '4 bagian = 12 tahun, maka 1 bagian = 3 tahun. Umur D = 7 × 3 = 21 tahun.' },
  { id: 'm140', subject: 'matematika', category: 'Statistika', difficulty: 'sedang', text: 'Rata-rata dari 5, 10, 15, dan 20 adalah...', options: ['12,5', '10', '15', '17,5'], correct: 0, explanation: 'Jumlah = 50, dibagi 4 = 12,5.' },
  { id: 'm141', subject: 'matematika', category: 'Waktu', difficulty: 'mudah', text: '2 hari sama dengan...', options: ['48 jam', '24 jam', '36 jam', '72 jam'], correct: 0, explanation: '1 hari = 24 jam, maka 2 hari = 48 jam.' },
  { id: 'm142', subject: 'matematika', category: 'Bangun Ruang', difficulty: 'mudah', text: 'Bangun ruang yang memiliki 6 sisi berbentuk persegi adalah...', options: ['Kubus', 'Balok', 'Tabung', 'Kerucut'], correct: 0, explanation: 'Kubus memiliki 6 sisi berbentuk persegi.' },
  { id: 'm143', subject: 'matematika', category: 'Pecahan', difficulty: 'sedang', text: 'Hasil dari 6/9 disederhanakan menjadi...', options: ['2/3', '3/4', '1/2', '4/5'], correct: 0, explanation: '6 dan 9 dibagi 3 menjadi 2/3.' },
  { id: 'm144', subject: 'matematika', category: 'Geometri', difficulty: 'mudah', text: 'Sudut yang kurang dari 90° disebut...', options: ['Sudut lancip', 'Sudut tumpul', 'Sudut siku-siku', 'Sudut lurus'], correct: 0, explanation: 'Sudut lancip besarnya kurang dari 90 derajat.' },
  { id: 'm145', subject: 'matematika', category: 'Kecepatan', difficulty: 'sedang', text: 'Sebuah bus melaju 55 km/jam selama 6 jam. Jarak yang ditempuh adalah...', options: ['330 km', '300 km', '360 km', '280 km'], correct: 0, explanation: 'Jarak = 55 × 6 = 330 km.' },
  { id: 'm146', subject: 'matematika', category: 'Bangun Datar', difficulty: 'sedang', text: 'Luas persegi dengan sisi 12 cm adalah...', options: ['144 cm²', '120 cm²', '124 cm²', '132 cm²'], correct: 0, explanation: 'Luas = sisi × sisi = 12 × 12 = 144 cm².' },
  { id: 'm147', subject: 'matematika', category: 'Aritmetika Sosial', difficulty: 'mudah', text: 'Harga sebuah buku Rp25.000 dan dibayar dengan Rp50.000. Uang kembaliannya adalah...', options: ['Rp25.000', 'Rp20.000', 'Rp15.000', 'Rp30.000'], correct: 0, explanation: 'Kembalian = 50.000 - 25.000 = 25.000.' },
  { id: 'm148', subject: 'matematika', category: 'Pola Bilangan', difficulty: 'sedang', text: 'Bilangan berikutnya dari pola 11, 22, 33, 44, ... adalah...', options: ['55', '66', '50', '60'], correct: 0, explanation: 'Pola bertambah 11 setiap langkah.' },
  { id: 'm149', subject: 'matematika', category: 'FPB KPK', difficulty: 'sedang', text: 'KPK dari 10 dan 15 adalah...', options: ['30', '20', '25', '15'], correct: 0, explanation: 'Kelipatan persekutuan terkecil dari 10 dan 15 adalah 30.' },
  { id: 'm150', subject: 'matematika', category: 'Logika', difficulty: 'sedang', text: 'Jika semua ikan hidup di air dan lele adalah ikan, maka...', options: ['Lele hidup di air', 'Lele hidup di darat', 'Semua air adalah lele', 'Tidak dapat ditentukan'], correct: 0, explanation: 'Karena lele adalah ikan dan semua ikan hidup di air, maka lele hidup di air.' },
  { id: 'm151', subject: 'matematika', category: 'Pecahan', difficulty: 'sedang', text: 'Hasil dari 3/5 + 2/10 adalah...', options: ['4/5', '5/10', '3/10', '1'], correct: 0, explanation: '3/5 = 6/10, lalu 6/10 + 2/10 = 8/10 = 4/5.' },
  { id: 'm152', subject: 'matematika', category: 'Bangun Datar', difficulty: 'mudah', text: 'Keliling persegi dengan sisi 11 cm adalah...', options: ['44 cm', '22 cm', '33 cm', '55 cm'], correct: 0, explanation: 'Keliling persegi = 4 × sisi = 4 × 11 = 44 cm.' },
  { id: 'm153', subject: 'matematika', category: 'Kecepatan', difficulty: 'sedang', text: 'Mobil melaju dengan kecepatan 90 km/jam selama 2 jam. Jarak yang ditempuh adalah...', options: ['180 km', '160 km', '200 km', '150 km'], correct: 0, explanation: 'Jarak = kecepatan × waktu = 90 × 2 = 180 km.' },
  { id: 'm154', subject: 'matematika', category: 'Bangun Ruang', difficulty: 'sedang', text: 'Volume kubus dengan sisi 6 cm adalah...', options: ['216 cm³', '36 cm³', '144 cm³', '108 cm³'], correct: 0, explanation: 'Volume kubus = s³ = 6 × 6 × 6 = 216 cm³.' },
  { id: 'm155', subject: 'matematika', category: 'FPB KPK', difficulty: 'mudah', text: 'FPB dari 27 dan 36 adalah...', options: ['9', '6', '3', '12'], correct: 0, explanation: 'Faktor terbesar yang sama dari 27 dan 36 adalah 9.' },
  { id: 'm156', subject: 'matematika', category: 'Statistika', difficulty: 'mudah', text: 'Rata-rata dari 7, 9, dan 11 adalah...', options: ['9', '8', '10', '11'], correct: 0, explanation: 'Jumlah = 27, dibagi 3 = 9.' },
  { id: 'm157', subject: 'matematika', category: 'Pola Bilangan', difficulty: 'sedang', text: 'Bilangan berikutnya dari pola 6, 12, 18, 24, ... adalah...', options: ['30', '28', '32', '36'], correct: 0, explanation: 'Pola bertambah 6 setiap langkah.' },
  { id: 'm158', subject: 'matematika', category: 'Aritmetika Sosial', difficulty: 'sedang', text: 'Harga beli sebuah jam Rp80.000 dan dijual Rp95.000. Keuntungan yang diperoleh adalah...', options: ['Rp15.000', 'Rp10.000', 'Rp20.000', 'Rp25.000'], correct: 0, explanation: 'Keuntungan = 95.000 - 80.000 = 15.000.' },
  { id: 'm159', subject: 'matematika', category: 'Bangun Datar', difficulty: 'sedang', text: 'Luas segitiga dengan alas 14 cm dan tinggi 6 cm adalah...', options: ['42 cm²', '84 cm²', '40 cm²', '48 cm²'], correct: 0, explanation: 'Luas = 1/2 × alas × tinggi = 1/2 × 14 × 6 = 42 cm².' },
  { id: 'm160', subject: 'matematika', category: 'Pecahan', difficulty: 'mudah', text: 'Bentuk persen dari 1/2 adalah...', options: ['50%', '25%', '75%', '100%'], correct: 0, explanation: '1/2 = 50/100 = 50%.' },
  { id: 'm161', subject: 'matematika', category: 'Perbandingan', difficulty: 'sedang', text: 'Perbandingan 21 : 28 dapat disederhanakan menjadi...', options: ['3 : 4', '2 : 3', '4 : 5', '5 : 7'], correct: 0, explanation: '21 dan 28 dibagi 7 menjadi 3 : 4.' },
  { id: 'm162', subject: 'matematika', category: 'Waktu', difficulty: 'mudah', text: '5 jam sama dengan...', options: ['300 menit', '250 menit', '200 menit', '350 menit'], correct: 0, explanation: '5 × 60 = 300 menit.' },
  { id: 'm163', subject: 'matematika', category: 'Bangun Ruang', difficulty: 'mudah', text: 'Balok memiliki ... sisi.', options: ['6', '8', '10', '12'], correct: 0, explanation: 'Balok memiliki 6 sisi.' },
  { id: 'm164', subject: 'matematika', category: 'Geometri', difficulty: 'mudah', text: 'Sudut yang besarnya tepat 90° disebut...', options: ['Sudut siku-siku', 'Sudut lancip', 'Sudut tumpul', 'Sudut lurus'], correct: 0, explanation: 'Sudut siku-siku memiliki besar 90 derajat.' },
  { id: 'm165', subject: 'matematika', category: 'Kecepatan', difficulty: 'sedang', text: 'Seorang pelari berlari 12 km dalam 2 jam. Kecepatannya adalah...', options: ['6 km/jam', '5 km/jam', '7 km/jam', '8 km/jam'], correct: 0, explanation: 'Kecepatan = 12 ÷ 2 = 6 km/jam.' },
  { id: 'm166', subject: 'matematika', category: 'Pecahan', difficulty: 'sedang', text: 'Hasil dari 7/12 + 1/12 adalah...', options: ['2/3', '8/12', '3/4', '1/2'], correct: 0, explanation: '7/12 + 1/12 = 8/12 = 2/3.' },
  { id: 'm167', subject: 'matematika', category: 'Statistika', difficulty: 'sedang', text: 'Modus dari data 2, 3, 3, 5, 6 adalah...', options: ['3', '2', '5', '6'], correct: 0, explanation: 'Modus adalah nilai yang paling sering muncul, yaitu 3.' },
  { id: 'm168', subject: 'matematika', category: 'FPB KPK', difficulty: 'sedang', text: 'KPK dari 7 dan 9 adalah...', options: ['63', '56', '49', '72'], correct: 0, explanation: 'Kelipatan persekutuan terkecil dari 7 dan 9 adalah 63.' },
  { id: 'm169', subject: 'matematika', category: 'Bangun Datar', difficulty: 'sedang', text: 'Luas persegi panjang dengan panjang 18 cm dan lebar 7 cm adalah...', options: ['126 cm²', '120 cm²', '130 cm²', '140 cm²'], correct: 0, explanation: 'Luas = 18 × 7 = 126 cm².' },
  { id: 'm170', subject: 'matematika', category: 'Debit', difficulty: 'mudah', text: 'Keran mengalirkan 12 liter air per menit. Banyak air dalam 6 menit adalah...', options: ['72 liter', '60 liter', '84 liter', '96 liter'], correct: 0, explanation: 'Volume = debit × waktu = 12 × 6 = 72 liter.' },
  { id: 'm171', subject: 'matematika', category: 'Aritmetika Sosial', difficulty: 'sedang', text: 'Harga sebuah baju Rp150.000 mendapat diskon Rp30.000. Harga akhirnya adalah...', options: ['Rp120.000', 'Rp110.000', 'Rp100.000', 'Rp130.000'], correct: 0, explanation: '150.000 - 30.000 = 120.000.' },
  { id: 'm172', subject: 'matematika', category: 'Bangun Ruang', difficulty: 'mudah', text: 'Bangun ruang yang memiliki alas lingkaran dan satu titik puncak adalah...', options: ['Kerucut', 'Kubus', 'Balok', 'Prisma'], correct: 0, explanation: 'Kerucut memiliki alas lingkaran dan satu titik puncak.' },
  { id: 'm173', subject: 'matematika', category: 'Pola Bilangan', difficulty: 'sedang', text: 'Bilangan berikutnya dari pola 8, 16, 24, 32, ... adalah...', options: ['40', '36', '48', '42'], correct: 0, explanation: 'Pola bertambah 8 setiap langkah.' },
  { id: 'm174', subject: 'matematika', category: 'Geometri', difficulty: 'mudah', text: 'Segitiga yang memiliki dua sisi sama panjang disebut...', options: ['Segitiga sama kaki', 'Segitiga sama sisi', 'Segitiga siku-siku', 'Segitiga sembarang'], correct: 0, explanation: 'Segitiga sama kaki memiliki dua sisi sama panjang.' },
  { id: 'm175', subject: 'matematika', category: 'Pecahan', difficulty: 'sedang', text: 'Hasil dari 4/9 + 2/9 adalah...', options: ['2/3', '6/9', '5/9', '1/3'], correct: 0, explanation: '4/9 + 2/9 = 6/9 = 2/3.' },
  { id: 'm176', subject: 'matematika', category: 'Perbandingan', difficulty: 'sedang', text: 'Jika 8 apel seharga Rp24.000, maka harga 1 apel adalah...', options: ['Rp3.000', 'Rp2.000', 'Rp4.000', 'Rp5.000'], correct: 0, explanation: '24.000 ÷ 8 = 3.000.' },
  { id: 'm177', subject: 'matematika', category: 'Waktu', difficulty: 'mudah', text: '90 menit sama dengan...', options: ['1,5 jam', '2 jam', '1 jam', '2,5 jam'], correct: 0, explanation: '90 menit = 1 jam 30 menit = 1,5 jam.' },
  { id: 'm178', subject: 'matematika', category: 'Bangun Datar', difficulty: 'sedang', text: 'Keliling persegi panjang dengan panjang 16 cm dan lebar 8 cm adalah...', options: ['48 cm', '40 cm', '52 cm', '56 cm'], correct: 0, explanation: 'Keliling = 2 × (16 + 8) = 48 cm.' },
  { id: 'm179', subject: 'matematika', category: 'Statistika', difficulty: 'mudah', text: 'Nilai terkecil dari data 14, 11, 19, 8, 16 adalah...', options: ['8', '11', '14', '19'], correct: 0, explanation: 'Bilangan terkecil adalah 8.' },
  { id: 'm180', subject: 'matematika', category: 'Kecepatan', difficulty: 'sedang', text: 'Jarak 360 km ditempuh dalam 6 jam. Kecepatannya adalah...', options: ['60 km/jam', '50 km/jam', '70 km/jam', '80 km/jam'], correct: 0, explanation: 'Kecepatan = 360 ÷ 6 = 60 km/jam.' },
  { id: 'm181', subject: 'matematika', category: 'Pecahan', difficulty: 'mudah', text: '75% sama dengan pecahan...', options: ['3/4', '1/2', '1/4', '2/3'], correct: 0, explanation: '75% = 75/100 = 3/4.' },
  { id: 'm182', subject: 'matematika', category: 'Bangun Ruang', difficulty: 'sedang', text: 'Volume balok dengan panjang 10 cm, lebar 3 cm, dan tinggi 5 cm adalah...', options: ['150 cm³', '120 cm³', '180 cm³', '130 cm³'], correct: 0, explanation: 'Volume = 10 × 3 × 5 = 150 cm³.' },
  { id: 'm183', subject: 'matematika', category: 'FPB KPK', difficulty: 'mudah', text: 'FPB dari 32 dan 48 adalah...', options: ['16', '8', '12', '24'], correct: 0, explanation: 'Faktor terbesar yang sama dari 32 dan 48 adalah 16.' },
  { id: 'm184', subject: 'matematika', category: 'Geometri', difficulty: 'mudah', text: 'Bangun datar yang memiliki satu sisi lengkung adalah...', options: ['Lingkaran', 'Persegi', 'Segitiga', 'Jajargenjang'], correct: 0, explanation: 'Lingkaran memiliki satu sisi lengkung.' },
  { id: 'm185', subject: 'matematika', category: 'Aritmetika Sosial', difficulty: 'sedang', text: 'Harga beli tas Rp120.000 lalu dijual Rp100.000. Pedagang mengalami...', options: ['Rugi Rp20.000', 'Untung Rp20.000', 'Rugi Rp10.000', 'Untung Rp10.000'], correct: 0, explanation: 'Kerugian = 120.000 - 100.000 = 20.000.' },
  { id: 'm186', subject: 'matematika', category: 'Pola Bilangan', difficulty: 'sedang', text: 'Pola 50, 45, 40, 35, ... berkurang sebanyak...', options: ['5', '10', '15', '20'], correct: 0, explanation: 'Setiap langkah berkurang 5.' },
  { id: 'm187', subject: 'matematika', category: 'Debit', difficulty: 'mudah', text: 'Sebuah tangki berisi 200 liter air dan keluar 20 liter per menit. Tangki akan kosong dalam...', options: ['10 menit', '8 menit', '12 menit', '15 menit'], correct: 0, explanation: 'Waktu = 200 ÷ 20 = 10 menit.' },
  { id: 'm188', subject: 'matematika', category: 'Bangun Datar', difficulty: 'sedang', text: 'Luas layang-layang dengan diagonal 10 cm dan 14 cm adalah...', options: ['70 cm²', '140 cm²', '60 cm²', '80 cm²'], correct: 0, explanation: 'Luas = 1/2 × d1 × d2 = 1/2 × 10 × 14 = 70 cm².' },
  { id: 'm189', subject: 'matematika', category: 'Perbandingan', difficulty: 'sedang', text: 'Perbandingan umur E dan F adalah 5 : 6. Jika umur E 20 tahun, umur F adalah...', options: ['24 tahun', '25 tahun', '22 tahun', '30 tahun'], correct: 0, explanation: '5 bagian = 20 tahun, maka 1 bagian = 4 tahun. Umur F = 6 × 4 = 24 tahun.' },
  { id: 'm190', subject: 'matematika', category: 'Statistika', difficulty: 'sedang', text: 'Rata-rata dari 6, 12, 18, dan 24 adalah...', options: ['15', '12', '18', '20'], correct: 0, explanation: 'Jumlah = 60, dibagi 4 = 15.' },
  { id: 'm191', subject: 'matematika', category: 'Waktu', difficulty: 'mudah', text: '3 hari sama dengan...', options: ['72 jam', '48 jam', '96 jam', '60 jam'], correct: 0, explanation: '3 × 24 = 72 jam.' },
  { id: 'm192', subject: 'matematika', category: 'Bangun Ruang', difficulty: 'mudah', text: 'Tabung memiliki ... alas berbentuk lingkaran.', options: ['2', '1', '3', '4'], correct: 0, explanation: 'Tabung memiliki 2 alas berbentuk lingkaran.' },
  { id: 'm193', subject: 'matematika', category: 'Pecahan', difficulty: 'sedang', text: 'Hasil dari 5/6 - 2/6 adalah...', options: ['1/2', '3/6', '2/3', '1/3'], correct: 0, explanation: '5/6 - 2/6 = 3/6 = 1/2.' },
  { id: 'm194', subject: 'matematika', category: 'Geometri', difficulty: 'sedang', text: 'Jumlah sisi pada segitiga adalah...', options: ['3', '4', '5', '6'], correct: 0, explanation: 'Segitiga memiliki 3 sisi.' },
  { id: 'm195', subject: 'matematika', category: 'Kecepatan', difficulty: 'mudah', text: 'Motor menempuh jarak 100 km dalam 4 jam. Kecepatannya adalah...', options: ['25 km/jam', '20 km/jam', '30 km/jam', '40 km/jam'], correct: 0, explanation: '100 ÷ 4 = 25 km/jam.' },
  { id: 'm196', subject: 'matematika', category: 'Bangun Datar', difficulty: 'mudah', text: 'Bangun datar yang memiliki empat sisi tetapi tidak semua sama panjang adalah...', options: ['Persegi panjang', 'Lingkaran', 'Segitiga', 'Oval'], correct: 0, explanation: 'Persegi panjang memiliki empat sisi dengan sisi berhadapan sama panjang.' },
  { id: 'm197', subject: 'matematika', category: 'Aritmetika Sosial', difficulty: 'sedang', text: 'Harga sebuah pensil Rp4.000. Jika membeli 5 pensil, total harganya adalah...', options: ['Rp20.000', 'Rp15.000', 'Rp25.000', 'Rp10.000'], correct: 0, explanation: '5 × 4.000 = 20.000.' },
  { id: 'm198', subject: 'matematika', category: 'Pola Bilangan', difficulty: 'sedang', text: 'Bilangan berikutnya dari pola 13, 26, 39, 52, ... adalah...', options: ['65', '60', '70', '78'], correct: 0, explanation: 'Pola bertambah 13 setiap langkah.' },
  { id: 'm199', subject: 'matematika', category: 'FPB KPK', difficulty: 'mudah', text: 'KPK dari 3 dan 7 adalah...', options: ['21', '14', '28', '35'], correct: 0, explanation: 'Kelipatan persekutuan terkecil dari 3 dan 7 adalah 21.' },
  { id: 'm200', subject: 'matematika', category: 'Logika', difficulty: 'sedang', text: 'Jika semua burung memiliki sayap dan elang adalah burung, maka...', options: ['Elang memiliki sayap', 'Elang tidak memiliki sayap', 'Semua sayap adalah elang', 'Tidak dapat diketahui'], correct: 0, explanation: 'Karena elang adalah burung dan semua burung memiliki sayap, maka elang memiliki sayap.' },

  // --- IPA ---
  { id: 'i1', subject: 'ipa', category: 'Makhluk Hidup', difficulty: 'mudah', text: 'Ciri khusus yang dimiliki kelelawar untuk mendeteksi mangsa di malam hari disebut...', options: ['Ekolokasi', 'Mimikri', 'Autotomi', 'Kamuflase'], correct: 0, explanation: 'Ekolokasi adalah kemampuan makhluk hidup menggunakan pantulan suara untuk mengetahui letak benda.' },
  { id: 'i2', subject: 'ipa', category: 'Organ Tubuh Manusia', difficulty: 'sedang', text: 'Enzim ptialin yang berfungsi mengubah amilum menjadi maltosa terdapat di bagian...', options: ['Mulut', 'Lambung', 'Usus Halus', 'Pankreas'], correct: 0, explanation: 'Enzim ptialin (amilase) diproduksi oleh kelenjar ludah di dalam rongga mulut.' },
  { id: 'i3', subject: 'ipa', category: 'Tata Surya', difficulty: 'sulit', text: 'Garis edar tata surya tempat planet-planet mengelilingi matahari disebut...', options: ['Orbit', 'Revolusi', 'Rotasi', 'Ekliptika'], correct: 0, explanation: 'Orbit adalah jalur lintasan benda langit dalam peredarannya mengelilingi benda langit lain yang lebih besar gaya gravitasinya.' },
  { id: 'i4', subject: 'ipa', category: 'Adaptasi', difficulty: 'sedang', text: 'Tumbuhan kantong semar menangkap serangga bertujuan untuk memenuhi kebutuhan nutrisi...', options: ['Nitrogen', 'Oksigen', 'Karbohidrat', 'Kalsium'], correct: 0, explanation: 'Kantong semar hidup di tanah rawa yang miskin nitrogen, sehingga berevolusi menangkap serangga untuk asupan nitrogen.' },
  { id: 'i5', subject: 'ipa', category: 'Listrik', difficulty: 'sulit', text: 'Pada rangkaian paralel, jika salah satu lampu padam, maka lampu yang lain akan...', options: ['Tetap menyala', 'Ikut padam', 'Menyala lebih terang', 'Menyala redup'], correct: 0, explanation: 'Rangkaian paralel memiliki banyak cabang arus, sehingga jika satu cabang terputus, arus tetap mengalir di cabang lain.' },
  { id: 'i6', subject: 'ipa', category: 'Energi', difficulty: 'mudah', text: 'Perubahan energi yang terjadi pada dinamo sepeda adalah...', options: ['Gerak menjadi listrik', 'Listrik menjadi gerak', 'Kimia menjadi gerak', 'Listrik menjadi cahaya'], correct: 0, explanation: 'Putaran roda sepeda memutar dinamo (energi gerak) yang kemudian menghasilkan energi listrik untuk menyalakan lampu.' },
  { id: 'i7', subject: 'ipa', category: 'Botani', difficulty: 'sulit', text: 'Bagian pada daun yang berfungsi sebagai tempat utama berlangsungnya fotosintesis adalah...', options: ['Jaringan Palisade', 'Jaringan Bunga Karang', 'Stomata', 'Epidermis'], correct: 0, explanation: 'Jaringan palisade (tiang) mengandung paling banyak kloroplas sehingga menjadi tempat utama fotosintesis.' },
  { id: 'i8', subject: 'ipa', category: 'Zoologi', difficulty: 'sedang', text: 'Hewan ovovivipar berkembang biak dengan cara...', options: ['Bertelur dan melahirkan', 'Bertelur', 'Melahirkan', 'Membelah diri'], correct: 0, explanation: 'Ovovivipar adalah perkembangbiakan dengan cara bertelur dan menetas di dalam tubuh induknya, lalu dikeluarkan seperti melahirkan. Contoh: Hiu, Ular Boa.' },
  { id: 'i9', subject: 'ipa', category: 'Fisika (Kalor)', difficulty: 'mudah', text: 'Perpindahan panas melalui zat perantara tanpa disertai perpindahan partikel zat tersebut disebut...', options: ['Konduksi', 'Konveksi', 'Radiasi', 'Isolasi'], correct: 0, explanation: 'Konduksi terjadi pada benda padat, misal sendok besi yang menjadi panas saat dimasukkan ke air panas.' },
  { id: 'i10', subject: 'ipa', category: 'Anatomi', difficulty: 'sulit', text: 'Pembuluh darah yang mengalirkan darah bersih (kaya oksigen) dari paru-paru kembali ke jantung adalah...', options: ['Vena Pulmonalis', 'Arteri Pulmonalis', 'Aorta', 'Vena Cava'], correct: 0, explanation: 'Vena pulmonalis adalah satu-satunya vena yang membawa darah kaya oksigen dari paru-paru menuju serambi kiri jantung.' },
  { id: 'i11', subject: 'ipa', category: 'Ekosistem', difficulty: 'sedang', text: 'Hubungan antara anggrek dan pohon inangnya merupakan contoh simbiosis...', options: ['Komensalisme', 'Mutualisme', 'Parasitisme', 'Amensalisme'], correct: 0, explanation: 'Anggrek diuntungkan karena mendapat tempat tinggi untuk cahaya, sementara pohon inang tidak dirugikan maupun diuntungkan.' },
  { id: 'i12', subject: 'ipa', category: 'Bumi dan Alam Semesta', difficulty: 'sulit', text: 'Peristiwa pasang surut air laut paling tinggi (pasang purnama) terjadi saat fase bulan...', options: ['Purnama dan Bulan Baru', 'Bulan Sabit', 'Bulan Separuh', 'Kuartal Pertama'], correct: 0, explanation: 'Saat bulan baru dan purnama, posisi Bumi, Bulan, dan Matahari berada dalam satu garis lurus, sehingga gaya gravitasi gabungannya maksimal.' },
  { id: 'i13', subject: 'ipa', category: 'Kimia Dasar', difficulty: 'sedang', text: 'Perubahan kapur barus yang diletakkan di lemari pakaian menjadi gas disebut peristiwa...', options: ['Menyublim', 'Mengkristal', 'Menguap', 'Mencair'], correct: 0, explanation: 'Menyublim adalah perubahan wujud dari zat padat langsung menjadi gas tanpa melalui fase cair.' },
  { id: 'i14', subject: 'ipa', category: 'Gaya dan Gerak', difficulty: 'mudah', text: 'Gaya yang bekerja saat kita mengerem sepeda adalah...', options: ['Gaya Gesek', 'Gaya Gravitasi', 'Gaya Magnet', 'Gaya Pegas'], correct: 0, explanation: 'Kampas rem bergesekan dengan velg/cakram roda sehingga menghasilkan gaya gesek yang melawan arah gerak sepeda.' },
  { id: 'i15', subject: 'ipa', category: 'Sistem Pernapasan', difficulty: 'sedang', text: 'Tempat terjadinya pertukaran oksigen dan karbon dioksida di dalam paru-paru adalah...', options: ['Alveolus', 'Bronkus', 'Trakea', 'Bronkiolus'], correct: 0, explanation: 'Alveolus berupa gelembung-gelembung udara tipis yang dikelilingi pembuluh darah kapiler untuk difusi gas.' },
  { id: 'i16', subject: 'ipa', category: 'Cahaya', difficulty: 'sulit', text: 'Terbentuknya pelangi setelah hujan merupakan contoh peristiwa...', options: ['Dispersi cahaya', 'Refleksi cahaya', 'Interferensi cahaya', 'Difraksi cahaya'], correct: 0, explanation: 'Dispersi (penguraian) cahaya terjadi saat cahaya putih matahari dibiaskan oleh titik-titik air hujan menjadi berbagai warna.' },
  { id: 'i17', subject: 'ipa', category: 'Pelestarian', difficulty: 'mudah', text: 'Pelestarian badak bercula satu di Ujung Kulon merupakan contoh pelestarian secara...', options: ['In situ', 'Ex situ', 'Buatan', 'Hibridisasi'], correct: 0, explanation: 'In situ adalah pelestarian flora/fauna di dalam habitat aslinya. Ex situ adalah di luar habitat aslinya (spt Kebun Binatang).' },
  { id: 'i18', subject: 'ipa', category: 'Bunyi', difficulty: 'sedang', text: 'Bunyi pantul yang terdengar setelah bunyi asli selesai diucapkan, seperti saat berteriak di tebing disebut...', options: ['Gema', 'Gaung', 'Kerdam', 'Desah'], correct: 0, explanation: 'Gema terjadi karena jarak sumber bunyi dan dinding pemantul cukup jauh, sehingga pantulan terdengar jelas setelah bunyi asli.' },
  { id: 'i19', subject: 'ipa', category: 'Botani (Akar)', difficulty: 'sulit', text: 'Tanaman bakau memiliki akar napas yang tumbuh ke atas permukaan lumpur. Adaptasi ini bertujuan untuk...', options: ['Mengambil oksigen', 'Menyimpan air', 'Menyerap garam', 'Memperkuat batang'], correct: 0, explanation: 'Lumpur rawa sangat miskin oksigen. Akar napas (pneumatofora) muncul ke atas untuk menyerap oksigen dari udara.' },
  { id: 'i20', subject: 'ipa', category: 'Sistem Pencernaan', difficulty: 'sedang', text: 'Gerakan meremas-remas yang dilakukan dinding kerongkongan untuk mendorong makanan ke lambung disebut...', options: ['Gerak Peristaltik', 'Gerak Refleks', 'Gerak Otomatis', 'Gerak Mekanik'], correct: 0, explanation: 'Gerak peristaltik adalah kontraksi otot-otot polos pada saluran pencernaan yang mendorong makanan ke bawah.' },
  { id: 'i21', subject: 'ipa', category: 'Makhluk Hidup', difficulty: 'mudah', text: 'Hewan yang mengalami metamorfosis sempurna adalah...', options: ['Kupu-kupu', 'Belalang', 'Kecoak', 'Capung'], correct: 0, explanation: 'Kupu-kupu mengalami tahap telur, larva, pupa, dan imago sehingga disebut metamorfosis sempurna.' },
  { id: 'i22', subject: 'ipa', category: 'Energi', difficulty: 'mudah', text: 'Sumber energi utama bagi kehidupan di Bumi adalah...', options: ['Matahari', 'Angin', 'Air', 'Batu bara'], correct: 0, explanation: 'Matahari merupakan sumber energi utama bagi makhluk hidup di Bumi.' },
  { id: 'i23', subject: 'ipa', category: 'Tata Surya', difficulty: 'sedang', text: 'Planet yang dikenal sebagai Planet Merah adalah...', options: ['Mars', 'Venus', 'Jupiter', 'Merkurius'], correct: 0, explanation: 'Mars disebut Planet Merah karena permukaannya mengandung banyak besi oksida.' },
  { id: 'i24', subject: 'ipa', category: 'Organ Tubuh Manusia', difficulty: 'mudah', text: 'Organ tubuh manusia yang berfungsi memompa darah adalah...', options: ['Jantung', 'Paru-paru', 'Ginjal', 'Hati'], correct: 0, explanation: 'Jantung bertugas memompa darah ke seluruh tubuh.' },
  { id: 'i25', subject: 'ipa', category: 'Ekosistem', difficulty: 'sedang', text: 'Makhluk hidup yang mampu membuat makanan sendiri disebut...', options: ['Produsen', 'Konsumen', 'Pengurai', 'Predator'], correct: 0, explanation: 'Produsen seperti tumbuhan hijau dapat membuat makanan sendiri melalui fotosintesis.' },
  { id: 'i26', subject: 'ipa', category: 'Gaya dan Gerak', difficulty: 'mudah', text: 'Gaya yang menyebabkan benda jatuh ke bawah adalah...', options: ['Gaya gravitasi', 'Gaya magnet', 'Gaya otot', 'Gaya listrik'], correct: 0, explanation: 'Gaya gravitasi bumi menarik benda ke arah pusat bumi.' },
  { id: 'i27', subject: 'ipa', category: 'Perubahan Wujud', difficulty: 'mudah', text: 'Perubahan air menjadi es disebut...', options: ['Membeku', 'Menguap', 'Mencair', 'Menyublim'], correct: 0, explanation: 'Membeku adalah perubahan wujud cair menjadi padat.' },
  { id: 'i28', subject: 'ipa', category: 'Pelestarian Lingkungan', difficulty: 'mudah', text: 'Kegiatan menanam kembali hutan yang gundul disebut...', options: ['Reboisasi', 'Urbanisasi', 'Eksploitasi', 'Evaporasi'], correct: 0, explanation: 'Reboisasi adalah penanaman kembali hutan yang rusak.' },
  { id: 'i29', subject: 'ipa', category: 'Listrik', difficulty: 'sedang', text: 'Benda yang dapat menghantarkan arus listrik dengan baik disebut...', options: ['Konduktor', 'Isolator', 'Semikonduktor', 'Resistor'], correct: 0, explanation: 'Konduktor seperti tembaga dapat menghantarkan listrik dengan baik.' },
  { id: 'i30', subject: 'ipa', category: 'Bunyi', difficulty: 'mudah', text: 'Bunyi dapat merambat melalui...', options: ['Zat padat, cair, dan gas', 'Ruang hampa', 'Cahaya', 'Vakum saja'], correct: 0, explanation: 'Bunyi memerlukan medium untuk merambat.' },
  { id: 'i31', subject: 'ipa', category: 'Makhluk Hidup', difficulty: 'sedang', text: 'Hewan yang aktif pada malam hari disebut...', options: ['Nokturnal', 'Diurnal', 'Herbivora', 'Omnivora'], correct: 0, explanation: 'Hewan nokturnal aktif mencari makan pada malam hari.' },
  { id: 'i32', subject: 'ipa', category: 'Fotosintesis', difficulty: 'sedang', text: 'Gas yang dibutuhkan tumbuhan untuk fotosintesis adalah...', options: ['Karbon dioksida', 'Oksigen', 'Nitrogen', 'Hidrogen'], correct: 0, explanation: 'Tumbuhan membutuhkan karbon dioksida untuk proses fotosintesis.' },
  { id: 'i33', subject: 'ipa', category: 'Tata Surya', difficulty: 'mudah', text: 'Planet terbesar di tata surya adalah...', options: ['Jupiter', 'Saturnus', 'Mars', 'Venus'], correct: 0, explanation: 'Jupiter adalah planet terbesar di tata surya.' },
  { id: 'i34', subject: 'ipa', category: 'Organ Tubuh Manusia', difficulty: 'sedang', text: 'Ginjal berfungsi untuk...', options: ['Menyaring darah', 'Memompa darah', 'Mencerna makanan', 'Mengatur napas'], correct: 0, explanation: 'Ginjal menyaring zat sisa dalam darah menjadi urine.' },
  { id: 'i35', subject: 'ipa', category: 'Ekosistem', difficulty: 'mudah', text: 'Jamur dan bakteri dalam ekosistem berperan sebagai...', options: ['Pengurai', 'Produsen', 'Konsumen', 'Predator'], correct: 0, explanation: 'Pengurai menguraikan sisa makhluk hidup yang telah mati.' },
  { id: 'i36', subject: 'ipa', category: 'Energi', difficulty: 'sedang', text: 'Perubahan energi pada kipas angin adalah...', options: ['Listrik menjadi gerak', 'Gerak menjadi panas', 'Kimia menjadi listrik', 'Cahaya menjadi listrik'], correct: 0, explanation: 'Kipas angin mengubah energi listrik menjadi energi gerak.' },
  { id: 'i37', subject: 'ipa', category: 'Gaya dan Gerak', difficulty: 'sedang', text: 'Semakin kasar permukaan benda, gaya gesek akan...', options: ['Semakin besar', 'Semakin kecil', 'Tetap', 'Hilang'], correct: 0, explanation: 'Permukaan kasar meningkatkan gaya gesek.' },
  { id: 'i38', subject: 'ipa', category: 'Cahaya', difficulty: 'mudah', text: 'Benda yang dapat memantulkan cahaya dengan baik adalah...', options: ['Cermin', 'Kertas', 'Kayu', 'Kain'], correct: 0, explanation: 'Cermin memantulkan cahaya dengan sangat baik.' },
  { id: 'i39', subject: 'ipa', category: 'Sistem Pernapasan', difficulty: 'mudah', text: 'Udara masuk ke tubuh manusia melalui...', options: ['Hidung', 'Lambung', 'Kulit', 'Jantung'], correct: 0, explanation: 'Hidung adalah organ utama tempat masuknya udara.' },
  { id: 'i40', subject: 'ipa', category: 'Perubahan Wujud', difficulty: 'sedang', text: 'Perubahan es menjadi air disebut...', options: ['Mencair', 'Menguap', 'Membeku', 'Menyublim'], correct: 0, explanation: 'Mencair adalah perubahan wujud padat menjadi cair.' },
  { id: 'i41', subject: 'ipa', category: 'Adaptasi', difficulty: 'sedang', text: 'Bebek memiliki kaki berselaput untuk...', options: ['Membantu berenang', 'Melindungi tubuh', 'Menarik mangsa', 'Menyimpan makanan'], correct: 0, explanation: 'Kaki berselaput membantu bebek berenang lebih cepat.' },
  { id: 'i42', subject: 'ipa', category: 'Pelestarian Lingkungan', difficulty: 'mudah', text: 'Sampah plastik sebaiknya...', options: ['Didaur ulang', 'Dibuang ke sungai', 'Dibakar sembarangan', 'Ditimbun di jalan'], correct: 0, explanation: 'Plastik lebih baik didaur ulang agar tidak mencemari lingkungan.' },
  { id: 'i43', subject: 'ipa', category: 'Listrik', difficulty: 'sedang', text: 'Alat untuk mengukur kuat arus listrik adalah...', options: ['Amperemeter', 'Voltmeter', 'Termometer', 'Barometer'], correct: 0, explanation: 'Amperemeter digunakan untuk mengukur kuat arus listrik.' },
  { id: 'i44', subject: 'ipa', category: 'Bunyi', difficulty: 'sedang', text: 'Benda yang bergetar akan menghasilkan...', options: ['Bunyi', 'Cahaya', 'Listrik', 'Panas'], correct: 0, explanation: 'Bunyi berasal dari benda yang bergetar.' },
  { id: 'i45', subject: 'ipa', category: 'Tata Surya', difficulty: 'sedang', text: 'Planet yang memiliki cincin paling jelas adalah...', options: ['Saturnus', 'Jupiter', 'Mars', 'Venus'], correct: 0, explanation: 'Saturnus terkenal dengan cincin yang sangat jelas.' },
  { id: 'i46', subject: 'ipa', category: 'Makhluk Hidup', difficulty: 'mudah', text: 'Hewan pemakan tumbuhan disebut...', options: ['Herbivora', 'Karnivora', 'Omnivora', 'Insektivora'], correct: 0, explanation: 'Herbivora adalah hewan pemakan tumbuhan.' },
  { id: 'i47', subject: 'ipa', category: 'Energi', difficulty: 'sedang', text: 'Panel surya mengubah energi cahaya menjadi energi...', options: ['Listrik', 'Kimia', 'Gerak', 'Panas'], correct: 0, explanation: 'Panel surya menghasilkan listrik dari cahaya matahari.' },
  { id: 'i48', subject: 'ipa', category: 'Ekosistem', difficulty: 'sedang', text: 'Urutan rantai makanan yang benar adalah...', options: ['Rumput → Kambing → Harimau', 'Harimau → Rumput → Kambing', 'Kambing → Rumput → Harimau', 'Rumput → Harimau → Kambing'], correct: 0, explanation: 'Produsen dimakan herbivora lalu dimakan karnivora.' },
  { id: 'i49', subject: 'ipa', category: 'Cahaya', difficulty: 'sedang', text: 'Pensil terlihat bengkok di dalam air karena peristiwa...', options: ['Pembiasan', 'Pemantulan', 'Difraksi', 'Radiasi'], correct: 0, explanation: 'Pembiasan terjadi karena cahaya melewati dua medium berbeda.' },
  { id: 'i50', subject: 'ipa', category: 'Sistem Pencernaan', difficulty: 'mudah', text: 'Organ tempat penyerapan sari-sari makanan adalah...', options: ['Usus halus', 'Lambung', 'Mulut', 'Kerongkongan'], correct: 0, explanation: 'Usus halus menyerap sari makanan ke dalam darah.' },
  { id: 'i51', subject: 'ipa', category: 'Makhluk Hidup', difficulty: 'sedang', text: 'Hewan pemakan daging disebut...', options: ['Karnivora', 'Herbivora', 'Omnivora', 'Detritivora'], correct: 0, explanation: 'Karnivora adalah hewan yang memakan daging.' },
  { id: 'i52', subject: 'ipa', category: 'Energi', difficulty: 'mudah', text: 'Baterai menyimpan energi dalam bentuk...', options: ['Kimia', 'Gerak', 'Cahaya', 'Panas'], correct: 0, explanation: 'Baterai menyimpan energi kimia yang dapat diubah menjadi listrik.' },
  { id: 'i53', subject: 'ipa', category: 'Organ Tubuh Manusia', difficulty: 'sedang', text: 'Tulang yang melindungi otak manusia adalah...', options: ['Tulang tengkorak', 'Tulang rusuk', 'Tulang belakang', 'Tulang paha'], correct: 0, explanation: 'Tulang tengkorak berfungsi melindungi otak.' },
  { id: 'i54', subject: 'ipa', category: 'Ekosistem', difficulty: 'mudah', text: 'Tumbuhan hijau disebut produsen karena...', options: ['Dapat membuat makanan sendiri', 'Memakan hewan lain', 'Menghasilkan bunyi', 'Bergerak aktif'], correct: 0, explanation: 'Tumbuhan membuat makanan sendiri melalui fotosintesis.' },
  { id: 'i55', subject: 'ipa', category: 'Tata Surya', difficulty: 'mudah', text: 'Bumi melakukan perputaran pada porosnya yang disebut...', options: ['Rotasi', 'Revolusi', 'Orbit', 'Gravitasi'], correct: 0, explanation: 'Rotasi adalah perputaran Bumi pada porosnya.' },
  { id: 'i56', subject: 'ipa', category: 'Perubahan Wujud', difficulty: 'sedang', text: 'Perubahan air menjadi uap air disebut...', options: ['Menguap', 'Membeku', 'Mencair', 'Mengkristal'], correct: 0, explanation: 'Menguap adalah perubahan zat cair menjadi gas.' },
  { id: 'i57', subject: 'ipa', category: 'Listrik', difficulty: 'mudah', text: 'Sumber energi listrik utama di rumah adalah...', options: ['PLN', 'Baterai', 'Aki', 'Dinamo'], correct: 0, explanation: 'Listrik rumah tangga umumnya berasal dari PLN.' },
  { id: 'i58', subject: 'ipa', category: 'Bunyi', difficulty: 'sedang', text: 'Bunyi tidak dapat merambat di...', options: ['Ruang hampa', 'Air', 'Udara', 'Kayu'], correct: 0, explanation: 'Bunyi membutuhkan medium untuk merambat.' },
  { id: 'i59', subject: 'ipa', category: 'Cahaya', difficulty: 'mudah', text: 'Cahaya matahari termasuk sumber cahaya...', options: ['Alami', 'Buatan', 'Pantulan', 'Buatan manusia'], correct: 0, explanation: 'Matahari merupakan sumber cahaya alami.' },
  { id: 'i60', subject: 'ipa', category: 'Gaya dan Gerak', difficulty: 'sedang', text: 'Magnet dapat menarik benda yang terbuat dari...', options: ['Besi', 'Kayu', 'Karet', 'Plastik'], correct: 0, explanation: 'Besi termasuk benda yang dapat ditarik magnet.' },
  { id: 'i61', subject: 'ipa', category: 'Sistem Pernapasan', difficulty: 'mudah', text: 'Organ pernapasan ikan adalah...', options: ['Insang', 'Paru-paru', 'Kulit', 'Trakea'], correct: 0, explanation: 'Ikan bernapas menggunakan insang.' },
  { id: 'i62', subject: 'ipa', category: 'Pelestarian Lingkungan', difficulty: 'mudah', text: 'Menghemat penggunaan air bertujuan untuk...', options: ['Menjaga ketersediaan air', 'Menghabiskan energi', 'Mempercepat banjir', 'Mengurangi udara'], correct: 0, explanation: 'Menghemat air membantu menjaga persediaan air bersih.' },
  { id: 'i63', subject: 'ipa', category: 'Makhluk Hidup', difficulty: 'sedang', text: 'Hewan yang memakan tumbuhan dan daging disebut...', options: ['Omnivora', 'Herbivora', 'Karnivora', 'Insektivora'], correct: 0, explanation: 'Omnivora memakan tumbuhan dan hewan.' },
  { id: 'i64', subject: 'ipa', category: 'Fotosintesis', difficulty: 'sedang', text: 'Zat hijau daun yang membantu proses fotosintesis disebut...', options: ['Klorofil', 'Hemoglobin', 'Protein', 'Karoten'], correct: 0, explanation: 'Klorofil membantu tumbuhan menangkap cahaya matahari.' },
  { id: 'i65', subject: 'ipa', category: 'Tata Surya', difficulty: 'sedang', text: 'Bulan mengelilingi...', options: ['Bumi', 'Mars', 'Venus', 'Matahari'], correct: 0, explanation: 'Bulan adalah satelit alami Bumi.' },
  { id: 'i66', subject: 'ipa', category: 'Energi', difficulty: 'sedang', text: 'Kompor gas mengubah energi kimia menjadi energi...', options: ['Panas', 'Gerak', 'Cahaya', 'Bunyi'], correct: 0, explanation: 'Pembakaran gas menghasilkan energi panas.' },
  { id: 'i67', subject: 'ipa', category: 'Perubahan Wujud', difficulty: 'mudah', text: 'Perubahan uap air menjadi air disebut...', options: ['Mengembun', 'Menguap', 'Mencair', 'Menyublim'], correct: 0, explanation: 'Mengembun adalah perubahan gas menjadi cair.' },
  { id: 'i68', subject: 'ipa', category: 'Ekosistem', difficulty: 'sedang', text: 'Semua makhluk hidup dan lingkungan tempat tinggalnya disebut...', options: ['Ekosistem', 'Habitat', 'Komunitas', 'Populasi'], correct: 0, explanation: 'Ekosistem terdiri dari makhluk hidup dan lingkungannya.' },
  { id: 'i69', subject: 'ipa', category: 'Listrik', difficulty: 'sedang', text: 'Saklar berfungsi untuk...', options: ['Menyambung dan memutus arus listrik', 'Menghasilkan listrik', 'Mengukur arus', 'Menyimpan listrik'], correct: 0, explanation: 'Saklar digunakan untuk menghubungkan atau memutus arus listrik.' },
  { id: 'i70', subject: 'ipa', category: 'Gaya dan Gerak', difficulty: 'mudah', text: 'Gaya dapat mengubah...', options: ['Bentuk dan gerak benda', 'Warna benda saja', 'Ukuran benda saja', 'Massa benda'], correct: 0, explanation: 'Gaya dapat mengubah bentuk maupun gerak benda.' },
  { id: 'i71', subject: 'ipa', category: 'Sistem Pencernaan', difficulty: 'sedang', text: 'Lambung berfungsi untuk...', options: ['Mencerna makanan', 'Memompa darah', 'Menyaring darah', 'Mengatur suhu tubuh'], correct: 0, explanation: 'Lambung membantu mencerna makanan secara mekanik dan kimiawi.' },
  { id: 'i72', subject: 'ipa', category: 'Cahaya', difficulty: 'sedang', text: 'Bayangan terbentuk karena cahaya...', options: ['Merambat lurus', 'Dapat dibelokkan', 'Dapat dipantulkan', 'Dapat diuraikan'], correct: 0, explanation: 'Cahaya merambat lurus sehingga terbentuk bayangan.' },
  { id: 'i73', subject: 'ipa', category: 'Bunyi', difficulty: 'mudah', text: 'Alat musik gitar menghasilkan bunyi dari...', options: ['Getaran senar', 'Tiupan udara', 'Pukulan kayu', 'Gesekan logam'], correct: 0, explanation: 'Senar gitar yang bergetar menghasilkan bunyi.' },
  { id: 'i74', subject: 'ipa', category: 'Makhluk Hidup', difficulty: 'sedang', text: 'Proses tumbuhan membuat makanan disebut...', options: ['Fotosintesis', 'Respirasi', 'Adaptasi', 'Evaporasi'], correct: 0, explanation: 'Fotosintesis adalah proses tumbuhan membuat makanan.' },
  { id: 'i75', subject: 'ipa', category: 'Pelestarian Lingkungan', difficulty: 'mudah', text: 'Membuang sampah pada tempatnya dapat menjaga...', options: ['Kebersihan lingkungan', 'Polusi udara', 'Banjir', 'Kerusakan tanah'], correct: 0, explanation: 'Membuang sampah pada tempatnya menjaga lingkungan tetap bersih.' },
  { id: 'i76', subject: 'ipa', category: 'Tata Surya', difficulty: 'mudah', text: 'Planet tempat manusia tinggal adalah...', options: ['Bumi', 'Mars', 'Venus', 'Saturnus'], correct: 0, explanation: 'Manusia hidup di planet Bumi.' },
  { id: 'i77', subject: 'ipa', category: 'Energi', difficulty: 'sedang', text: 'Kincir angin memanfaatkan energi...', options: ['Angin', 'Air', 'Kimia', 'Panas bumi'], correct: 0, explanation: 'Kincir angin menggunakan energi angin untuk bergerak.' },
  { id: 'i78', subject: 'ipa', category: 'Organ Tubuh Manusia', difficulty: 'mudah', text: 'Paru-paru berfungsi untuk...', options: ['Bernapas', 'Mencerna makanan', 'Memompa darah', 'Menyaring darah'], correct: 0, explanation: 'Paru-paru adalah organ utama pernapasan manusia.' },
  { id: 'i79', subject: 'ipa', category: 'Ekosistem', difficulty: 'sedang', text: 'Tempat tinggal asli makhluk hidup disebut...', options: ['Habitat', 'Ekosistem', 'Populasi', 'Komunitas'], correct: 0, explanation: 'Habitat adalah tempat hidup alami makhluk hidup.' },
  { id: 'i80', subject: 'ipa', category: 'Perubahan Wujud', difficulty: 'sedang', text: 'Perubahan zat gas langsung menjadi padat disebut...', options: ['Mengkristal', 'Mencair', 'Menguap', 'Menyublim'], correct: 0, explanation: 'Mengkristal adalah perubahan gas menjadi padat.' },
  { id: 'i81', subject: 'ipa', category: 'Listrik', difficulty: 'mudah', text: 'Lampu dapat menyala jika rangkaian listrik bersifat...', options: ['Tertutup', 'Terbuka', 'Rusak', 'Paralel putus'], correct: 0, explanation: 'Arus listrik mengalir pada rangkaian tertutup.' },
  { id: 'i82', subject: 'ipa', category: 'Cahaya', difficulty: 'sedang', text: 'Periskop memanfaatkan sifat cahaya yaitu...', options: ['Pemantulan', 'Pembiasan', 'Dispersi', 'Difraksi'], correct: 0, explanation: 'Periskop menggunakan cermin untuk memantulkan cahaya.' },
  { id: 'i83', subject: 'ipa', category: 'Bunyi', difficulty: 'sedang', text: 'Semakin kuat getaran benda, bunyi akan terdengar...', options: ['Semakin keras', 'Semakin lemah', 'Semakin kecil', 'Menghilang'], correct: 0, explanation: 'Getaran yang kuat menghasilkan bunyi lebih keras.' },
  { id: 'i84', subject: 'ipa', category: 'Makhluk Hidup', difficulty: 'mudah', text: 'Contoh hewan mamalia adalah...', options: ['Kucing', 'Ayam', 'Ikan', 'Katak'], correct: 0, explanation: 'Mamalia adalah hewan yang menyusui anaknya.' },
  { id: 'i85', subject: 'ipa', category: 'Pelestarian Lingkungan', difficulty: 'sedang', text: 'Penggunaan kendaraan umum dapat membantu mengurangi...', options: ['Polusi udara', 'Curah hujan', 'Gempa bumi', 'Fotosintesis'], correct: 0, explanation: 'Kendaraan umum membantu mengurangi asap kendaraan.' },
  { id: 'i86', subject: 'ipa', category: 'Tata Surya', difficulty: 'sedang', text: 'Peristiwa siang dan malam terjadi karena...', options: ['Rotasi Bumi', 'Revolusi Bumi', 'Rotasi Bulan', 'Gerhana'], correct: 0, explanation: 'Siang dan malam terjadi akibat rotasi Bumi.' },
  { id: 'i87', subject: 'ipa', category: 'Energi', difficulty: 'mudah', text: 'Makanan merupakan sumber energi bagi...', options: ['Manusia', 'Batu', 'Air', 'Tanah'], correct: 0, explanation: 'Manusia memperoleh energi dari makanan.' },
  { id: 'i88', subject: 'ipa', category: 'Organ Tubuh Manusia', difficulty: 'sedang', text: 'Darah merah dalam tubuh disebabkan oleh adanya...', options: ['Hemoglobin', 'Plasma', 'Trombosit', 'Leukosit'], correct: 0, explanation: 'Hemoglobin memberi warna merah pada darah.' },
  { id: 'i89', subject: 'ipa', category: 'Ekosistem', difficulty: 'sedang', text: 'Sekumpulan makhluk hidup sejenis di suatu tempat disebut...', options: ['Populasi', 'Habitat', 'Komunitas', 'Ekosistem'], correct: 0, explanation: 'Populasi adalah kumpulan makhluk hidup sejenis.' },
  { id: 'i90', subject: 'ipa', category: 'Perubahan Wujud', difficulty: 'mudah', text: 'Mentega yang dipanaskan akan...', options: ['Mencair', 'Membeku', 'Menguap', 'Mengkristal'], correct: 0, explanation: 'Mentega berubah dari padat menjadi cair saat dipanaskan.' },
  { id: 'i91', subject: 'ipa', category: 'Listrik', difficulty: 'sedang', text: 'Rangkaian listrik yang hanya memiliki satu jalur disebut...', options: ['Seri', 'Paralel', 'Campuran', 'Tertutup'], correct: 0, explanation: 'Rangkaian seri hanya memiliki satu jalur arus listrik.' },
  { id: 'i92', subject: 'ipa', category: 'Gaya dan Gerak', difficulty: 'sedang', text: 'Ketapel bekerja menggunakan gaya...', options: ['Pegas', 'Gravitasi', 'Magnet', 'Gesek'], correct: 0, explanation: 'Karet ketapel menghasilkan gaya pegas.' },
  { id: 'i93', subject: 'ipa', category: 'Bunyi', difficulty: 'mudah', text: 'Contoh sumber bunyi adalah...', options: ['Bel sekolah', 'Cermin', 'Air', 'Kertas'], correct: 0, explanation: 'Bel sekolah menghasilkan bunyi dari getaran.' },
  { id: 'i94', subject: 'ipa', category: 'Makhluk Hidup', difficulty: 'sedang', text: 'Katak berkembang biak dengan cara...', options: ['Bertelur', 'Melahirkan', 'Membelah diri', 'Tunas'], correct: 0, explanation: 'Katak berkembang biak dengan bertelur.' },
  { id: 'i95', subject: 'ipa', category: 'Pelestarian Lingkungan', difficulty: 'sedang', text: 'Penebangan hutan secara liar dapat menyebabkan...', options: ['Banjir', 'Udara sejuk', 'Tanah subur', 'Hutan lebat'], correct: 0, explanation: 'Hutan gundul dapat menyebabkan banjir dan longsor.' },
  { id: 'i96', subject: 'ipa', category: 'Tata Surya', difficulty: 'sedang', text: 'Benda langit yang memancarkan cahaya sendiri disebut...', options: ['Bintang', 'Planet', 'Satelit', 'Asteroid'], correct: 0, explanation: 'Bintang memancarkan cahaya sendiri.' },
  { id: 'i97', subject: 'ipa', category: 'Energi', difficulty: 'sedang', text: 'Energi panas matahari dapat dimanfaatkan untuk...', options: ['Menjemur pakaian', 'Membuat es', 'Mendinginkan air', 'Membekukan makanan'], correct: 0, explanation: 'Panas matahari membantu mengeringkan pakaian.' },
  { id: 'i98', subject: 'ipa', category: 'Organ Tubuh Manusia', difficulty: 'mudah', text: 'Alat indra untuk melihat adalah...', options: ['Mata', 'Hidung', 'Kulit', 'Lidah'], correct: 0, explanation: 'Mata digunakan untuk melihat.' },
  { id: 'i99', subject: 'ipa', category: 'Ekosistem', difficulty: 'sedang', text: 'Hewan yang berada di tingkat tertinggi rantai makanan disebut...', options: ['Predator puncak', 'Produsen', 'Pengurai', 'Herbivora'], correct: 0, explanation: 'Predator puncak berada di posisi tertinggi rantai makanan.' },
  { id: 'i100', subject: 'ipa', category: 'Cahaya', difficulty: 'sedang', text: 'Kaca pembesar memanfaatkan lensa...', options: ['Cembung', 'Cekung', 'Datar', 'Silinder'], correct: 0, explanation: 'Kaca pembesar menggunakan lensa cembung untuk memperbesar bayangan.' },
  { id: 'i101', subject: 'ipa', category: 'Makhluk Hidup', difficulty: 'mudah', text: 'Hewan yang memakan tumbuhan dan daging disebut...', options: ['Herbivora', 'Karnivora', 'Omnivora', 'Insektivora'], correct: 2, explanation: 'Omnivora adalah hewan pemakan tumbuhan dan daging, contohnya ayam dan beruang.' },
  { id: 'i102', subject: 'ipa', category: 'Sistem Pernapasan', difficulty: 'sedang', text: 'Organ pernapasan utama pada ikan adalah...', options: ['Paru-paru', 'Insang', 'Trakea', 'Kulit'], correct: 1, explanation: 'Ikan bernapas menggunakan insang untuk mengambil oksigen dari air.' },
  { id: 'i103', subject: 'ipa', category: 'Energi', difficulty: 'mudah', text: 'Sumber energi utama bagi kehidupan di Bumi adalah...', options: ['Bulan', 'Api', 'Matahari', 'Angin'], correct: 2, explanation: 'Matahari merupakan sumber energi utama bagi kehidupan di Bumi.' },
  { id: 'i104', subject: 'ipa', category: 'Tata Surya', difficulty: 'sedang', text: 'Planet terbesar di tata surya adalah...', options: ['Saturnus', 'Bumi', 'Jupiter', 'Mars'], correct: 2, explanation: 'Jupiter adalah planet terbesar di tata surya.' },
  { id: 'i105', subject: 'ipa', category: 'Gaya dan Gerak', difficulty: 'mudah', text: 'Gaya yang menyebabkan benda jatuh ke bawah adalah gaya...', options: ['Pegas', 'Gesek', 'Magnet', 'Gravitasi'], correct: 3, explanation: 'Gaya gravitasi bumi menarik benda menuju pusat bumi.' },
  { id: 'i106', subject: 'ipa', category: 'Cahaya', difficulty: 'sedang', text: 'Benda yang dapat menghasilkan cahaya sendiri disebut...', options: ['Benda gelap', 'Benda bening', 'Sumber cahaya', 'Benda pantul'], correct: 2, explanation: 'Sumber cahaya adalah benda yang dapat memancarkan cahaya sendiri.' },
  { id: 'i107', subject: 'ipa', category: 'Makhluk Hidup', difficulty: 'mudah', text: 'Proses tumbuhan membuat makanan sendiri disebut...', options: ['Respirasi', 'Fotosintesis', 'Fermentasi', 'Adaptasi'], correct: 1, explanation: 'Fotosintesis adalah proses tumbuhan membuat makanan dengan bantuan cahaya matahari.' },
  { id: 'i108', subject: 'ipa', category: 'Organ Tubuh Manusia', difficulty: 'sedang', text: 'Jantung manusia berfungsi untuk...', options: ['Mencerna makanan', 'Memompa darah', 'Mengatur suhu', 'Menghasilkan oksigen'], correct: 1, explanation: 'Jantung memompa darah ke seluruh tubuh.' },
  { id: 'i109', subject: 'ipa', category: 'Perubahan Wujud', difficulty: 'mudah', text: 'Perubahan air menjadi es disebut...', options: ['Menguap', 'Mencair', 'Membeku', 'Menyublim'], correct: 2, explanation: 'Membeku adalah perubahan wujud cair menjadi padat.' },
  { id: 'i110', subject: 'ipa', category: 'Ekosistem', difficulty: 'sedang', text: 'Makhluk hidup yang berperan sebagai pengurai adalah...', options: ['Rumput', 'Jamur', 'Harimau', 'Ayam'], correct: 1, explanation: 'Jamur dan bakteri berperan sebagai pengurai di alam.' },
  { id: 'i111', subject: 'ipa', category: 'Listrik', difficulty: 'sedang', text: 'Alat untuk memutus dan menyambung arus listrik adalah...', options: ['Baterai', 'Kabel', 'Saklar', 'Lampu'], correct: 2, explanation: 'Saklar digunakan untuk memutus dan menyambung arus listrik.' },
  { id: 'i112', subject: 'ipa', category: 'Bunyi', difficulty: 'mudah', text: 'Bunyi dapat terdengar karena merambat melalui...', options: ['Ruang hampa', 'Medium', 'Bayangan', 'Cahaya'], correct: 1, explanation: 'Bunyi membutuhkan medium seperti udara untuk merambat.' },
  { id: 'i113', subject: 'ipa', category: 'Pelestarian Alam', difficulty: 'sedang', text: 'Penebangan hutan secara liar dapat menyebabkan...', options: ['Kesuburan meningkat', 'Banjir', 'Udara sejuk', 'Tanah subur'], correct: 1, explanation: 'Penebangan liar dapat menyebabkan banjir dan longsor.' },
  { id: 'i114', subject: 'ipa', category: 'Sistem Pencernaan', difficulty: 'mudah', text: 'Proses awal pencernaan makanan terjadi di...', options: ['Usus', 'Mulut', 'Lambung', 'Hati'], correct: 1, explanation: 'Pencernaan dimulai di mulut dengan bantuan gigi dan air liur.' },
  { id: 'i115', subject: 'ipa', category: 'Tumbuhan', difficulty: 'sedang', text: 'Bagian tumbuhan yang berfungsi menyerap air adalah...', options: ['Daun', 'Batang', 'Akar', 'Bunga'], correct: 2, explanation: 'Akar menyerap air dan zat hara dari tanah.' },
  { id: 'i116', subject: 'ipa', category: 'Tata Surya', difficulty: 'mudah', text: 'Planet tempat manusia tinggal adalah...', options: ['Mars', 'Venus', 'Bumi', 'Saturnus'], correct: 2, explanation: 'Manusia hidup di planet Bumi.' },
  { id: 'i117', subject: 'ipa', category: 'Energi', difficulty: 'sedang', text: 'Kincir angin memanfaatkan energi...', options: ['Air', 'Panas bumi', 'Angin', 'Listrik'], correct: 2, explanation: 'Kincir angin menggunakan energi gerak angin.' },
  { id: 'i118', subject: 'ipa', category: 'Makhluk Hidup', difficulty: 'mudah', text: 'Hewan yang berkembang biak dengan bertelur disebut...', options: ['Vivipar', 'Ovovivipar', 'Ovipar', 'Mamalia'], correct: 2, explanation: 'Ovipar adalah hewan yang berkembang biak dengan bertelur.' },
  { id: 'i119', subject: 'ipa', category: 'Perubahan Wujud', difficulty: 'sedang', text: 'Perubahan dari gas menjadi cair disebut...', options: ['Menguap', 'Mengembun', 'Membeku', 'Mencair'], correct: 1, explanation: 'Mengembun adalah perubahan wujud gas menjadi cair.' },
  { id: 'i120', subject: 'ipa', category: 'Gaya dan Gerak', difficulty: 'mudah', text: 'Magnet dapat menarik benda yang terbuat dari...', options: ['Kayu', 'Plastik', 'Besi', 'Kertas'], correct: 2, explanation: 'Magnet dapat menarik benda yang mengandung logam seperti besi.' },
  { id: 'i121', subject: 'ipa', category: 'Sistem Peredaran Darah', difficulty: 'sedang', text: 'Darah yang kaya oksigen berwarna...', options: ['Biru', 'Putih', 'Merah terang', 'Hijau'], correct: 2, explanation: 'Darah kaya oksigen berwarna merah terang.' },
  { id: 'i122', subject: 'ipa', category: 'Cahaya', difficulty: 'mudah', text: 'Cermin yang biasa digunakan untuk bercermin adalah cermin...', options: ['Cembung', 'Datar', 'Cekung', 'Bias'], correct: 1, explanation: 'Cermin datar menghasilkan bayangan tegak dan sama besar.' },
  { id: 'i123', subject: 'ipa', category: 'Lingkungan', difficulty: 'sedang', text: 'Sampah plastik sulit terurai sehingga dapat menyebabkan...', options: ['Udara segar', 'Pencemaran lingkungan', 'Kesuburan tanah', 'Hutan lebat'], correct: 1, explanation: 'Sampah plastik dapat mencemari lingkungan karena sulit terurai.' },
  { id: 'i124', subject: 'ipa', category: 'Organ Tubuh Manusia', difficulty: 'mudah', text: 'Organ tubuh yang digunakan untuk mendengar adalah...', options: ['Mata', 'Kulit', 'Telinga', 'Hidung'], correct: 2, explanation: 'Telinga merupakan organ pendengaran manusia.' },
  { id: 'i125', subject: 'ipa', category: 'Adaptasi', difficulty: 'sedang', text: 'Bunglon mengubah warna tubuhnya untuk...', options: ['Tidur', 'Kamuflase', 'Fotosintesis', 'Berkembang biak'], correct: 1, explanation: 'Bunglon melakukan kamuflase untuk melindungi diri.' },
  { id: 'i126', subject: 'ipa', category: 'Tata Surya', difficulty: 'mudah', text: 'Bintang yang menjadi pusat tata surya adalah...', options: ['Bulan', 'Mars', 'Matahari', 'Venus'], correct: 2, explanation: 'Matahari adalah pusat tata surya.' },
  { id: 'i127', subject: 'ipa', category: 'Energi', difficulty: 'sedang', text: 'Setrika listrik mengubah energi listrik menjadi energi...', options: ['Gerak', 'Panas', 'Kimia', 'Bunyi'], correct: 1, explanation: 'Setrika mengubah energi listrik menjadi panas.' },
  { id: 'i128', subject: 'ipa', category: 'Makhluk Hidup', difficulty: 'mudah', text: 'Hewan yang hidup di dua alam disebut...', options: ['Mamalia', 'Amfibi', 'Reptil', 'Aves'], correct: 1, explanation: 'Amfibi hidup di darat dan air.' },
  { id: 'i129', subject: 'ipa', category: 'Perubahan Wujud', difficulty: 'sedang', text: 'Es yang dibiarkan di tempat terbuka lama-kelamaan akan...', options: ['Menguap', 'Membeku', 'Mencair', 'Mengkristal'], correct: 2, explanation: 'Es mencair karena menerima panas dari lingkungan.' },
  { id: 'i130', subject: 'ipa', category: 'Bunyi', difficulty: 'mudah', text: 'Benda yang menghasilkan bunyi disebut...', options: ['Sumber bunyi', 'Pantulan bunyi', 'Gema', 'Getaran'], correct: 0, explanation: 'Sumber bunyi adalah benda yang menghasilkan bunyi.' },
  { id: 'i131', subject: 'ipa', category: 'Makhluk Hidup', difficulty: 'sedang', text: 'Hewan yang berkembang biak dengan melahirkan disebut...', options: ['Ovipar', 'Vivipar', 'Ovovivipar', 'Spora'], correct: 1, explanation: 'Vivipar adalah hewan yang berkembang biak dengan melahirkan, seperti kucing dan sapi.' },
  { id: 'i132', subject: 'ipa', category: 'Sistem Pernapasan', difficulty: 'mudah', text: 'Manusia menghirup gas...', options: ['Karbon dioksida', 'Nitrogen', 'Oksigen', 'Hidrogen'], correct: 2, explanation: 'Manusia membutuhkan oksigen untuk proses pernapasan.' },
  { id: 'i133', subject: 'ipa', category: 'Energi', difficulty: 'sedang', text: 'Baterai menyimpan energi dalam bentuk energi...', options: ['Kimia', 'Panas', 'Cahaya', 'Gerak'], correct: 0, explanation: 'Baterai menyimpan energi kimia yang dapat diubah menjadi energi listrik.' },
  { id: 'i134', subject: 'ipa', category: 'Tumbuhan', difficulty: 'mudah', text: 'Bagian tumbuhan yang berfungsi sebagai tempat fotosintesis adalah...', options: ['Akar', 'Batang', 'Daun', 'Bunga'], correct: 2, explanation: 'Daun mengandung klorofil yang digunakan untuk fotosintesis.' },
  { id: 'i135', subject: 'ipa', category: 'Gaya dan Gerak', difficulty: 'sedang', text: 'Semakin kasar permukaan benda, maka gaya gesek akan...', options: ['Semakin kecil', 'Semakin besar', 'Tetap', 'Hilang'], correct: 1, explanation: 'Permukaan kasar menghasilkan gaya gesek lebih besar.' },
  { id: 'i136', subject: 'ipa', category: 'Cahaya', difficulty: 'mudah', text: 'Bayangan yang dibentuk cermin datar bersifat...', options: ['Terbalik', 'Maya dan tegak', 'Nyata', 'Kecil'], correct: 1, explanation: 'Cermin datar menghasilkan bayangan maya, tegak, dan sama besar.' },
  { id: 'i137', subject: 'ipa', category: 'Ekosistem', difficulty: 'sedang', text: 'Hubungan antara lebah dan bunga termasuk simbiosis...', options: ['Parasitisme', 'Komensalisme', 'Mutualisme', 'Predasi'], correct: 2, explanation: 'Lebah mendapat nektar, bunga terbantu penyerbukannya.' },
  { id: 'i138', subject: 'ipa', category: 'Listrik', difficulty: 'mudah', text: 'Benda yang dapat menghantarkan listrik dengan baik disebut...', options: ['Isolator', 'Konduktor', 'Generator', 'Resistor'], correct: 1, explanation: 'Konduktor adalah bahan yang mudah menghantarkan listrik.' },
  { id: 'i139', subject: 'ipa', category: 'Perubahan Wujud', difficulty: 'sedang', text: 'Perubahan wujud dari cair menjadi gas disebut...', options: ['Mencair', 'Menguap', 'Mengembun', 'Membeku'], correct: 1, explanation: 'Menguap adalah perubahan zat cair menjadi gas.' },
  { id: 'i140', subject: 'ipa', category: 'Sistem Pencernaan', difficulty: 'mudah', text: 'Gigi seri berfungsi untuk...', options: ['Mengunyah', 'Mengoyak', 'Memotong makanan', 'Menghaluskan'], correct: 2, explanation: 'Gigi seri digunakan untuk memotong makanan.' },
  { id: 'i141', subject: 'ipa', category: 'Tata Surya', difficulty: 'sedang', text: 'Planet yang dikenal sebagai Planet Merah adalah...', options: ['Venus', 'Mars', 'Jupiter', 'Saturnus'], correct: 1, explanation: 'Mars disebut Planet Merah karena permukaannya berwarna kemerahan.' },
  { id: 'i142', subject: 'ipa', category: 'Bunyi', difficulty: 'mudah', text: 'Bunyi berasal dari benda yang...', options: ['Diam', 'Bergetar', 'Mengkilap', 'Mencair'], correct: 1, explanation: 'Bunyi dihasilkan oleh benda yang bergetar.' },
  { id: 'i143', subject: 'ipa', category: 'Pelestarian Lingkungan', difficulty: 'sedang', text: 'Menanam kembali hutan yang gundul disebut...', options: ['Abrasi', 'Reboisasi', 'Urbanisasi', 'Evaporasi'], correct: 1, explanation: 'Reboisasi adalah penanaman kembali hutan yang gundul.' },
  { id: 'i144', subject: 'ipa', category: 'Makhluk Hidup', difficulty: 'mudah', text: 'Hewan yang memakan daging disebut...', options: ['Herbivora', 'Omnivora', 'Karnivora', 'Insektivora'], correct: 2, explanation: 'Karnivora adalah hewan pemakan daging.' },
  { id: 'i145', subject: 'ipa', category: 'Organ Tubuh Manusia', difficulty: 'sedang', text: 'Organ tubuh yang berfungsi menyaring darah adalah...', options: ['Paru-paru', 'Ginjal', 'Jantung', 'Hati'], correct: 1, explanation: 'Ginjal berfungsi menyaring darah dan menghasilkan urine.' },
  { id: 'i146', subject: 'ipa', category: 'Energi', difficulty: 'mudah', text: 'Lampu menyala mengubah energi listrik menjadi energi...', options: ['Gerak', 'Kimia', 'Cahaya', 'Bunyi'], correct: 2, explanation: 'Lampu mengubah energi listrik menjadi cahaya.' },
  { id: 'i147', subject: 'ipa', category: 'Tumbuhan', difficulty: 'sedang', text: 'Tumbuhan hijau tampak berwarna hijau karena mengandung...', options: ['Karoten', 'Klorofil', 'Protein', 'Amilum'], correct: 1, explanation: 'Klorofil adalah zat hijau daun.' },
  { id: 'i148', subject: 'ipa', category: 'Perubahan Wujud', difficulty: 'mudah', text: 'Perubahan mentega yang dipanaskan menjadi cair disebut...', options: ['Menguap', 'Mencair', 'Membeku', 'Menyublim'], correct: 1, explanation: 'Mencair adalah perubahan dari padat menjadi cair.' },
  { id: 'i149', subject: 'ipa', category: 'Gaya dan Gerak', difficulty: 'sedang', text: 'Alat yang menggunakan gaya pegas adalah...', options: ['Timbangan pegas', 'Kompas', 'Termometer', 'Mikroskop'], correct: 0, explanation: 'Timbangan pegas memanfaatkan gaya pegas untuk mengukur berat.' },
  { id: 'i150', subject: 'ipa', category: 'Sistem Pernapasan', difficulty: 'mudah', text: 'Udara masuk ke paru-paru melalui...', options: ['Kerongkongan', 'Trakea', 'Usus', 'Pembuluh darah'], correct: 1, explanation: 'Trakea atau batang tenggorokan adalah saluran udara menuju paru-paru.' },
  { id: 'i151', subject: 'ipa', category: 'Makhluk Hidup', difficulty: 'mudah', text: 'Hewan yang aktif pada malam hari disebut hewan...', options: ['Nokturnal', 'Herbivora', 'Diurnal', 'Omnivora'], correct: 0, explanation: 'Hewan nokturnal adalah hewan yang aktif pada malam hari.' },
  { id: 'i152', subject: 'ipa', category: 'Sistem Pernapasan', difficulty: 'sedang', text: 'Organ pernapasan utama pada ikan adalah...', options: ['Paru-paru', 'Insang', 'Kulit', 'Trakea'], correct: 1, explanation: 'Ikan bernapas menggunakan insang untuk mengambil oksigen dari air.' },
  { id: 'i153', subject: 'ipa', category: 'Energi', difficulty: 'mudah', text: 'Matahari merupakan sumber energi...', options: ['Kimia', 'Bunyi', 'Utama di bumi', 'Gerak'], correct: 2, explanation: 'Matahari adalah sumber energi utama bagi kehidupan di bumi.' },
  { id: 'i154', subject: 'ipa', category: 'Tumbuhan', difficulty: 'sedang', text: 'Bagian tumbuhan yang berfungsi menyerap air dan mineral adalah...', options: ['Daun', 'Batang', 'Akar', 'Bunga'], correct: 2, explanation: 'Akar berfungsi menyerap air dan zat hara dari tanah.' },
  { id: 'i155', subject: 'ipa', category: 'Gaya', difficulty: 'mudah', text: 'Gaya yang menyebabkan benda jatuh ke bawah adalah gaya...', options: ['Magnet', 'Pegas', 'Gravitasi', 'Gesek'], correct: 2, explanation: 'Gravitasi bumi menarik benda ke arah pusat bumi.' },
  { id: 'i156', subject: 'ipa', category: 'Tata Surya', difficulty: 'sedang', text: 'Planet terbesar dalam tata surya adalah...', options: ['Saturnus', 'Mars', 'Jupiter', 'Venus'], correct: 2, explanation: 'Jupiter merupakan planet terbesar dalam tata surya.' },
  { id: 'i157', subject: 'ipa', category: 'Cahaya', difficulty: 'mudah', text: 'Benda yang dapat memantulkan cahaya dengan baik adalah...', options: ['Kaca', 'Kayu', 'Kertas', 'Kain'], correct: 0, explanation: 'Kaca dan cermin dapat memantulkan cahaya dengan baik.' },
  { id: 'i158', subject: 'ipa', category: 'Perubahan Wujud', difficulty: 'sedang', text: 'Perubahan wujud dari cair menjadi gas disebut...', options: ['Membeku', 'Menguap', 'Mencair', 'Mengembun'], correct: 1, explanation: 'Menguap adalah perubahan benda cair menjadi gas.' },
  { id: 'i159', subject: 'ipa', category: 'Ekosistem', difficulty: 'sedang', text: 'Makhluk hidup yang dapat membuat makanan sendiri disebut...', options: ['Konsumen', 'Pengurai', 'Produsen', 'Predator'], correct: 2, explanation: 'Produsen seperti tumbuhan hijau mampu membuat makanan sendiri melalui fotosintesis.' },
  { id: 'i160', subject: 'ipa', category: 'Organ Tubuh', difficulty: 'mudah', text: 'Jantung manusia berfungsi untuk...', options: ['Mencerna makanan', 'Memompa darah', 'Mengatur suhu', 'Menyaring udara'], correct: 1, explanation: 'Jantung bertugas memompa darah ke seluruh tubuh.' },
  { id: 'i161', subject: 'ipa', category: 'Bunyi', difficulty: 'sedang', text: 'Bunyi dapat merambat melalui...', options: ['Zat padat saja', 'Zat cair saja', 'Zat gas saja', 'Semua zat'], correct: 3, explanation: 'Bunyi dapat merambat melalui zat padat, cair, dan gas.' },
  { id: 'i162', subject: 'ipa', category: 'Pelestarian Lingkungan', difficulty: 'mudah', text: 'Menanam kembali hutan yang gundul disebut...', options: ['Urbanisasi', 'Reboisasi', 'Eksploitasi', 'Migrasi'], correct: 1, explanation: 'Reboisasi adalah penanaman kembali hutan yang rusak.' },
  { id: 'i163', subject: 'ipa', category: 'Tumbuhan', difficulty: 'sedang', text: 'Proses pembuatan makanan pada tumbuhan disebut...', options: ['Respirasi', 'Fotosintesis', 'Transpirasi', 'Adaptasi'], correct: 1, explanation: 'Fotosintesis terjadi dengan bantuan cahaya matahari.' },
  { id: 'i164', subject: 'ipa', category: 'Energi', difficulty: 'mudah', text: 'Alat yang mengubah energi listrik menjadi energi gerak adalah...', options: ['Lampu', 'Kipas angin', 'Kompor', 'Setrika'], correct: 1, explanation: 'Kipas angin menggunakan energi listrik untuk menghasilkan gerakan baling-baling.' },
  { id: 'i165', subject: 'ipa', category: 'Sistem Pencernaan', difficulty: 'sedang', text: 'Tempat penyerapan sari-sari makanan terjadi di...', options: ['Lambung', 'Usus halus', 'Kerongkongan', 'Mulut'], correct: 1, explanation: 'Usus halus menyerap sari-sari makanan hasil pencernaan.' },
  { id: 'i166', subject: 'ipa', category: 'Adaptasi', difficulty: 'mudah', text: 'Bebek memiliki kaki berselaput untuk membantu...', options: ['Memanjat', 'Berenang', 'Terbang', 'Berburu'], correct: 1, explanation: 'Kaki berselaput membantu bebek berenang di air.' },
  { id: 'i167', subject: 'ipa', category: 'Cuaca', difficulty: 'mudah', text: 'Alat untuk mengukur suhu udara adalah...', options: ['Barometer', 'Termometer', 'Higrometer', 'Anemometer'], correct: 1, explanation: 'Termometer digunakan untuk mengukur suhu.' },
  { id: 'i168', subject: 'ipa', category: 'Gaya Magnet', difficulty: 'sedang', text: 'Benda berikut yang dapat ditarik magnet adalah...', options: ['Kayu', 'Besi', 'Plastik', 'Kaca'], correct: 1, explanation: 'Besi termasuk benda magnetis.' },
  { id: 'i169', subject: 'ipa', category: 'Tata Surya', difficulty: 'mudah', text: 'Planet yang dikenal sebagai planet merah adalah...', options: ['Mars', 'Venus', 'Saturnus', 'Merkurius'], correct: 0, explanation: 'Mars disebut planet merah karena permukaannya mengandung banyak besi oksida.' },
  { id: 'i170', subject: 'ipa', category: 'Air', difficulty: 'sedang', text: 'Peristiwa berubahnya uap air menjadi titik-titik air disebut...', options: ['Penguapan', 'Pembekuan', 'Pengembunan', 'Penyubliman'], correct: 2, explanation: 'Pengembunan terjadi saat uap air berubah menjadi cair.' },
  { id: 'i171', subject: 'ipa', category: 'Ekosistem', difficulty: 'sedang', text: 'Hewan pemakan tumbuhan disebut...', options: ['Karnivora', 'Omnivora', 'Herbivora', 'Predator'], correct: 2, explanation: 'Herbivora adalah hewan pemakan tumbuhan.' },
  { id: 'i172', subject: 'ipa', category: 'Sistem Gerak', difficulty: 'mudah', text: 'Tulang yang melindungi otak adalah...', options: ['Tulang rusuk', 'Tulang tengkorak', 'Tulang paha', 'Tulang belakang'], correct: 1, explanation: 'Tulang tengkorak melindungi otak manusia.' },
  { id: 'i173', subject: 'ipa', category: 'Listrik', difficulty: 'sedang', text: 'Rangkaian listrik yang hanya memiliki satu jalur disebut...', options: ['Paralel', 'Campuran', 'Seri', 'Ganda'], correct: 2, explanation: 'Rangkaian seri memiliki satu jalur arus listrik.' },
  { id: 'i174', subject: 'ipa', category: 'Pelestarian Hewan', difficulty: 'mudah', text: 'Komodo merupakan hewan langka yang berasal dari...', options: ['Jawa', 'Sumatra', 'NTT', 'Papua'], correct: 2, explanation: 'Komodo berasal dari Nusa Tenggara Timur.' },
  { id: 'i175', subject: 'ipa', category: 'Perubahan Energi', difficulty: 'sedang', text: 'Setrika listrik mengubah energi listrik menjadi energi...', options: ['Gerak', 'Kimia', 'Panas', 'Cahaya'], correct: 2, explanation: 'Setrika menghasilkan panas dari energi listrik.' },
  { id: 'i176', subject: 'ipa', category: 'Makhluk Hidup', difficulty: 'mudah', text: 'Katak berkembang biak dengan cara...', options: ['Melahirkan', 'Bertelur', 'Membelah diri', 'Tunas'], correct: 1, explanation: 'Katak berkembang biak dengan bertelur.' },
  { id: 'i177', subject: 'ipa', category: 'Cahaya', difficulty: 'sedang', text: 'Cermin yang biasa digunakan pada spion kendaraan adalah cermin...', options: ['Datar', 'Cembung', 'Cekung', 'Bening'], correct: 1, explanation: 'Cermin cembung memberikan bidang pandang lebih luas.' },
  { id: 'i178', subject: 'ipa', category: 'Peredaran Darah', difficulty: 'sedang', text: 'Darah kaya oksigen berwarna...', options: ['Merah terang', 'Merah gelap', 'Biru', 'Hijau'], correct: 0, explanation: 'Darah kaya oksigen berwarna merah terang.' },
  { id: 'i179', subject: 'ipa', category: 'Lingkungan', difficulty: 'mudah', text: 'Sampah plastik sulit terurai sehingga dapat menyebabkan...', options: ['Pencemaran lingkungan', 'Kesuburan tanah', 'Udara segar', 'Panen meningkat'], correct: 0, explanation: 'Sampah plastik dapat mencemari lingkungan karena sulit terurai.' },
  { id: 'i180', subject: 'ipa', category: 'Tumbuhan', difficulty: 'sedang', text: 'Tumbuhan yang berkembang biak dengan spora adalah...', options: ['Mangga', 'Paku', 'Jagung', 'Kelapa'], correct: 1, explanation: 'Tumbuhan paku berkembang biak dengan spora.' },
  { id: 'i181', subject: 'ipa', category: 'Benda Langit', difficulty: 'mudah', text: 'Satelit alami bumi adalah...', options: ['Mars', 'Matahari', 'Bulan', 'Venus'], correct: 2, explanation: 'Bulan adalah satelit alami bumi.' },
  { id: 'i182', subject: 'ipa', category: 'Perubahan Wujud', difficulty: 'sedang', text: 'Perubahan benda cair menjadi padat disebut...', options: ['Menguap', 'Membeku', 'Mencair', 'Mengembun'], correct: 1, explanation: 'Membeku adalah perubahan cair menjadi padat.' },
  { id: 'i183', subject: 'ipa', category: 'Gaya', difficulty: 'mudah', text: 'Tarikan dan dorongan disebut...', options: ['Energi', 'Gaya', 'Kalor', 'Massa'], correct: 1, explanation: 'Gaya adalah tarikan atau dorongan.' },
  { id: 'i184', subject: 'ipa', category: 'Organ Tubuh', difficulty: 'sedang', text: 'Ginjal berfungsi untuk...', options: ['Memompa darah', 'Mencerna makanan', 'Menyaring darah', 'Mengatur gerak'], correct: 2, explanation: 'Ginjal menyaring zat sisa dalam darah.' },
  { id: 'i185', subject: 'ipa', category: 'Energi Alternatif', difficulty: 'sedang', text: 'Contoh energi alternatif yang berasal dari angin adalah...', options: ['PLTA', 'PLTB', 'PLTU', 'PLN'], correct: 1, explanation: 'PLTB adalah Pembangkit Listrik Tenaga Bayu (angin).' },
  { id: 'i186', subject: 'ipa', category: 'Hewan', difficulty: 'mudah', text: 'Hewan pemakan daging disebut...', options: ['Herbivora', 'Omnivora', 'Karnivora', 'Insektivora'], correct: 2, explanation: 'Karnivora adalah hewan pemakan daging.' },
  { id: 'i187', subject: 'ipa', category: 'Kalor', difficulty: 'sedang', text: 'Panci yang dipanaskan lama-kelamaan menjadi panas karena perpindahan kalor secara...', options: ['Radiasi', 'Konveksi', 'Konduksi', 'Evaporasi'], correct: 2, explanation: 'Konduksi adalah perpindahan panas melalui benda padat.' },
  { id: 'i188', subject: 'ipa', category: 'Cuaca', difficulty: 'mudah', text: 'Awan gelap tebal biasanya menandakan akan terjadi...', options: ['Pelangi', 'Hujan', 'Gempa', 'Kabut'], correct: 1, explanation: 'Awan gelap tebal sering menjadi tanda hujan.' },
  { id: 'i189', subject: 'ipa', category: 'Pelestarian', difficulty: 'sedang', text: 'Tempat perlindungan hewan langka disebut...', options: ['Pasar', 'Suaka margasatwa', 'Terminal', 'Perpustakaan'], correct: 1, explanation: 'Suaka margasatwa digunakan untuk melindungi hewan langka.' },
  { id: 'i190', subject: 'ipa', category: 'Sistem Pernapasan', difficulty: 'sedang', text: 'Udara masuk pertama kali ke tubuh melalui...', options: ['Paru-paru', 'Bronkus', 'Hidung', 'Alveolus'], correct: 2, explanation: 'Udara pernapasan masuk melalui hidung.' },
  { id: 'i191', subject: 'ipa', category: 'Tata Surya', difficulty: 'mudah', text: 'Bintang yang menjadi pusat tata surya adalah...', options: ['Bulan', 'Matahari', 'Mars', 'Jupiter'], correct: 1, explanation: 'Matahari adalah pusat tata surya.' },
  { id: 'i192', subject: 'ipa', category: 'Perubahan Lingkungan', difficulty: 'sedang', text: 'Penebangan hutan secara liar dapat menyebabkan...', options: ['Banjir', 'Udara segar', 'Hutan lebat', 'Tanah subur'], correct: 0, explanation: 'Penebangan liar dapat menyebabkan banjir dan longsor.' },
  { id: 'i193', subject: 'ipa', category: 'Gaya Gesek', difficulty: 'mudah', text: 'Ban kendaraan dibuat bergerigi agar...', options: ['Lebih licin', 'Mengurangi gaya gesek', 'Menambah gaya gesek', 'Lebih berat'], correct: 2, explanation: 'Ban bergerigi meningkatkan gaya gesek agar tidak mudah tergelincir.' },
  { id: 'i194', subject: 'ipa', category: 'Organ Tubuh', difficulty: 'sedang', text: 'Organ yang berfungsi memompa darah ke seluruh tubuh adalah...', options: ['Paru-paru', 'Jantung', 'Hati', 'Ginjal'], correct: 1, explanation: 'Jantung memompa darah ke seluruh tubuh.' },
  { id: 'i195', subject: 'ipa', category: 'Perubahan Wujud', difficulty: 'mudah', text: 'Es batu yang dibiarkan di tempat terbuka akan...', options: ['Membeku', 'Menguap', 'Mencair', 'Menyublim'], correct: 2, explanation: 'Es batu berubah dari padat menjadi cair atau mencair.' },
  { id: 'i196', subject: 'ipa', category: 'Tumbuhan', difficulty: 'sedang', text: 'Klorofil pada daun berfungsi untuk...', options: ['Menyerap air', 'Menyerap cahaya matahari', 'Menguatkan batang', 'Menyimpan makanan'], correct: 1, explanation: 'Klorofil membantu menyerap cahaya matahari untuk fotosintesis.' },
  { id: 'i197', subject: 'ipa', category: 'Energi', difficulty: 'mudah', text: 'Baterai menyimpan energi...', options: ['Kimia', 'Gerak', 'Panas', 'Bunyi'], correct: 0, explanation: 'Baterai menyimpan energi kimia yang dapat diubah menjadi listrik.' },
  { id: 'i198', subject: 'ipa', category: 'Hewan', difficulty: 'sedang', text: 'Hewan yang dapat hidup di dua alam disebut...', options: ['Mamalia', 'Reptil', 'Amfibi', 'Aves'], correct: 2, explanation: 'Amfibi dapat hidup di darat dan di air.' },
  { id: 'i199', subject: 'ipa', category: 'Lingkungan', difficulty: 'mudah', text: 'Menghemat penggunaan air merupakan bentuk...', options: ['Pencemaran', 'Pelestarian lingkungan', 'Eksploitasi', 'Kerusakan alam'], correct: 1, explanation: 'Menghemat air membantu menjaga kelestarian lingkungan.' },
  { id: 'i200', subject: 'ipa', category: 'Sistem Pencernaan', difficulty: 'sedang', text: 'Organ yang menghasilkan empedu adalah...', options: ['Ginjal', 'Pankreas', 'Hati', 'Usus'], correct: 2, explanation: 'Hati menghasilkan cairan empedu untuk membantu pencernaan lemak.' },

  // --- IPS ---
  { id: 's1', subject: 'ips', category: 'ASEAN', difficulty: 'mudah', text: 'Negara di kawasan Asia Tenggara yang tidak pernah dijajah oleh bangsa Eropa adalah...', options: ['Thailand', 'Filipina', 'Malaysia', 'Myanmar'], correct: 0, explanation: 'Thailand adalah satu-satunya negara ASEAN yang bertindak sebagai negara penyangga (buffer state) antara kekuasaan Inggris dan Prancis.' },
  { id: 's2', subject: 'ips', category: 'Ekonomi Global', difficulty: 'sedang', text: 'Kegiatan menjual barang atau jasa dari dalam negeri ke luar negeri disebut...', options: ['Ekspor', 'Impor', 'Distribusi', 'Perdagangan Bebas'], correct: 0, explanation: 'Ekspor adalah kegiatan mengeluarkan barang dari daerah pabean (dalam negeri) ke luar negeri.' },
  { id: 's3', subject: 'ips', category: 'Sejarah Indonesia', difficulty: 'sulit', text: 'Perjanjian yang mengakhiri konflik antara Indonesia dan Belanda, di mana Belanda mengakui kedaulatan RIS adalah...', options: ['Konferensi Meja Bundar (KMB)', 'Perjanjian Linggarjati', 'Perjanjian Renville', 'Perjanjian Roem-Royen'], correct: 0, explanation: 'KMB dilaksanakan di Den Haag pada tahun 1949, menghasilkan pengakuan kedaulatan Republik Indonesia Serikat oleh Belanda.' },
  { id: 's4', subject: 'ips', category: 'Bentang Alam', difficulty: 'sedang', text: 'Danau tekto-vulkanik terbesar di Indonesia maupun Asia Tenggara adalah...', options: ['Danau Toba', 'Danau Singkarak', 'Danau Poso', 'Danau Batur'], correct: 0, explanation: 'Danau Toba di Sumatera Utara terbentuk dari letusan gunung api super purba (vulkanik) dan pergeseran tektonik.' },
  { id: 's5', subject: 'ips', category: 'Keragaman Sosial', difficulty: 'mudah', text: 'Suku Bugis, Toraja, dan Makassar merupakan suku bangsa yang berasal dari provinsi...', options: ['Sulawesi Selatan', 'Sulawesi Utara', 'Maluku', 'Kalimantan Timur'], correct: 0, explanation: 'Ketiga suku tersebut adalah suku asli yang mendiami wilayah provinsi Sulawesi Selatan.' },
  { id: 's6', subject: 'ips', category: 'Sejarah', difficulty: 'sulit', text: 'Kerajaan Islam pertama di Pulau Jawa adalah...', options: ['Kerajaan Demak', 'Kerajaan Mataram', 'Kerajaan Banten', 'Kerajaan Samudera Pasai'], correct: 0, explanation: 'Kerajaan Demak didirikan oleh Raden Patah pada akhir abad ke-15 dan merupakan kerajaan Islam pertama di Jawa.' },
  { id: 's7', subject: 'ips', category: 'Ekonomi', difficulty: 'sulit', text: 'Sesuatu yang harus dikorbankan untuk mendapatkan sesuatu yang lain dalam ilmu ekonomi disebut...', options: ['Biaya Peluang', 'Biaya Produksi', 'Inflasi', 'Deflasi'], correct: 0, explanation: 'Biaya peluang (opportunity cost) adalah nilai barang/jasa terbaik yang dikorbankan karena memilih alternatif lain.' },
  { id: 's8', subject: 'ips', category: 'Geografi (Iklim)', difficulty: 'sedang', text: 'Angin monsun barat yang berhembus dari Benua Asia ke Benua Australia pada bulan Oktober-April menyebabkan Indonesia mengalami musim...', options: ['Penghujan', 'Kemarau', 'Gugur', 'Pancaroba'], correct: 0, explanation: 'Angin monsun barat melewati Samudera Hindia yang luas sehingga membawa banyak uap air yang memicu musim hujan.' },
  { id: 's9', subject: 'ips', category: 'Sejarah Kemerdekaan', difficulty: 'mudah', text: 'Teks Proklamasi Kemerdekaan Indonesia diketik oleh...', options: ['Sayuti Melik', 'Soekarno', 'Moh. Hatta', 'Ahmad Soebardjo'], correct: 0, explanation: 'Sayuti Melik adalah tokoh pemuda yang mengetik naskah proklamasi setelah ditulis tangan oleh Soekarno.' },
  { id: 's10', subject: 'ips', category: 'Sosiologi', difficulty: 'sedang', text: 'Proses percampuran dua kebudayaan atau lebih yang saling bertemu dan berlangsung dalam waktu yang lama sehingga menghasilkan kebudayaan baru tanpa menghilangkan unsur budaya aslinya disebut...', options: ['Akulturasi', 'Asimilasi', 'Akomodasi', 'Difusi'], correct: 0, explanation: 'Contoh akulturasi adalah Masjid Menara Kudus yang memadukan arsitektur Islam dengan arsitektur Hindu/Jawa.' },
  { id: 's11', subject: 'ips', category: 'ASEAN', difficulty: 'sulit', text: 'Siapakah tokoh dari Indonesia yang ikut menandatangani Deklarasi Bangkok sebagai tanda berdirinya ASEAN?', options: ['Adam Malik', 'Ir. Soekarno', 'Ali Sastroamidjojo', 'Sutan Sjahrir'], correct: 0, explanation: 'Adam Malik, yang saat itu menjabat sebagai Menteri Luar Negeri, merupakan perwakilan Indonesia dalam pembentukan ASEAN tahun 1967.' },
  { id: 's12', subject: 'ips', category: 'Koperasi', difficulty: 'sedang', text: 'Bapak Koperasi Indonesia adalah...', options: ['Mohammad Hatta', 'Soekarno', 'Ki Hajar Dewantara', 'Sutan Sjahrir'], correct: 0, explanation: 'Drs. Moh. Hatta dijuluki Bapak Koperasi karena gagasan dan perjuangannya dalam memajukan sistem koperasi di Indonesia berlandaskan kekeluargaan.' },
  { id: 's13', subject: 'ips', category: 'Geografi', difficulty: 'mudah', text: 'Garis khayal pada peta yang membelah bumi menjadi belahan utara dan selatan adalah garis...', options: ['Khatulistiwa', 'Bujur', 'Meridian', 'Batas Tanggal Internasional'], correct: 0, explanation: 'Garis Khatulistiwa (Ekuator) berada di titik lintang 0 derajat.' },
  { id: 's14', subject: 'ips', category: 'Sejarah Kolonial', difficulty: 'sulit', text: 'Sistem Tanam Paksa (Cultuurstelsel) yang sangat menyengsarakan rakyat Indonesia dicetuskan oleh Gubernur Jenderal...', options: ['Johannes van den Bosch', 'Herman Willem Daendels', 'Thomas Stamford Raffles', 'Jan Pieterszoon Coen'], correct: 0, explanation: 'Van den Bosch menerapkan sistem ini pada tahun 1830 untuk mengisi kas Belanda yang kosong akibat perang.' },
  { id: 's15', subject: 'ips', category: 'Ekonomi Dasar', difficulty: 'sedang', text: 'Kegiatan menggunakan atau menghabiskan nilai guna suatu barang/jasa disebut...', options: ['Konsumsi', 'Produksi', 'Distribusi', 'Investasi'], correct: 0, explanation: 'Konsumsi adalah kegiatan akhir dalam rantai ekonomi dimana barang dipakai oleh konsumen.' },
  { id: 's16', subject: 'ips', category: 'Keragaman Budaya', difficulty: 'mudah', text: 'Rumah adat Tongkonan berasal dari daerah...', options: ['Toraja, Sulawesi Selatan', 'Minangkabau, Sumatera Barat', 'Dayak, Kalimantan Tengah', 'Asmat, Papua'], correct: 0, explanation: 'Tongkonan adalah rumah adat masyarakat Toraja dengan ciri atap melengkung menyerupai perahu.' },
  { id: 's17', subject: 'ips', category: 'Peninggalan Sejarah', difficulty: 'sedang', text: 'Candi Borobudur dibangun pada masa wangsa (dinasti)...', options: ['Syailendra', 'Sanjaya', 'Isyana', 'Girindra'], correct: 0, explanation: 'Candi Borobudur dibangun pada abad ke-8 dan ke-9 Masehi oleh penganut Buddha Mahayana dari Dinasti Syailendra.' },
  { id: 's18', subject: 'ips', category: 'Sistem Pemerintahan', difficulty: 'sulit', text: 'Lembaga negara yang berwenang melantik Presiden dan Wakil Presiden Republik Indonesia adalah...', options: ['Majelis Permusyawaratan Rakyat (MPR)', 'Dewan Perwakilan Rakyat (DPR)', 'Mahkamah Agung (MA)', 'Mahkamah Konstitusi (MK)'], correct: 0, explanation: 'Sesuai UUD 1945, MPR memiliki tugas melantik Presiden dan Wakil Presiden hasil pemilihan umum.' },
  { id: 's19', subject: 'ips', category: 'Geografi Maritim', difficulty: 'sedang', text: 'Batas laut yang ditarik 12 mil dari garis dasar ke arah laut bebas disebut...', options: ['Batas Laut Teritorial', 'Zona Ekonomi Eksklusif (ZEE)', 'Batas Landas Kontinen', 'Laut Lepas'], correct: 0, explanation: 'Laut teritorial adalah batas kedaulatan penuh suatu negara atas perairannya. Sedangkan ZEE adalah 200 mil.' },
  { id: 's20', subject: 'ips', category: 'Tokoh Pahlawan', difficulty: 'mudah', text: 'Pahlawan nasional yang dikenal dengan julukan "Bapak Pendidikan Nasional" adalah...', options: ['Ki Hajar Dewantara', 'Dr. Soetomo', 'K.H. Ahmad Dahlan', 'H.O.S. Tjokroaminoto'], correct: 0, explanation: 'Ki Hajar Dewantara mendirikan perguruan Taman Siswa dan tanggal lahirnya (2 Mei) diperingati sebagai Hari Pendidikan Nasional.' },
  { id: 's21', subject: 'ips', category: 'Peta Indonesia', difficulty: 'mudah', text: 'Pulau terbesar di Indonesia adalah...', options: ['Jawa', 'Sumatra', 'Kalimantan', 'Sulawesi'], correct: 2, explanation: 'Kalimantan merupakan pulau terbesar di Indonesia.' },
  { id: 's22', subject: 'ips', category: 'Peta Indonesia', difficulty: 'mudah', text: 'Ibu kota Provinsi Jawa Tengah adalah...', options: ['Solo', 'Semarang', 'Magelang', 'Purwokerto'], correct: 1, explanation: 'Semarang adalah ibu kota Provinsi Jawa Tengah.' },
  { id: 's23', subject: 'ips', category: 'ASEAN', difficulty: 'mudah', text: 'Indonesia merupakan salah satu pendiri organisasi...', options: ['PBB', 'ASEAN', 'APEC', 'OPEC'], correct: 1, explanation: 'Indonesia adalah salah satu negara pendiri ASEAN.' },
  { id: 's24', subject: 'ips', category: 'Sumber Daya Alam', difficulty: 'mudah', text: 'Contoh sumber daya alam yang dapat diperbarui adalah...', options: ['Minyak bumi', 'Batu bara', 'Hutan', 'Emas'], correct: 2, explanation: 'Hutan termasuk sumber daya alam yang dapat diperbarui jika dikelola dengan baik.' },
  { id: 's25', subject: 'ips', category: 'Bentang Alam', difficulty: 'mudah', text: 'Daerah yang cocok untuk perkebunan teh biasanya berada di...', options: ['Pantai', 'Dataran rendah', 'Pegunungan', 'Lembah sungai'], correct: 2, explanation: 'Perkebunan teh cocok di daerah pegunungan yang sejuk.' },
  { id: 's26', subject: 'ips', category: 'Interaksi Sosial', difficulty: 'mudah', text: 'Kegiatan kerja bakti merupakan contoh...', options: ['Persaingan', 'Interaksi sosial', 'Konflik', 'Individualisme'], correct: 1, explanation: 'Kerja bakti adalah bentuk interaksi sosial yang positif.' },
  { id: 's27', subject: 'ips', category: 'Globalisasi', difficulty: 'mudah', text: 'Masuknya budaya asing ke Indonesia merupakan dampak dari...', options: ['Urbanisasi', 'Migrasi', 'Globalisasi', 'Industrialisasi'], correct: 2, explanation: 'Globalisasi menyebabkan pertukaran budaya antarnegara.' },
  { id: 's28', subject: 'ips', category: 'Uang', difficulty: 'mudah', text: 'Alat pembayaran yang sah di Indonesia adalah...', options: ['Dollar', 'Ringgit', 'Rupiah', 'Yen'], correct: 2, explanation: 'Mata uang resmi Indonesia adalah Rupiah.' },
  { id: 's29', subject: 'ips', category: 'Ekspor Impor', difficulty: 'sedang', text: 'Kegiatan menjual barang ke luar negeri disebut...', options: ['Impor', 'Ekspor', 'Distribusi', 'Produksi'], correct: 1, explanation: 'Ekspor adalah kegiatan menjual barang ke luar negeri.' },
  { id: 's30', subject: 'ips', category: 'Ekonomi Maritim', difficulty: 'sedang', text: 'Indonesia disebut negara maritim karena...', options: ['Memiliki banyak gunung', 'Wilayah lautnya luas', 'Penduduknya sedikit', 'Mayoritas bekerja di kantor'], correct: 1, explanation: 'Indonesia memiliki wilayah laut yang sangat luas.' },
  { id: 's31', subject: 'ips', category: 'Sejarah Indonesia', difficulty: 'sedang', text: 'Kerajaan Hindu tertua di Indonesia adalah...', options: ['Majapahit', 'Kutai', 'Sriwijaya', 'Mataram'], correct: 1, explanation: 'Kutai merupakan kerajaan Hindu tertua di Indonesia.' },
  { id: 's32', subject: 'ips', category: 'Sejarah Indonesia', difficulty: 'sedang', text: 'Kerajaan Sriwijaya terkenal sebagai kerajaan...', options: ['Agraris', 'Maritim', 'Modern', 'Kolonial'], correct: 1, explanation: 'Sriwijaya dikenal sebagai kerajaan maritim yang kuat.' },
  { id: 's33', subject: 'ips', category: 'Islam di Indonesia', difficulty: 'sedang', text: 'Tokoh penyebar agama Islam di Jawa dikenal dengan sebutan...', options: ['Empu', 'Wali Songo', 'Resi', 'Patih'], correct: 1, explanation: 'Wali Songo adalah tokoh penyebar Islam di Pulau Jawa.' },
  { id: 's34', subject: 'ips', category: 'Kolonialisme', difficulty: 'sedang', text: 'Bangsa Eropa pertama yang datang ke Indonesia adalah...', options: ['Belanda', 'Inggris', 'Portugis', 'Spanyol'], correct: 2, explanation: 'Portugis datang pertama kali ke Indonesia pada abad ke-16.' },
  { id: 's35', subject: 'ips', category: 'Kemerdekaan Indonesia', difficulty: 'mudah', text: 'Indonesia merdeka pada tanggal...', options: ['17 Agustus 1945', '1 Juni 1945', '28 Oktober 1928', '10 November 1945'], correct: 0, explanation: 'Indonesia memproklamasikan kemerdekaan pada 17 Agustus 1945.' },
  { id: 's36', subject: 'ips', category: 'Tokoh Nasional', difficulty: 'mudah', text: 'Pembaca teks Proklamasi Kemerdekaan Indonesia adalah...', options: ['Moh. Hatta', 'Soekarno', 'Sudirman', 'Ahmad Yani'], correct: 1, explanation: 'Ir. Soekarno membacakan teks Proklamasi.' },
  { id: 's37', subject: 'ips', category: 'ASEAN', difficulty: 'sedang', text: 'Sekretariat ASEAN berada di kota...', options: ['Bangkok', 'Kuala Lumpur', 'Jakarta', 'Manila'], correct: 2, explanation: 'Sekretariat ASEAN berada di Jakarta, Indonesia.' },
  { id: 's38', subject: 'ips', category: 'Gejala Alam', difficulty: 'sedang', text: 'Peristiwa naiknya air laut ke daratan disebut...', options: ['Abrasi', 'Tsunami', 'Rob', 'Longsor'], correct: 2, explanation: 'Rob adalah banjir akibat air laut pasang.' },
  { id: 's39', subject: 'ips', category: 'Bentang Alam', difficulty: 'mudah', text: 'Daerah pantai biasanya dimanfaatkan untuk...', options: ['Perkebunan teh', 'Tambak ikan', 'Peternakan sapi', 'Hutan pinus'], correct: 1, explanation: 'Daerah pantai banyak dimanfaatkan untuk tambak ikan.' },
  { id: 's40', subject: 'ips', category: 'Interaksi Sosial', difficulty: 'mudah', text: 'Sikap menghargai perbedaan disebut...', options: ['Egois', 'Toleransi', 'Diskriminasi', 'Fanatik'], correct: 1, explanation: 'Menghargai perbedaan merupakan sikap toleransi.' },
  { id: 's41', subject: 'ips', category: 'Keragaman Budaya', difficulty: 'mudah', text: 'Rumah adat Tongkonan berasal dari daerah...', options: ['Papua', 'Toraja', 'Aceh', 'Bali'], correct: 1, explanation: 'Tongkonan adalah rumah adat masyarakat Toraja.' },
  { id: 's42', subject: 'ips', category: 'Keragaman Budaya', difficulty: 'mudah', text: 'Tari Kecak berasal dari...', options: ['Jawa', 'Bali', 'Papua', 'Sumatra'], correct: 1, explanation: 'Tari Kecak berasal dari Bali.' },
  { id: 's43', subject: 'ips', category: 'Peta Indonesia', difficulty: 'sedang', text: 'Pulau paling timur di Indonesia adalah...', options: ['Jawa', 'Sumatra', 'Papua', 'Bali'], correct: 2, explanation: 'Papua berada di wilayah paling timur Indonesia.' },
  { id: 's44', subject: 'ips', category: 'Sumber Daya Alam', difficulty: 'sedang', text: 'Daerah penghasil minyak bumi terbesar di Indonesia adalah...', options: ['Papua', 'Riau', 'Bali', 'NTT'], correct: 1, explanation: 'Riau dikenal sebagai salah satu daerah penghasil minyak bumi terbesar.' },
  { id: 's45', subject: 'ips', category: 'Ekonomi', difficulty: 'sedang', text: 'Kegiatan membuat barang disebut...', options: ['Distribusi', 'Produksi', 'Konsumsi', 'Ekspor'], correct: 1, explanation: 'Produksi adalah kegiatan menghasilkan barang atau jasa.' },
  { id: 's46', subject: 'ips', category: 'Ekonomi', difficulty: 'mudah', text: 'Orang yang menggunakan barang hasil produksi disebut...', options: ['Produsen', 'Distributor', 'Konsumen', 'Investor'], correct: 2, explanation: 'Konsumen adalah pengguna barang atau jasa.' },
  { id: 's47', subject: 'ips', category: 'Perjuangan Kemerdekaan', difficulty: 'sedang', text: 'Pertempuran Surabaya diperingati setiap tanggal...', options: ['17 Agustus', '10 November', '1 Juni', '28 Oktober'], correct: 1, explanation: '10 November diperingati sebagai Hari Pahlawan.' },
  { id: 's48', subject: 'ips', category: 'Tokoh Nasional', difficulty: 'sedang', text: 'Panglima besar Tentara Nasional Indonesia pertama adalah...', options: ['Soekarno', 'Sudirman', 'Moh. Hatta', 'Diponegoro'], correct: 1, explanation: 'Jenderal Sudirman adalah panglima besar TNI pertama.' },
  { id: 's49', subject: 'ips', category: 'Kolonialisme', difficulty: 'sedang', text: 'VOC didirikan oleh bangsa...', options: ['Inggris', 'Portugis', 'Belanda', 'Spanyol'], correct: 2, explanation: 'VOC adalah perusahaan dagang Belanda.' },
  { id: 's50', subject: 'ips', category: 'Pahlawan Nasional', difficulty: 'mudah', text: 'Pangeran Diponegoro memimpin perang melawan...', options: ['Jepang', 'Belanda', 'Portugis', 'Inggris'], correct: 1, explanation: 'Pangeran Diponegoro memimpin Perang Diponegoro melawan Belanda.' },
  { id: 's51', subject: 'ips', category: 'Pahlawan Nasional', difficulty: 'mudah', text: 'R.A. Kartini dikenal sebagai pelopor...', options: ['Perdagangan', 'Emansipasi wanita', 'Pertanian', 'Pendidikan militer'], correct: 1, explanation: 'R.A. Kartini dikenal sebagai pelopor emansipasi wanita Indonesia.' },
  { id: 's52', subject: 'ips', category: 'Sejarah Indonesia', difficulty: 'sedang', text: 'Candi Borobudur merupakan peninggalan agama...', options: ['Islam', 'Kristen', 'Budha', 'Hindu'], correct: 2, explanation: 'Candi Borobudur adalah peninggalan agama Budha.' },
  { id: 's53', subject: 'ips', category: 'Sejarah Indonesia', difficulty: 'sedang', text: 'Kerajaan Majapahit mencapai masa kejayaan pada masa pemerintahan...', options: ['Hayam Wuruk', 'Airlangga', 'Mulawarman', 'Purnawarman'], correct: 0, explanation: 'Majapahit berjaya pada masa Hayam Wuruk dengan bantuan Mahapatih Gajah Mada.' },
  { id: 's54', subject: 'ips', category: 'Keragaman Budaya', difficulty: 'mudah', text: 'Alat musik angklung berasal dari daerah...', options: ['Bali', 'Jawa Barat', 'Sumatra Barat', 'Papua'], correct: 1, explanation: 'Angklung merupakan alat musik tradisional Jawa Barat.' },
  { id: 's55', subject: 'ips', category: 'Peta Indonesia', difficulty: 'mudah', text: 'Gunung tertinggi di Indonesia adalah...', options: ['Semeru', 'Kerinci', 'Jayawijaya', 'Merapi'], correct: 2, explanation: 'Puncak Jayawijaya merupakan gunung tertinggi di Indonesia.' },
  { id: 's56', subject: 'ips', category: 'Globalisasi', difficulty: 'sedang', text: 'Internet mempermudah komunikasi antarnegara. Hal ini merupakan dampak globalisasi di bidang...', options: ['Transportasi', 'Komunikasi', 'Pertanian', 'Perikanan'], correct: 1, explanation: 'Globalisasi mempermudah komunikasi melalui internet.' },
  { id: 's57', subject: 'ips', category: 'Interaksi Sosial', difficulty: 'mudah', text: 'Saling membantu antarwarga disebut...', options: ['Persaingan', 'Gotong royong', 'Konflik', 'Individualisme'], correct: 1, explanation: 'Gotong royong adalah budaya saling membantu.' },
  { id: 's58', subject: 'ips', category: 'Ekonomi', difficulty: 'sedang', text: 'Kegiatan menyalurkan barang dari produsen ke konsumen disebut...', options: ['Produksi', 'Distribusi', 'Konsumsi', 'Ekspor'], correct: 1, explanation: 'Distribusi adalah kegiatan menyalurkan barang.' },
  { id: 's59', subject: 'ips', category: 'Ekspor Impor', difficulty: 'sedang', text: 'Membeli barang dari luar negeri disebut...', options: ['Ekspor', 'Produksi', 'Distribusi', 'Impor'], correct: 3, explanation: 'Impor adalah kegiatan membeli barang dari luar negeri.' },
  { id: 's60', subject: 'ips', category: 'ASEAN', difficulty: 'sedang', text: 'Negara ASEAN yang terkenal dengan julukan Negeri Gajah Putih adalah...', options: ['Vietnam', 'Thailand', 'Malaysia', 'Myanmar'], correct: 1, explanation: 'Thailand dikenal sebagai Negeri Gajah Putih.' },
  { id: 's61', subject: 'ips', category: 'Kenampakan Alam', difficulty: 'mudah', text: 'Sungai terpanjang di Indonesia adalah...', options: ['Kapuas', 'Musi', 'Bengawan Solo', 'Mahakam'], correct: 0, explanation: 'Sungai Kapuas di Kalimantan adalah sungai terpanjang di Indonesia.' },
  { id: 's62', subject: 'ips', category: 'Keragaman Budaya', difficulty: 'mudah', text: 'Lagu daerah “Ampar-Ampar Pisang” berasal dari...', options: ['Kalimantan Selatan', 'Aceh', 'Papua', 'Jawa Timur'], correct: 0, explanation: 'Ampar-Ampar Pisang berasal dari Kalimantan Selatan.' },
  { id: 's63', subject: 'ips', category: 'Tokoh Nasional', difficulty: 'sedang', text: 'Tokoh yang dikenal sebagai proklamator Indonesia adalah...', options: ['Soekarno dan Moh. Hatta', 'Sudirman dan Soeharto', 'Diponegoro dan Pattimura', 'Kartini dan Dewantara'], correct: 0, explanation: 'Soekarno dan Moh. Hatta adalah proklamator Indonesia.' },
  { id: 's64', subject: 'ips', category: 'Perjuangan Kemerdekaan', difficulty: 'sedang', text: 'Peristiwa Rengasdengklok terjadi sebelum...', options: ['Sumpah Pemuda', 'Proklamasi Kemerdekaan', 'Pertempuran Surabaya', 'Konferensi Asia Afrika'], correct: 1, explanation: 'Rengasdengklok terjadi sebelum Proklamasi Kemerdekaan Indonesia.' },
  { id: 's65', subject: 'ips', category: 'Keragaman Sosial', difficulty: 'mudah', text: 'Perbedaan suku bangsa di Indonesia harus disikapi dengan...', options: ['Permusuhan', 'Toleransi', 'Diskriminasi', 'Persaingan'], correct: 1, explanation: 'Perbedaan suku harus dihargai dengan sikap toleransi.' },
  { id: 's66', subject: 'ips', category: 'Sumber Daya Alam', difficulty: 'sedang', text: 'Hasil tambang berupa batu bara banyak ditemukan di daerah...', options: ['Kalimantan', 'Bali', 'NTB', 'Papua Barat'], correct: 0, explanation: 'Kalimantan merupakan salah satu penghasil batu bara terbesar.' },
  { id: 's67', subject: 'ips', category: 'Ekonomi Maritim', difficulty: 'mudah', text: 'Nelayan bekerja memanfaatkan sumber daya...', options: ['Hutan', 'Laut', 'Gunung', 'Sawah'], correct: 1, explanation: 'Nelayan memanfaatkan sumber daya laut.' },
  { id: 's68', subject: 'ips', category: 'Peta Indonesia', difficulty: 'sedang', text: 'Batas utara Indonesia adalah...', options: ['Australia', 'Samudra Hindia', 'Malaysia dan Filipina', 'Timor Leste'], correct: 2, explanation: 'Indonesia berbatasan di utara dengan Malaysia dan Filipina.' },
  { id: 's69', subject: 'ips', category: 'Globalisasi', difficulty: 'sedang', text: 'Menggunakan produk dalam negeri merupakan sikap menghadapi globalisasi dengan cara...', options: ['Menolak teknologi', 'Cinta produk lokal', 'Menutup diri', 'Menghindari perdagangan'], correct: 1, explanation: 'Cinta produk lokal adalah sikap positif menghadapi globalisasi.' },
  { id: 's70', subject: 'ips', category: 'Keragaman Budaya', difficulty: 'mudah', text: 'Tari Saman berasal dari...', options: ['Aceh', 'Bali', 'Papua', 'Lampung'], correct: 0, explanation: 'Tari Saman berasal dari Aceh.' },
  { id: 's71', subject: 'ips', category: 'Sejarah Indonesia', difficulty: 'sedang', text: 'Kerajaan Islam pertama di Indonesia adalah...', options: ['Demak', 'Samudra Pasai', 'Mataram', 'Banten'], correct: 1, explanation: 'Samudra Pasai dikenal sebagai kerajaan Islam pertama di Indonesia.' },
  { id: 's72', subject: 'ips', category: 'Kolonialisme', difficulty: 'sedang', text: 'Tanam Paksa diterapkan pada masa penjajahan...', options: ['Inggris', 'Portugis', 'Belanda', 'Jepang'], correct: 2, explanation: 'Tanam Paksa diterapkan oleh pemerintah kolonial Belanda.' },
  { id: 's73', subject: 'ips', category: 'Tokoh Pahlawan', difficulty: 'sedang', text: 'Pahlawan dari Maluku yang terkenal melawan Belanda adalah...', options: ['Pattimura', 'Cut Nyak Dien', 'Tuanku Imam Bonjol', 'Hasanuddin'], correct: 0, explanation: 'Kapitan Pattimura memimpin perlawanan rakyat Maluku.' },
  { id: 's74', subject: 'ips', category: 'Tokoh Pahlawan', difficulty: 'sedang', text: 'Cut Nyak Dien berasal dari daerah...', options: ['Aceh', 'Papua', 'Sulawesi', 'Bali'], correct: 0, explanation: 'Cut Nyak Dien adalah pahlawan perempuan dari Aceh.' },
  { id: 's75', subject: 'ips', category: 'Ekonomi', difficulty: 'mudah', text: 'Petani termasuk kegiatan ekonomi di bidang...', options: ['Jasa', 'Industri', 'Pertanian', 'Perdagangan'], correct: 2, explanation: 'Petani bekerja di bidang pertanian.' },
  { id: 's76', subject: 'ips', category: 'Ekonomi', difficulty: 'sedang', text: 'Pasar tradisional biasanya menggunakan sistem...', options: ['Lelang', 'Tawar-menawar', 'Online', 'Barter modern'], correct: 1, explanation: 'Pasar tradisional identik dengan tawar-menawar.' },
  { id: 's77', subject: 'ips', category: 'Gejala Alam', difficulty: 'sedang', text: 'Gempa bumi yang disebabkan aktivitas gunung api disebut gempa...', options: ['Tektonik', 'Vulkanik', 'Runtuhan', 'Lokal'], correct: 1, explanation: 'Gempa vulkanik disebabkan aktivitas gunung berapi.' },
  { id: 's78', subject: 'ips', category: 'Kenampakan Alam', difficulty: 'mudah', text: 'Daerah dataran rendah cocok digunakan untuk...', options: ['Perkebunan teh', 'Permukiman', 'Hutan pinus', 'Tambang emas'], correct: 1, explanation: 'Dataran rendah cocok untuk permukiman dan kegiatan ekonomi.' },
  { id: 's79', subject: 'ips', category: 'ASEAN', difficulty: 'sedang', text: 'Jumlah negara anggota ASEAN saat ini adalah...', options: ['8', '9', '10', '11'], correct: 2, explanation: 'ASEAN memiliki 10 negara anggota.' },
  { id: 's80', subject: 'ips', category: 'Perjuangan Kemerdekaan', difficulty: 'sedang', text: 'Peristiwa Sumpah Pemuda terjadi pada tahun...', options: ['1928', '1945', '1908', '1930'], correct: 0, explanation: 'Sumpah Pemuda terjadi pada 28 Oktober 1928.' },
  { id: 's81', subject: 'ips', category: 'Tokoh Nasional', difficulty: 'sedang', text: 'Dr. Soetomo dikenal sebagai pendiri organisasi...', options: ['Budi Utomo', 'Sarekat Islam', 'Indische Partij', 'PKI'], correct: 0, explanation: 'Dr. Soetomo mendirikan organisasi Budi Utomo.' },
  { id: 's82', subject: 'ips', category: 'Keragaman Budaya', difficulty: 'mudah', text: 'Senjata tradisional rencong berasal dari...', options: ['Papua', 'Aceh', 'Bali', 'Sulawesi'], correct: 1, explanation: 'Rencong adalah senjata tradisional Aceh.' },
  { id: 's83', subject: 'ips', category: 'Sumber Daya Alam', difficulty: 'sedang', text: 'Pemanfaatan hutan secara berlebihan dapat menyebabkan...', options: ['Kesuburan tanah', 'Banjir dan longsor', 'Udara sejuk', 'Hutan bertambah luas'], correct: 1, explanation: 'Penebangan liar dapat menyebabkan banjir dan longsor.' },
  { id: 's84', subject: 'ips', category: 'Ekonomi Global', difficulty: 'sulit', text: 'Kerja sama perdagangan antarnegara bertujuan untuk...', options: ['Membatasi barang', 'Meningkatkan kesejahteraan', 'Mengurangi produksi', 'Menutup pasar'], correct: 1, explanation: 'Kerja sama perdagangan dapat meningkatkan kesejahteraan negara.' },
  { id: 's85', subject: 'ips', category: 'Keragaman Sosial', difficulty: 'mudah', text: 'Sikap yang sesuai semboyan Bhinneka Tunggal Ika adalah...', options: ['Mementingkan suku sendiri', 'Menghargai perbedaan', 'Menolak budaya lain', 'Membatasi pergaulan'], correct: 1, explanation: 'Bhinneka Tunggal Ika berarti berbeda-beda tetapi tetap satu.' },
  { id: 's86', subject: 'ips', category: 'Sejarah Indonesia', difficulty: 'sedang', text: 'Candi Prambanan merupakan peninggalan agama...', options: ['Budha', 'Islam', 'Hindu', 'Kristen'], correct: 2, explanation: 'Prambanan adalah candi Hindu terbesar di Indonesia.' },
  { id: 's87', subject: 'ips', category: 'Kolonialisme', difficulty: 'sedang', text: 'Bangsa Jepang menjajah Indonesia pada tahun...', options: ['1942', '1928', '1908', '1945'], correct: 0, explanation: 'Jepang mulai menjajah Indonesia pada tahun 1942.' },
  { id: 's88', subject: 'ips', category: 'Tokoh Pahlawan', difficulty: 'sedang', text: 'Tuanku Imam Bonjol memimpin perang...', options: ['Aceh', 'Padri', 'Diponegoro', 'Banjar'], correct: 1, explanation: 'Tuanku Imam Bonjol memimpin Perang Padri.' },
  { id: 's89', subject: 'ips', category: 'Peta Indonesia', difficulty: 'sedang', text: 'Pulau Bali terkenal sebagai daerah tujuan...', options: ['Pertambangan', 'Pariwisata', 'Industri baja', 'Perkebunan teh'], correct: 1, explanation: 'Bali terkenal sebagai tujuan wisata dunia.' },
  { id: 's90', subject: 'ips', category: 'Interaksi Sosial', difficulty: 'mudah', text: 'Musyawarah dilakukan untuk mencapai...', options: ['Perselisihan', 'Keuntungan pribadi', 'Mufakat', 'Persaingan'], correct: 2, explanation: 'Musyawarah bertujuan mencapai mufakat.' },
  { id: 's91', subject: 'ips', category: 'Globalisasi', difficulty: 'sedang', text: 'Salah satu dampak negatif globalisasi adalah...', options: ['Kemajuan teknologi', 'Mudah mendapat informasi', 'Lunturnya budaya lokal', 'Perdagangan meningkat'], correct: 2, explanation: 'Globalisasi dapat menyebabkan budaya lokal mulai ditinggalkan.' },
  { id: 's92', subject: 'ips', category: 'Ekonomi', difficulty: 'mudah', text: 'Kegiatan membeli barang untuk memenuhi kebutuhan disebut...', options: ['Produksi', 'Distribusi', 'Konsumsi', 'Ekspor'], correct: 2, explanation: 'Konsumsi adalah kegiatan memakai barang atau jasa.' },
  { id: 's93', subject: 'ips', category: 'ASEAN', difficulty: 'sedang', text: 'Lambang ASEAN didominasi warna...', options: ['Hitam', 'Merah dan biru', 'Hijau', 'Ungu'], correct: 1, explanation: 'Lambang ASEAN didominasi warna merah dan biru.' },
  { id: 's94', subject: 'ips', category: 'Kenampakan Alam', difficulty: 'mudah', text: 'Gunung Merapi terletak di Pulau...', options: ['Sumatra', 'Kalimantan', 'Jawa', 'Sulawesi'], correct: 2, explanation: 'Gunung Merapi berada di Pulau Jawa.' },
  { id: 's95', subject: 'ips', category: 'Keragaman Budaya', difficulty: 'mudah', text: 'Batik ditetapkan UNESCO sebagai warisan budaya pada tahun...', options: ['2009', '2015', '1998', '2020'], correct: 0, explanation: 'UNESCO menetapkan batik sebagai warisan budaya dunia pada tahun 2009.' },
  { id: 's96', subject: 'ips', category: 'Tokoh Nasional', difficulty: 'sedang', text: 'Mohammad Hatta dikenal dengan julukan...', options: ['Bapak Koperasi', 'Bapak Pendidikan', 'Bapak Proklamasi', 'Bapak Pembangunan'], correct: 0, explanation: 'Mohammad Hatta dikenal sebagai Bapak Koperasi Indonesia.' },
  { id: 's97', subject: 'ips', category: 'Ekonomi Maritim', difficulty: 'sedang', text: 'Pelabuhan berfungsi sebagai tempat...', options: ['Bercocok tanam', 'Kapal berlabuh', 'Peternakan', 'Pembuatan pakaian'], correct: 1, explanation: 'Pelabuhan digunakan sebagai tempat kapal berlabuh.' },
  { id: 's98', subject: 'ips', category: 'Perjuangan Kemerdekaan', difficulty: 'sedang', text: 'Organisasi pemuda yang berperan dalam Sumpah Pemuda adalah...', options: ['VOC', 'Budi Utomo', 'Jong Java', 'PETA'], correct: 2, explanation: 'Jong Java adalah salah satu organisasi pemuda dalam Kongres Pemuda.' },
  { id: 's99', subject: 'ips', category: 'Keragaman Sosial', difficulty: 'mudah', text: 'Hidup rukun di sekolah dapat menciptakan suasana...', options: ['Tegang', 'Tidak nyaman', 'Damai', 'Persaingan'], correct: 2, explanation: 'Hidup rukun menciptakan suasana damai dan nyaman.' },
  { id: 's100', subject: 'ips', category: 'Ekonomi Global', difficulty: 'sulit', text: 'ASEAN melakukan kerja sama ekonomi untuk meningkatkan...', options: ['Permusuhan', 'Kesejahteraan masyarakat', 'Penjajahan', 'Persaingan antarnegara'], correct: 1, explanation: 'Kerja sama ekonomi ASEAN bertujuan meningkatkan kesejahteraan masyarakat.' },
  { id: 's101', subject: 'ips', category: 'Geografi', difficulty: 'mudah', text: 'Alat yang digunakan untuk menunjukkan arah mata angin adalah...', options: ['Barometer', 'Kompas', 'Termometer', 'Mikroskop'], correct: 1, explanation: 'Kompas digunakan untuk menentukan arah mata angin.' },
  { id: 's102', subject: 'ips', category: 'Keragaman Budaya', difficulty: 'mudah', text: 'Rumah adat Gadang berasal dari daerah...', options: ['Aceh', 'Minangkabau', 'Bali', 'Papua'], correct: 1, explanation: 'Rumah Gadang merupakan rumah adat masyarakat Minangkabau di Sumatra Barat.' },
  { id: 's103', subject: 'ips', category: 'Sejarah Indonesia', difficulty: 'sedang', text: 'Kerajaan Tarumanegara terletak di wilayah...', options: ['Jawa Barat', 'Jawa Tengah', 'Kalimantan', 'Sulawesi'], correct: 0, explanation: 'Kerajaan Tarumanegara berada di wilayah Jawa Barat.' },
  { id: 's104', subject: 'ips', category: 'Ekonomi', difficulty: 'mudah', text: 'Orang yang menyalurkan barang dari produsen ke konsumen disebut...', options: ['Konsumen', 'Distributor', 'Investor', 'Petani'], correct: 1, explanation: 'Distributor bertugas menyalurkan barang dari produsen ke konsumen.' },
  { id: 's105', subject: 'ips', category: 'Kenampakan Alam', difficulty: 'sedang', text: 'Selat yang memisahkan Pulau Jawa dan Sumatra adalah...', options: ['Selat Sunda', 'Selat Malaka', 'Selat Bali', 'Selat Makassar'], correct: 0, explanation: 'Selat Sunda memisahkan Pulau Jawa dan Sumatra.' },
  { id: 's106', subject: 'ips', category: 'Perjuangan Kemerdekaan', difficulty: 'sedang', text: 'Tokoh yang menjahit bendera pusaka Merah Putih adalah...', options: ['Fatmawati', 'Kartini', 'Cut Nyak Dien', 'Dewi Sartika'], correct: 0, explanation: 'Fatmawati menjahit bendera pusaka Merah Putih.' },
  { id: 's107', subject: 'ips', category: 'Keragaman Budaya', difficulty: 'mudah', text: 'Alat musik sasando berasal dari daerah...', options: ['NTT', 'Jawa Barat', 'Papua', 'Aceh'], correct: 0, explanation: 'Sasando berasal dari Nusa Tenggara Timur.' },
  { id: 's108', subject: 'ips', category: 'Ekonomi', difficulty: 'sedang', text: 'Tempat bertemunya penjual dan pembeli disebut...', options: ['Bank', 'Pasar', 'Pelabuhan', 'Gudang'], correct: 1, explanation: 'Pasar merupakan tempat bertemunya penjual dan pembeli.' },
  { id: 's109', subject: 'ips', category: 'ASEAN', difficulty: 'sedang', text: 'Negara anggota ASEAN yang berbentuk kepulauan selain Indonesia adalah...', options: ['Laos', 'Vietnam', 'Filipina', 'Myanmar'], correct: 2, explanation: 'Filipina merupakan negara kepulauan di Asia Tenggara.' },
  { id: 's110', subject: 'ips', category: 'Gejala Alam', difficulty: 'mudah', text: 'Peristiwa tanah bergerak turun dari lereng disebut...', options: ['Gempa', 'Longsor', 'Rob', 'Tsunami'], correct: 1, explanation: 'Longsor terjadi karena pergerakan tanah dari daerah tinggi.' },
  { id: 's111', subject: 'ips', category: 'Tokoh Nasional', difficulty: 'sedang', text: 'Ki Hajar Dewantara mendirikan sekolah bernama...', options: ['Budi Utomo', 'Taman Siswa', 'Muhammadiyah', 'Sarekat Islam'], correct: 1, explanation: 'Ki Hajar Dewantara mendirikan Perguruan Taman Siswa.' },
  { id: 's112', subject: 'ips', category: 'Peta Indonesia', difficulty: 'mudah', text: 'Ibu kota Provinsi Sumatra Utara adalah...', options: ['Padang', 'Pekanbaru', 'Medan', 'Palembang'], correct: 2, explanation: 'Medan adalah ibu kota Sumatra Utara.' },
  { id: 's113', subject: 'ips', category: 'Sumber Daya Alam', difficulty: 'sedang', text: 'Penangkapan ikan menggunakan bom dapat menyebabkan...', options: ['Laut bersih', 'Terumbu karang rusak', 'Ikan bertambah banyak', 'Air laut surut'], correct: 1, explanation: 'Bom ikan dapat merusak terumbu karang dan ekosistem laut.' },
  { id: 's114', subject: 'ips', category: 'Sejarah Dunia', difficulty: 'sulit', text: 'Organisasi dunia yang bergerak di bidang kesehatan adalah...', options: ['UNESCO', 'WHO', 'UNICEF', 'FAO'], correct: 1, explanation: 'WHO adalah organisasi kesehatan dunia di bawah PBB.' },
  { id: 's115', subject: 'ips', category: 'Keragaman Budaya', difficulty: 'mudah', text: 'Pakaian adat Ulee Balang berasal dari...', options: ['Aceh', 'Bali', 'Papua', 'Betawi'], correct: 0, explanation: 'Ulee Balang merupakan pakaian adat Aceh.' },
  { id: 's116', subject: 'ips', category: 'Ekonomi', difficulty: 'mudah', text: 'Kegiatan menjual jasa termasuk usaha di bidang...', options: ['Pertanian', 'Jasa', 'Perikanan', 'Pertambangan'], correct: 1, explanation: 'Usaha jasa menghasilkan layanan bagi masyarakat.' },
  { id: 's117', subject: 'ips', category: 'Perjuangan Kemerdekaan', difficulty: 'sedang', text: 'Lagu Indonesia Raya pertama kali diperdengarkan pada saat...', options: ['Proklamasi', 'Sumpah Pemuda', 'Hari Pahlawan', 'KAA'], correct: 1, explanation: 'Indonesia Raya diperdengarkan pertama kali saat Sumpah Pemuda 1928.' },
  { id: 's118', subject: 'ips', category: 'Geografi', difficulty: 'sedang', text: 'Garis bujur digunakan untuk menentukan...', options: ['Iklim', 'Waktu', 'Curah hujan', 'Musim'], correct: 1, explanation: 'Garis bujur digunakan untuk pembagian waktu dunia.' },
  { id: 's119', subject: 'ips', category: 'Kolonialisme', difficulty: 'sedang', text: 'Kerja rodi pada masa penjajahan dilakukan untuk membangun...', options: ['Sekolah', 'Jalan Anyer-Panarukan', 'Pelabuhan modern', 'Istana negara'], correct: 1, explanation: 'Daendels memerintahkan pembangunan Jalan Anyer-Panarukan dengan kerja rodi.' },
  { id: 's120', subject: 'ips', category: 'Interaksi Sosial', difficulty: 'mudah', text: 'Contoh sikap kerja sama di sekolah adalah...', options: ['Bertengkar', 'Piket bersama', 'Mengejek teman', 'Menyontek'], correct: 1, explanation: 'Piket bersama merupakan bentuk kerja sama.' },
  { id: 's121', subject: 'ips', category: 'Keragaman Budaya', difficulty: 'mudah', text: 'Tari Piring berasal dari...', options: ['Aceh', 'Papua', 'Sumatra Barat', 'Jawa Timur'], correct: 2, explanation: 'Tari Piring berasal dari Sumatra Barat.' },
  { id: 's122', subject: 'ips', category: 'Ekonomi', difficulty: 'sedang', text: 'Bank Indonesia berfungsi sebagai...', options: ['Bank Sentral', 'Pasar saham', 'Distributor', 'Produsen'], correct: 0, explanation: 'Bank Indonesia adalah bank sentral Republik Indonesia.' },
  { id: 's123', subject: 'ips', category: 'ASEAN', difficulty: 'sedang', text: 'Negara ASEAN yang tidak memiliki wilayah laut adalah...', options: ['Thailand', 'Vietnam', 'Laos', 'Malaysia'], correct: 2, explanation: 'Laos adalah negara yang terkurung daratan.' },
  { id: 's124', subject: 'ips', category: 'Tokoh Pahlawan', difficulty: 'sedang', text: 'Pahlawan nasional yang dijuluki Ayam Jantan dari Timur adalah...', options: ['Sultan Hasanuddin', 'Pattimura', 'Diponegoro', 'Teuku Umar'], correct: 0, explanation: 'Sultan Hasanuddin dijuluki Ayam Jantan dari Timur.' },
  { id: 's125', subject: 'ips', category: 'Peta Indonesia', difficulty: 'mudah', text: 'Provinsi paling barat di Indonesia adalah...', options: ['Aceh', 'Sumatra Barat', 'Banten', 'Riau'], correct: 0, explanation: 'Aceh berada di ujung barat Indonesia.' },
  { id: 's126', subject: 'ips', category: 'Gejala Alam', difficulty: 'sedang', text: 'Gelombang laut besar akibat gempa bawah laut disebut...', options: ['Rob', 'Abrasi', 'Tsunami', 'Badai'], correct: 2, explanation: 'Tsunami terjadi akibat gempa di dasar laut.' },
  { id: 's127', subject: 'ips', category: 'Sejarah Indonesia', difficulty: 'sedang', text: 'Semboyan Bhinneka Tunggal Ika berasal dari kitab...', options: ['Negarakertagama', 'Sutasoma', 'Pararaton', 'Arjunawiwaha'], correct: 1, explanation: 'Semboyan Bhinneka Tunggal Ika berasal dari Kitab Sutasoma karya Mpu Tantular.' },
  { id: 's128', subject: 'ips', category: 'Ekonomi', difficulty: 'mudah', text: 'Kegiatan menghasilkan padi dilakukan oleh...', options: ['Nelayan', 'Petani', 'Pedagang', 'Distributor'], correct: 1, explanation: 'Petani menghasilkan padi melalui kegiatan pertanian.' },
  { id: 's129', subject: 'ips', category: 'Keragaman Budaya', difficulty: 'mudah', text: 'Ondel-ondel merupakan budaya khas daerah...', options: ['Betawi', 'Bali', 'Madura', 'Aceh'], correct: 0, explanation: 'Ondel-ondel adalah budaya khas Betawi.' },
  { id: 's130', subject: 'ips', category: 'Tokoh Nasional', difficulty: 'sedang', text: 'Presiden pertama Republik Indonesia adalah...', options: ['Soeharto', 'Habibie', 'Soekarno', 'Megawati'], correct: 2, explanation: 'Ir. Soekarno adalah presiden pertama Indonesia.' },
  { id: 's131', subject: 'ips', category: 'ASEAN', difficulty: 'mudah', text: 'ASEAN didirikan pada tanggal...', options: ['8 Agustus 1967', '17 Agustus 1945', '28 Oktober 1928', '1 Juni 1945'], correct: 0, explanation: 'ASEAN berdiri pada 8 Agustus 1967.' },
  { id: 's132', subject: 'ips', category: 'Sumber Daya Alam', difficulty: 'sedang', text: 'Kegiatan menanam kembali hutan yang gundul disebut...', options: ['Abrasi', 'Reboisasi', 'Urbanisasi', 'Modernisasi'], correct: 1, explanation: 'Reboisasi adalah penanaman kembali hutan gundul.' },
  { id: 's133', subject: 'ips', category: 'Perjuangan Kemerdekaan', difficulty: 'sedang', text: 'Tokoh yang mengetik naskah proklamasi adalah...', options: ['Sayuti Melik', 'Sukarni', 'Chaerul Saleh', 'Laksamana Maeda'], correct: 0, explanation: 'Naskah proklamasi diketik oleh Sayuti Melik.' },
  { id: 's134', subject: 'ips', category: 'Geografi', difficulty: 'mudah', text: 'Benua terbesar di dunia adalah...', options: ['Afrika', 'Asia', 'Eropa', 'Australia'], correct: 1, explanation: 'Asia merupakan benua terbesar di dunia.' },
  { id: 's135', subject: 'ips', category: 'Keragaman Budaya', difficulty: 'mudah', text: 'Senjata tradisional kujang berasal dari...', options: ['Jawa Barat', 'Papua', 'Aceh', 'Bali'], correct: 0, explanation: 'Kujang adalah senjata tradisional Sunda di Jawa Barat.' },
  { id: 's136', subject: 'ips', category: 'Ekonomi', difficulty: 'sedang', text: 'Kenaikan harga barang secara terus-menerus disebut...', options: ['Deflasi', 'Inflasi', 'Produksi', 'Distribusi'], correct: 1, explanation: 'Inflasi adalah kenaikan harga barang secara umum dan terus-menerus.' },
  { id: 's137', subject: 'ips', category: 'Sejarah Indonesia', difficulty: 'sedang', text: 'Gajah Mada terkenal dengan sumpahnya yang disebut...', options: ['Sumpah Pemuda', 'Sumpah Palapa', 'Sumpah Prajurit', 'Sumpah Setia'], correct: 1, explanation: 'Gajah Mada mengucapkan Sumpah Palapa untuk mempersatukan Nusantara.' },
  { id: 's138', subject: 'ips', category: 'Interaksi Sosial', difficulty: 'mudah', text: 'Sikap mau mendengar pendapat orang lain mencerminkan...', options: ['Egois', 'Toleransi', 'Kemarahan', 'Perselisihan'], correct: 1, explanation: 'Menghargai pendapat orang lain adalah sikap toleransi.' },
  { id: 's139', subject: 'ips', category: 'Peta Indonesia', difficulty: 'mudah', text: 'Ibu kota Provinsi Jawa Barat adalah...', options: ['Bandung', 'Bogor', 'Bekasi', 'Cirebon'], correct: 0, explanation: 'Bandung adalah ibu kota Provinsi Jawa Barat.' },
  { id: 's140', subject: 'ips', category: 'Tokoh Pahlawan', difficulty: 'sedang', text: 'Pahlawan wanita dari Jawa Barat yang mendirikan sekolah untuk perempuan adalah...', options: ['Dewi Sartika', 'Kartini', 'Cut Nyak Dien', 'Martha Christina Tiahahu'], correct: 0, explanation: 'Dewi Sartika mendirikan sekolah khusus perempuan di Jawa Barat.' },
  { id: 's141', subject: 'ips', category: 'Gejala Alam', difficulty: 'mudah', text: 'Musim kemarau di Indonesia biasanya terjadi pada bulan...', options: ['April–Oktober', 'November–Maret', 'Januari–Februari', 'September–Desember'], correct: 0, explanation: 'Musim kemarau biasanya berlangsung sekitar April hingga Oktober.' },
  { id: 's142', subject: 'ips', category: 'Ekonomi Maritim', difficulty: 'sedang', text: 'Tambak garam banyak ditemukan di daerah...', options: ['Pegunungan', 'Pantai', 'Hutan', 'Perkotaan'], correct: 1, explanation: 'Tambak garam dibuat di daerah pantai yang panas.' },
  { id: 's143', subject: 'ips', category: 'ASEAN', difficulty: 'sedang', text: 'Mata uang negara Thailand adalah...', options: ['Ringgit', 'Baht', 'Peso', 'Dong'], correct: 1, explanation: 'Baht adalah mata uang resmi Thailand.' },
  { id: 's144', subject: 'ips', category: 'Keragaman Budaya', difficulty: 'mudah', text: 'Tari Jaipong berasal dari daerah...', options: ['Jawa Tengah', 'Jawa Barat', 'Bali', 'NTT'], correct: 1, explanation: 'Tari Jaipong berasal dari Jawa Barat.' },
  { id: 's145', subject: 'ips', category: 'Perjuangan Kemerdekaan', difficulty: 'sedang', text: 'Hari Kebangkitan Nasional diperingati setiap tanggal...', options: ['20 Mei', '10 November', '17 Agustus', '28 Oktober'], correct: 0, explanation: 'Hari Kebangkitan Nasional diperingati setiap 20 Mei.' },
  { id: 's146', subject: 'ips', category: 'Sumber Daya Alam', difficulty: 'mudah', text: 'Emas termasuk sumber daya alam yang dapat...', options: ['Diperbarui', 'Didaur ulang alami', 'Habis', 'Ditumbuhkan'], correct: 2, explanation: 'Emas adalah sumber daya alam yang tidak dapat diperbarui.' },
  { id: 's147', subject: 'ips', category: 'Sejarah Indonesia', difficulty: 'sulit', text: 'Kitab Negarakertagama ditulis oleh...', options: ['Mpu Tantular', 'Mpu Prapanca', 'Empu Kanwa', 'Gajah Mada'], correct: 1, explanation: 'Kitab Negarakertagama ditulis oleh Mpu Prapanca.' },
  { id: 's148', subject: 'ips', category: 'Ekonomi', difficulty: 'mudah', text: 'Kegiatan menjual sayur di pasar termasuk pekerjaan...', options: ['Petani', 'Pedagang', 'Nelayan', 'Peternak'], correct: 1, explanation: 'Pedagang adalah orang yang menjual barang kepada konsumen.' },
  { id: 's149', subject: 'ips', category: 'Keragaman Sosial', difficulty: 'mudah', text: 'Menghormati teman yang berbeda agama merupakan contoh sikap...', options: ['Fanatik', 'Diskriminasi', 'Toleransi', 'Egois'], correct: 2, explanation: 'Menghormati perbedaan agama adalah bentuk toleransi.' },
  { id: 's150', subject: 'ips', category: 'Tokoh Nasional', difficulty: 'sedang', text: 'Wakil Presiden pertama Indonesia adalah...', options: ['Soedirman', 'Mohammad Hatta', 'Sutan Sjahrir', 'Ahmad Yani'], correct: 1, explanation: 'Mohammad Hatta adalah Wakil Presiden pertama Republik Indonesia.' },
  { id: 's151', subject: 'ips', category: 'Geografi', difficulty: 'sedang', text: 'Benua terbesar di dunia adalah...', options: ['Afrika', 'Asia', 'Eropa', 'Amerika'], correct: 1, explanation: 'Asia merupakan benua terbesar di dunia berdasarkan luas wilayah.' },
  { id: 's152', subject: 'ips', category: 'Keragaman Budaya', difficulty: 'mudah', text: 'Rumah adat Gadang berasal dari daerah...', options: ['Sumatra Barat', 'Aceh', 'Riau', 'Lampung'], correct: 0, explanation: 'Rumah Gadang adalah rumah adat khas Minangkabau dari Sumatra Barat.' },
  { id: 's153', subject: 'ips', category: 'Ekonomi', difficulty: 'sedang', text: 'Kegiatan menghasilkan barang dan jasa disebut...', options: ['Konsumsi', 'Distribusi', 'Produksi', 'Impor'], correct: 2, explanation: 'Produksi adalah kegiatan menghasilkan barang atau jasa untuk memenuhi kebutuhan manusia.' },
  { id: 's154', subject: 'ips', category: 'Sejarah Indonesia', difficulty: 'mudah', text: 'Tokoh yang menjahit bendera Merah Putih saat proklamasi adalah...', options: ['Fatmawati', 'Kartini', 'Cut Nyak Dien', 'Dewi Sartika'], correct: 0, explanation: 'Fatmawati menjahit bendera pusaka Merah Putih.' },
  { id: 's155', subject: 'ips', category: 'Keragaman Sosial', difficulty: 'mudah', text: 'Menghormati teman yang berbeda agama merupakan contoh sikap...', options: ['Diskriminasi', 'Toleransi', 'Egois', 'Fanatik'], correct: 1, explanation: 'Menghormati perbedaan agama termasuk sikap toleransi.' },
  { id: 's156', subject: 'ips', category: 'Peta Indonesia', difficulty: 'sedang', text: 'Provinsi paling barat di Indonesia adalah...', options: ['Aceh', 'Papua', 'Banten', 'Sumatra Barat'], correct: 0, explanation: 'Aceh terletak di ujung barat wilayah Indonesia.' },
  { id: 's157', subject: 'ips', category: 'Globalisasi', difficulty: 'sedang', text: 'Belanja menggunakan aplikasi online merupakan contoh perkembangan di bidang...', options: ['Transportasi', 'Komunikasi', 'Perdagangan', 'Pertanian'], correct: 2, explanation: 'Belanja online termasuk perkembangan perdagangan akibat globalisasi.' },
  { id: 's158', subject: 'ips', category: 'Tokoh Pahlawan', difficulty: 'sedang', text: 'Pahlawan wanita dari Jawa Barat yang memperjuangkan pendidikan perempuan adalah...', options: ['Dewi Sartika', 'Cut Nyak Dien', 'Martha Christina Tiahahu', 'R.A. Kartini'], correct: 0, explanation: 'Dewi Sartika mendirikan sekolah untuk perempuan di Jawa Barat.' },
  { id: 's159', subject: 'ips', category: 'Kenampakan Alam', difficulty: 'mudah', text: 'Laut yang berada di antara Pulau Jawa dan Kalimantan adalah...', options: ['Laut Banda', 'Laut Jawa', 'Laut Flores', 'Laut Sulawesi'], correct: 1, explanation: 'Laut Jawa terletak di antara Pulau Jawa dan Kalimantan.' },
  { id: 's160', subject: 'ips', category: 'Ekonomi', difficulty: 'mudah', text: 'Orang yang menyalurkan barang dari produsen ke konsumen disebut...', options: ['Konsumen', 'Distributor', 'Investor', 'Petani'], correct: 1, explanation: 'Distributor bertugas menyalurkan barang dari produsen ke konsumen.' },
  { id: 's161', subject: 'ips', category: 'ASEAN', difficulty: 'sedang', text: 'Negara anggota ASEAN yang berbentuk kepulauan selain Indonesia adalah...', options: ['Laos', 'Vietnam', 'Filipina', 'Thailand'], correct: 2, explanation: 'Filipina merupakan negara kepulauan di Asia Tenggara.' },
  { id: 's162', subject: 'ips', category: 'Keragaman Budaya', difficulty: 'mudah', text: 'Alat musik sasando berasal dari...', options: ['Papua', 'NTT', 'Jawa Tengah', 'Bali'], correct: 1, explanation: 'Sasando adalah alat musik tradisional dari Nusa Tenggara Timur.' },
  { id: 's163', subject: 'ips', category: 'Perjuangan Kemerdekaan', difficulty: 'sedang', text: 'Tujuan dibentuknya BPUPKI adalah...', options: ['Mempersiapkan kemerdekaan Indonesia', 'Mengusir Jepang', 'Membentuk ASEAN', 'Menyusun kabinet'], correct: 0, explanation: 'BPUPKI dibentuk untuk mempersiapkan kemerdekaan Indonesia.' },
  { id: 's164', subject: 'ips', category: 'Kolonialisme', difficulty: 'sedang', text: 'Kerja rodi pada masa penjajahan dilakukan secara...', options: ['Sukarela', 'Paksa', 'Bergilir', 'Bebas'], correct: 1, explanation: 'Kerja rodi adalah kerja paksa yang diterapkan penjajah.' },
  { id: 's165', subject: 'ips', category: 'Geografi', difficulty: 'mudah', text: 'Alat untuk menunjukkan arah mata angin adalah...', options: ['Barometer', 'Kompas', 'Termometer', 'Mikroskop'], correct: 1, explanation: 'Kompas digunakan untuk menunjukkan arah mata angin.' },
  { id: 's166', subject: 'ips', category: 'Sumber Daya Alam', difficulty: 'sedang', text: 'Pemanfaatan energi matahari menggunakan...', options: ['Panel surya', 'Turbin air', 'Kincir angin', 'Generator diesel'], correct: 0, explanation: 'Panel surya mengubah energi matahari menjadi listrik.' },
  { id: 's167', subject: 'ips', category: 'Keragaman Budaya', difficulty: 'mudah', text: 'Upacara Ngaben berasal dari daerah...', options: ['Aceh', 'Bali', 'Papua', 'Maluku'], correct: 1, explanation: 'Ngaben adalah upacara pembakaran jenazah masyarakat Hindu Bali.' },
  { id: 's168', subject: 'ips', category: 'Ekonomi', difficulty: 'sedang', text: 'Kenaikan harga barang secara terus-menerus disebut...', options: ['Deflasi', 'Inflasi', 'Produksi', 'Distribusi'], correct: 1, explanation: 'Inflasi adalah kenaikan harga barang secara umum dan terus-menerus.' },
  { id: 's169', subject: 'ips', category: 'Peta Indonesia', difficulty: 'mudah', text: 'Pulau Komodo berada di provinsi...', options: ['NTB', 'NTT', 'Bali', 'Maluku'], correct: 1, explanation: 'Pulau Komodo berada di Provinsi Nusa Tenggara Timur.' },
  { id: 's170', subject: 'ips', category: 'Tokoh Nasional', difficulty: 'sedang', text: 'Presiden pertama Republik Indonesia adalah...', options: ['Soeharto', 'B.J. Habibie', 'Soekarno', 'Megawati'], correct: 2, explanation: 'Ir. Soekarno adalah presiden pertama Republik Indonesia.' },
  { id: 's171', subject: 'ips', category: 'Sejarah Indonesia', difficulty: 'sedang', text: 'Kerajaan Tarumanegara berada di wilayah...', options: ['Jawa Barat', 'Jawa Timur', 'Sumatra', 'Kalimantan'], correct: 0, explanation: 'Kerajaan Tarumanegara berkembang di wilayah Jawa Barat.' },
  { id: 's172', subject: 'ips', category: 'Interaksi Sosial', difficulty: 'mudah', text: 'Saling menghormati saat musyawarah akan menciptakan...', options: ['Keributan', 'Persatuan', 'Permusuhan', 'Persaingan'], correct: 1, explanation: 'Musyawarah yang baik dapat menciptakan persatuan.' },
  { id: 's173', subject: 'ips', category: 'ASEAN', difficulty: 'sedang', text: 'ASEAN didirikan pada tanggal...', options: ['8 Agustus 1967', '17 Agustus 1945', '1 Juni 1945', '28 Oktober 1928'], correct: 0, explanation: 'ASEAN didirikan pada 8 Agustus 1967 di Bangkok.' },
  { id: 's174', subject: 'ips', category: 'Keragaman Budaya', difficulty: 'mudah', text: 'Wayang kulit berasal dari daerah...', options: ['Papua', 'Jawa', 'Sulawesi', 'Maluku'], correct: 1, explanation: 'Wayang kulit merupakan budaya tradisional dari Jawa.' },
  { id: 's175', subject: 'ips', category: 'Ekonomi Maritim', difficulty: 'sedang', text: 'Tambak garam biasanya banyak ditemukan di daerah...', options: ['Pegunungan', 'Pantai', 'Hutan', 'Perkotaan'], correct: 1, explanation: 'Tambak garam banyak ditemukan di wilayah pantai.' },
  { id: 's176', subject: 'ips', category: 'Perjuangan Kemerdekaan', difficulty: 'sedang', text: 'Hari Kebangkitan Nasional diperingati setiap tanggal...', options: ['20 Mei', '17 Agustus', '10 November', '28 Oktober'], correct: 0, explanation: '20 Mei diperingati sebagai Hari Kebangkitan Nasional.' },
  { id: 's177', subject: 'ips', category: 'Tokoh Pahlawan', difficulty: 'sedang', text: 'Pahlawan yang dikenal dengan julukan Ayam Jantan dari Timur adalah...', options: ['Hasanuddin', 'Diponegoro', 'Pattimura', 'Sudirman'], correct: 0, explanation: 'Sultan Hasanuddin dijuluki Ayam Jantan dari Timur.' },
  { id: 's178', subject: 'ips', category: 'Gejala Alam', difficulty: 'sedang', text: 'Tanah longsor sering terjadi di daerah...', options: ['Pantai', 'Pegunungan', 'Laut', 'Padang pasir'], correct: 1, explanation: 'Daerah pegunungan yang curam rawan longsor.' },
  { id: 's179', subject: 'ips', category: 'Globalisasi', difficulty: 'mudah', text: 'Televisi dan internet merupakan media...', options: ['Transportasi', 'Komunikasi', 'Produksi', 'Distribusi'], correct: 1, explanation: 'Televisi dan internet termasuk media komunikasi.' },
  { id: 's180', subject: 'ips', category: 'Ekonomi', difficulty: 'mudah', text: 'Kegiatan menjual barang di pasar dilakukan oleh...', options: ['Petani', 'Pedagang', 'Nelayan', 'Guru'], correct: 1, explanation: 'Pedagang menjual barang kepada konsumen di pasar.' },
  { id: 's181', subject: 'ips', category: 'Keragaman Budaya', difficulty: 'mudah', text: 'Rumah adat Gadang berasal dari daerah...', options: ['Aceh', 'Sumatra Barat', 'Jawa Tengah', 'Bali'], correct: 1, explanation: 'Rumah Gadang merupakan rumah adat khas Minangkabau di Sumatra Barat.' },
  { id: 's182', subject: 'ips', category: 'Geografi', difficulty: 'sedang', text: 'Selat yang memisahkan Pulau Jawa dan Pulau Sumatra adalah...', options: ['Selat Sunda', 'Selat Bali', 'Selat Makassar', 'Selat Karimata'], correct: 0, explanation: 'Selat Sunda berada di antara Pulau Jawa dan Sumatra.' },
  { id: 's183', subject: 'ips', category: 'Ekonomi', difficulty: 'mudah', text: 'Orang atau badan yang menyalurkan barang dari produsen ke konsumen disebut...', options: ['Konsumen', 'Distributor', 'Investor', 'Produsen'], correct: 1, explanation: 'Distributor bertugas menyalurkan barang dari produsen ke konsumen.' },
  { id: 's184', subject: 'ips', category: 'Perjuangan Kemerdekaan', difficulty: 'sedang', text: 'Tokoh yang menjahit bendera pusaka Merah Putih adalah...', options: ['Fatmawati', 'Kartini', 'Cut Nyak Dien', 'Dewi Sartika'], correct: 0, explanation: 'Fatmawati menjahit bendera pusaka Merah Putih.' },
  { id: 's185', subject: 'ips', category: 'ASEAN', difficulty: 'sedang', text: 'Negara ASEAN yang berbentuk kepulauan dan tidak memiliki daratan utama adalah...', options: ['Laos', 'Singapura', 'Indonesia', 'Filipina'], correct: 3, explanation: 'Filipina merupakan negara kepulauan di Asia Tenggara.' },
  { id: 's186', subject: 'ips', category: 'Kenampakan Alam', difficulty: 'mudah', text: 'Daerah pegunungan memiliki udara yang biasanya...', options: ['Panas', 'Sejuk', 'Kering', 'Lembap'], correct: 1, explanation: 'Pegunungan memiliki suhu udara yang lebih sejuk.' },
  { id: 's187', subject: 'ips', category: 'Sejarah Indonesia', difficulty: 'sedang', text: 'Gajah Mada terkenal dengan sumpahnya yang disebut...', options: ['Sumpah Pemuda', 'Sumpah Palapa', 'Sumpah Setia', 'Sumpah Prajurit'], correct: 1, explanation: 'Mahapatih Gajah Mada mengucapkan Sumpah Palapa untuk mempersatukan Nusantara.' },
  { id: 's188', subject: 'ips', category: 'Globalisasi', difficulty: 'mudah', text: 'Kemudahan berbelanja melalui internet disebut...', options: ['Urbanisasi', 'E-commerce', 'Industrialisasi', 'Migrasi'], correct: 1, explanation: 'E-commerce adalah kegiatan jual beli secara online.' },
  { id: 's189', subject: 'ips', category: 'Ekonomi', difficulty: 'sedang', text: 'Kegiatan menghasilkan jasa termasuk kegiatan...', options: ['Produksi', 'Distribusi', 'Konsumsi', 'Ekspor'], correct: 0, explanation: 'Produksi tidak hanya menghasilkan barang tetapi juga jasa.' },
  { id: 's190', subject: 'ips', category: 'Tokoh Nasional', difficulty: 'mudah', text: 'Ki Hajar Dewantara dikenal sebagai pelopor bidang...', options: ['Perdagangan', 'Pendidikan', 'Militer', 'Pertanian'], correct: 1, explanation: 'Ki Hajar Dewantara adalah pelopor pendidikan nasional.' },
  { id: 's191', subject: 'ips', category: 'Keragaman Budaya', difficulty: 'mudah', text: 'Alat musik sasando berasal dari daerah...', options: ['NTT', 'Aceh', 'Papua', 'Bali'], correct: 0, explanation: 'Sasando berasal dari Pulau Rote, Nusa Tenggara Timur.' },
  { id: 's192', subject: 'ips', category: 'Geografi', difficulty: 'sedang', text: 'Benua terbesar di dunia adalah...', options: ['Afrika', 'Asia', 'Eropa', 'Amerika'], correct: 1, explanation: 'Asia merupakan benua terbesar di dunia.' },
  { id: 's193', subject: 'ips', category: 'Kolonialisme', difficulty: 'sedang', text: 'Tujuan utama bangsa Eropa datang ke Indonesia adalah mencari...', options: ['Rempah-rempah', 'Emas', 'Pakaian', 'Kayu'], correct: 0, explanation: 'Bangsa Eropa datang untuk mencari rempah-rempah yang sangat mahal di Eropa.' },
  { id: 's194', subject: 'ips', category: 'Interaksi Sosial', difficulty: 'mudah', text: 'Sikap mau mendengarkan pendapat orang lain merupakan contoh...', options: ['Egois', 'Toleransi', 'Diskriminasi', 'Permusuhan'], correct: 1, explanation: 'Mendengarkan pendapat orang lain adalah bentuk toleransi.' },
  { id: 's195', subject: 'ips', category: 'Ekonomi Maritim', difficulty: 'sedang', text: 'Tambak garam biasanya banyak ditemukan di daerah...', options: ['Pegunungan', 'Pantai', 'Hutan', 'Dataran tinggi'], correct: 1, explanation: 'Tambak garam banyak terdapat di daerah pantai.' },
  { id: 's196', subject: 'ips', category: 'Perjuangan Kemerdekaan', difficulty: 'sedang', text: 'Hari Kesaktian Pancasila diperingati setiap tanggal...', options: ['1 Juni', '17 Agustus', '1 Oktober', '10 November'], correct: 2, explanation: 'Hari Kesaktian Pancasila diperingati setiap 1 Oktober.' },
  { id: 's197', subject: 'ips', category: 'Keragaman Budaya', difficulty: 'mudah', text: 'Pakaian adat Ulos berasal dari suku...', options: ['Bugis', 'Batak', 'Jawa', 'Dayak'], correct: 1, explanation: 'Ulos merupakan kain tradisional khas suku Batak.' },
  { id: 's198', subject: 'ips', category: 'ASEAN', difficulty: 'sedang', text: 'Negara ASEAN yang tidak memiliki wilayah laut adalah...', options: ['Vietnam', 'Thailand', 'Laos', 'Filipina'], correct: 2, explanation: 'Laos merupakan negara yang terkurung daratan (landlocked).' },
  { id: 's199', subject: 'ips', category: 'Sumber Daya Alam', difficulty: 'sedang', text: 'Kegiatan menanam pohon kembali untuk mencegah kerusakan hutan disebut...', options: ['Eksploitasi', 'Urbanisasi', 'Reboisasi', 'Industrialisasi'], correct: 2, explanation: 'Reboisasi adalah penanaman kembali hutan yang gundul.' },
  { id: 's200', subject: 'ips', category: 'Tokoh Nasional', difficulty: 'sedang', text: 'Presiden pertama Republik Indonesia adalah...', options: ['Soeharto', 'B.J. Habibie', 'Soekarno', 'Megawati'], correct: 2, explanation: 'Ir. Soekarno adalah Presiden pertama Republik Indonesia.' }
];

// ==========================================
// 2. SISTEM AUDIO EFEK (Web Audio API)
// ==========================================
let audioCtx = null;
const playSound = (type) => {
  try {
    if (!audioCtx) {
      const AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      audioCtx = new AudioContext();
    }
    
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    if (type === 'click') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'correct') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(400, audioCtx.currentTime);
      osc.frequency.setValueAtTime(600, audioCtx.currentTime + 0.1);
      osc.frequency.setValueAtTime(1000, audioCtx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    } else if (type === 'wrong') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    } else if (type === 'win') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); 
      osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.15); 
      osc.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.3); 
      osc.frequency.setValueAtTime(1046.50, audioCtx.currentTime + 0.45); 
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.8);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.8);
    }
  } catch (e) {
    console.log("Audio skipped", e);
  }
};

// ==========================================
// 2.5 SISTEM VOICE OVER (Text-to-Speech Instan)
// ==========================================
const stopVoiceOver = () => {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
};

const speakText = (text) => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  
  window.speechSynthesis.cancel(); 

  setTimeout(() => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'id-ID'; 
    utterance.rate = 0.9; 
    utterance.pitch = 1.1; 
    
    const voices = window.speechSynthesis.getVoices();
    const idVoice = voices.find(v => v.lang.includes('id'));
    if (idVoice) {
      utterance.voice = idVoice;
    }

    window.speechSynthesis.speak(utterance);
  }, 50);
};

// ==========================================
// 3. KOMPONEN UI & ANIMASI
// ==========================================
const IconMath = () => <span className="text-5xl">🧮</span>;
const IconIpa = () => <span className="text-5xl">🧬</span>;
const IconIps = () => <span className="text-5xl">🌍</span>;
const IconHeart = ({ active }: any) => <span className={`text-2xl transition-all duration-300 ${active ? 'opacity-100 scale-100 drop-shadow-md' : 'opacity-20 scale-75 grayscale'}`}>❤️</span>;

const Mascot = ({ mood = 'happy', text }: { mood?: string, text?: any }) => {
  const faces = { happy: '🦉', thinking: '🧐', sad: '🥺', excited: '🤩', cool: '😎', welcome: '👋' };
  return (
    <div className="flex flex-col items-center animate-float">
      <div className="text-7xl drop-shadow-2xl transition-transform hover:scale-110 cursor-pointer">{faces[mood]}</div>
      {text && (
        <div className="bg-white dark:bg-gray-800 text-gray-800 dark:text-white px-5 py-3 rounded-2xl shadow-xl text-sm md:text-base font-bold mt-3 relative border-2 border-indigo-400 max-w-xs text-center animate-fade-in-up">
          <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-b-[10px] border-b-indigo-400"></div>
          {text}
        </div>
      )}
    </div>
  );
};

const Confetti = () => {
  const [particles, setParticles] = useState([]);
  useEffect(() => {
    const colors = ['bg-red-500', 'bg-blue-500', 'bg-yellow-400', 'bg-green-500', 'bg-purple-500', 'bg-pink-500'];
    const newParticles = Array.from({ length: 80 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100 + 'vw',
      animationDuration: (Math.random() * 3 + 2) + 's',
      animationDelay: Math.random() * 2 + 's',
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 12 + 6 + 'px',
      shape: Math.random() > 0.5 ? 'rounded-full' : 'rounded-sm'
    }));
    setParticles(newParticles);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
      {particles.map(p => (
        <div key={p.id} className={`absolute ${p.shape} ${p.color} animate-fall shadow-lg`}
          style={{ left: p.left, top: '-20px', width: p.size, height: p.size, animationDuration: p.animationDuration, animationDelay: p.animationDelay }}
        />
      ))}
    </div>
  );
};

// ==========================================
// 4. APLIKASI UTAMA
// ==========================================
export default function App() {
  const [currentScreen, setCurrentScreen] = useState('login');
  const [darkMode, setDarkMode] = useState(false);
  
  const [userProfile, setUserProfile] = useState({ name: '', school: '', grade: '' });
  
  const [subject, setSubject] = useState(null);
  const [modeCount, setModeCount] = useState(10);
  const [difficulty, setDifficulty] = useState('campuran');
  
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showExplanation, setShowExplanation] = useState(false);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(5);
  const [timeLeft, setTimeLeft] = useState(0);
  const [timeSpent, setTimeSpent] = useState(0);

  const [usedFiftyFifty, setUsedFiftyFifty] = useState(false);
  const [usedBonus, setUsedBonus] = useState(false);
  const [hiddenOptions, setHiddenOptions] = useState<number[]>([]);
  
  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);
  const [leaderboardSubject, setLeaderboardSubject] = useState<string>('SEMUA');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fb, setFb] = useState<any>(null);
  const [firebaseUser, setFirebaseUser] = useState<any>(null);

  // Helper for Firestore Error Handling
  const handleFirestoreError = useCallback((error: unknown, operationType: OperationType, path: string | null) => {
    const errInfo: FirestoreErrorInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
      },
      operationType,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  }, []);

  // Inisialisasi Firebase
  useEffect(() => {
    let isMounted = true;
    
    if (!auth) return;

    const initFirebase = async () => {
      try {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
          if (isMounted) setFirebaseUser(user);
        });

        try {
          if (!auth.currentUser) {
            await signInAnonymously(auth);
          }
        } catch (authError: any) {
          if (authError.code === 'auth/admin-restricted-operation') {
            console.warn("Anonymous Auth is disabled in Firebase Console. Leaderboard submission will require enabling it.");
          } else {
            console.error("Auth error:", authError);
          }
        }

        if (isMounted) {
          setFb({ db });
        }

        return unsubscribe;
      } catch (error) {
        console.error("Gagal inisialisasi Firebase:", error);
      }
    };
    
    const unsubPromise = initFirebase();
    return () => {
      isMounted = false;
      unsubPromise.then(unsub => unsub && unsub());
    };
  }, []);

  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      @keyframes fall { 0% { transform: translateY(-20px) rotate(0deg); opacity: 1; } 100% { transform: translateY(100vh) rotate(720deg); opacity: 0; } }
      @keyframes float { 0% { transform: translateY(0px); } 50% { transform: translateY(-15px); } 100% { transform: translateY(0px); } }
      @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      .animate-fall { animation: fall linear forwards; }
      .animate-float { animation: float 4s ease-in-out infinite; }
      .animate-fade-in-up { animation: fadeInUp 0.5s ease-out forwards; }
      .glass-panel { background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,0.4); }
      .dark .glass-panel { background: rgba(17, 24, 39, 0.8); border: 1px solid rgba(255,255,255,0.05); }
      .custom-scrollbar::-webkit-scrollbar { width: 8px; }
      .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
      .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
      .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #475569; }
    `;
    document.head.appendChild(style);
    
    const savedProfile = localStorage.getItem('osn_profile');
    if (savedProfile) {
      setUserProfile(JSON.parse(savedProfile));
      setCurrentScreen('home');
    }

    return () => document.head.removeChild(style);
  }, []);

  useEffect(() => {
    if (!fb) return;
    
    const { db } = fb;
    const lbPath = 'leaderboard';
    const lbRef = collection(db, lbPath);
    
    let q;
    if (leaderboardSubject === 'SEMUA') {
      q = query(lbRef, orderBy('score', 'desc'), limit(50));
    } else {
      q = query(lbRef, where('subject', '==', leaderboardSubject), orderBy('score', 'desc'), limit(50));
    }

    const unsubscribeLb = onSnapshot(q, 
      (snapshot) => {
        if (snapshot && snapshot.docs) {
          const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          // Urutkan berdasarkan skor tertinggi, jika seri maka berdasarkan waktu tercepat
          data.sort((a: any, b: any) => b.score - a.score || a.timeSpent - b.timeSpent);
          setLeaderboardData(data as any);
        }
      },
      (error) => handleFirestoreError(error, OperationType.LIST, lbPath)
    );

    return () => unsubscribeLb();
  }, [fb, leaderboardSubject]);

  useEffect(() => {
    let timer;
    if (currentScreen === 'quiz' && timeLeft > 0 && !showExplanation) {
      timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            handleTimeUp();
            return 0;
          }
          return prev - 1;
        });
        setTimeSpent(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [currentScreen, timeLeft, showExplanation]);

  // Efek Voice Over saat pertama kali membuka aplikasi (Halaman Login)
  useEffect(() => {
    if (currentScreen === 'login') {
      // Memberikan sedikit jeda 1 detik agar halaman selesai dimuat
      // dan browser siap menjalankan Voice Over
      setTimeout(() => {
        speakText("Selamat datang, Calon Juara O S N! Silakan isi data profil kamu untuk mulai belajar.");
      }, 1000);
    }
  }, [currentScreen]);

  const handleTimeUp = () => {
    finishQuiz(true);
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (!userProfile.name || !userProfile.school) return alert("Nama dan Sekolah wajib diisi!");
    playSound('click');
    localStorage.setItem('osn_profile', JSON.stringify(userProfile));
    setCurrentScreen('home');
    
    speakText(`Selamat datang, ${userProfile.name}! Bersiaplah untuk menjadi juara O S N 2026.`);
  };

  const startQuiz = () => {
    playSound('click');
    
    let pool = questionBank.filter(q => q.subject === subject);
    if (difficulty !== 'campuran') {
      pool = pool.filter(q => q.difficulty === difficulty);
    }
    
    if (pool.length === 0) {
      alert("Maaf, soal untuk kategori ini sedang disiapkan.");
      return;
    }

    pool = pool.sort(() => 0.5 - Math.random());
    
    let selectedQuestions = pool.slice(0, modeCount);
    while (selectedQuestions.length < modeCount && pool.length > 0) {
      selectedQuestions = [...selectedQuestions, ...pool].slice(0, modeCount);
    }
    
    const finalQuestions = selectedQuestions.map(q => {
      const optionsWithIndex = q.options.map((opt, i) => ({ text: opt, isCorrect: i === q.correct }));
      const shuffledOptions = optionsWithIndex.sort(() => 0.5 - Math.random());
      return {
        ...q,
        options: shuffledOptions.map(o => o.text),
        correct: shuffledOptions.findIndex(o => o.isCorrect)
      };
    });

    setQuestions(finalQuestions);
    setCurrentIndex(0);
    setAnswers({});
    setScore(0);
    setShowExplanation(false);
    setLives(5);
    setTimeSpent(0);

    setUsedFiftyFifty(false);
    setUsedBonus(false);
    setHiddenOptions([]);
    
    setTimeLeft(finalQuestions.length * 60); 
    setCurrentScreen('quiz');
  };

  const handleAnswer = (optionIndex, isBonus = false) => {
    if (answers[currentIndex] !== undefined) return;
    
    const isCorrect = optionIndex === questions[currentIndex].correct;
    const isUjian = modeCount === 50;

    setAnswers(prev => ({ ...prev, [currentIndex]: optionIndex }));
    
    const point = 100 / questions.length; 

    if (isCorrect) {
      playSound('correct'); 
      if (!isUjian) {
        if (isBonus) {
          speakText("Bantuan bonus digunakan! Jawaban otomatis benar. Pembahasan: " + questions[currentIndex].explanation);
        } else {
          speakText("Luar Biasa, Jawaban Benar! Pembahasan: " + questions[currentIndex].explanation);
        }
      }
      
      setScore(prev => prev + point);
      setShowExplanation(true);
    } else {
      playSound('wrong'); 
      if (!isUjian) {
        const newLives = lives - 1;
        setLives(newLives);
        setShowExplanation(true);
        
        if (newLives > 1) {
          speakText(`Belum tepat! Pembahasan: ` + questions[currentIndex].explanation);
        } else if (newLives === 1) {
          speakText(`Belum tepat! Peringatan, sisa hati kamu tinggal satu! Pembahasan: ` + questions[currentIndex].explanation);
        } else {
          speakText(`Sayang sekali, hati kamu habis! Permainan selesai. Pembahasan: ` + questions[currentIndex].explanation);
          setTimeout(() => finishQuiz(false), 4500);
        }
      } else {
        setShowExplanation(true);
      }
    }
  };

  const handleNext = () => {
    playSound('click');
    stopVoiceOver();
    
    setHiddenOptions([]); 

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setShowExplanation(false);
    } else {
      finishQuiz(true);
    }
  };

  const onClickFiftyFifty = () => {
    if (answers[currentIndex] !== undefined) return;
    
    if (usedFiftyFifty) {
      speakText("Maaf, Bantuan lima puluh lima puluh sudah habis!");
      return;
    }
    
    setUsedFiftyFifty(true);
    playSound('click');
    
    const q = questions[currentIndex];
    let incorrectIndices = [0, 1, 2, 3].filter(i => i !== q.correct);
    incorrectIndices = incorrectIndices.sort(() => 0.5 - Math.random()).slice(0, 2);
    
    setHiddenOptions(incorrectIndices);
    speakText("Bantuan 50 50 digunakan. Dua pilihan yang salah telah dihilangkan.");
  };

  const onClickBonus = () => {
    if (answers[currentIndex] !== undefined) return;
    
    if (usedBonus) {
      speakText("Maaf, Bantuan bonus sudah habis!");
      return;
    }
    
    setUsedBonus(true);
    handleAnswer(questions[currentIndex].correct, true);
  };

  const finishQuiz = async (completed) => {
    stopVoiceOver(); 
    playSound(score >= 50 ? 'win' : 'click');
    setCurrentScreen('result');

    if (fb && firebaseUser && score > 0) {
      setIsSubmitting(true);
      try {
        const { db } = fb;
        const currentSubject = subject?.toUpperCase() || 'UMUM';
        // Unique ID based on name, school, grade, and subject
        const docId = `${userProfile.name}_${userProfile.school}_${userProfile.grade}_${currentSubject}`.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const docRef = doc(db, 'leaderboard', docId);

        await runTransaction(db, async (transaction) => {
          const sfDoc = await transaction.get(docRef);
          if (!sfDoc.exists()) {
            transaction.set(docRef, {
              userId: firebaseUser.uid,
              name: userProfile.name,
              school: userProfile.school,
              grade: userProfile.grade,
              subject: currentSubject,
              mode: `${modeCount} Soal`,
              score: score,
              timeSpent: timeSpent,
              date: new Date().toISOString()
            });
          } else {
            const oldData = sfDoc.data();
            transaction.update(docRef, {
              score: (oldData.score || 0) + score,
              timeSpent: (oldData.timeSpent || 0) + timeSpent,
              date: new Date().toISOString(),
              mode: `${modeCount} Soal (Update)`
            });
          }
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'leaderboard');
      }
      setIsSubmitting(false);
    }
  };

  const resetToHome = () => {
    playSound('click');
    stopVoiceOver();
    setSubject(null);
    setCurrentScreen('home');
  };

  const handleLogout = () => {
    playSound('click');
    stopVoiceOver();
    localStorage.removeItem('osn_profile'); 
    setUserProfile({ name: '', school: '', grade: '' }); 
    setCurrentScreen('login'); 
  };

  const formatTime = (seconds) => {
    if (seconds <= 0) return "00:00";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const isUjianActive = currentScreen === 'quiz' && modeCount === 50;

  const renderLogin = () => (
    <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto animate-fade-in-up">
      <Mascot mood="welcome" text="Selamat datang, Calon Juara OSN 2026!" />
      <div className="glass-panel p-8 rounded-[2rem] shadow-2xl w-full mt-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>
        <h2 className="text-3xl font-black text-center text-gray-800 dark:text-white mb-6">Profil Siswa</h2>
        
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Nama Lengkap</label>
            <input required type="text" value={userProfile.name} onChange={e => setUserProfile({...userProfile, name: e.target.value})}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all dark:bg-gray-800 dark:text-white" placeholder="Cth: Budi Santoso" />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Asal Sekolah</label>
            <input required type="text" value={userProfile.school} onChange={e => setUserProfile({...userProfile, school: e.target.value})}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all dark:bg-gray-800 dark:text-white" placeholder="Cth: SDN 1 Jakarta" />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Kelas</label>
            <select value={userProfile.grade} onChange={e => setUserProfile({...userProfile, grade: e.target.value})}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all dark:bg-gray-800 dark:text-white">
              <option value="">Pilih Kelas</option>
              <option value="4">Kelas 4 SD</option>
              <option value="5">Kelas 5 SD</option>
              <option value="6">Kelas 6 SD</option>
            </select>
          </div>
          <button type="submit" className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-lg py-4 rounded-xl shadow-lg transform transition hover:-translate-y-1 mt-4">
            Mulai Belajar 🚀
          </button>
        </form>
      </div>
    </div>
  );

  const renderHome = () => (
    <div className="flex flex-col items-center w-full max-w-5xl mx-auto space-y-10 animate-fade-in-up">
      <div className="text-center space-y-4">
        <div className="inline-block px-4 py-1 bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-black rounded-full text-sm shadow-md mb-2">
          Edisi Silabus 2026
        </div>
        <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 drop-shadow-sm leading-tight pb-2">
          OSN Smart Kids
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-300 font-medium">
          Halo, <span className="font-bold text-purple-600 dark:text-purple-400">{userProfile.name}</span> dari {userProfile.school}! Siap raih medali emas?
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full px-4">
        {[
          { id: 'matematika', title: 'Matematika', desc: 'Pecahan, FPB KPK, Logika', icon: IconMath, color: 'from-blue-500 to-cyan-500', shadow: 'shadow-blue-500/40' },
          { id: 'ipa', title: 'Ilmu Pengetahuan Alam', desc: 'Tubuh Manusia, Tata Surya', icon: IconIpa, color: 'from-emerald-400 to-teal-500', shadow: 'shadow-emerald-500/40' },
          { id: 'ips', title: 'Ilmu Pengetahuan Sosial', desc: 'Sejarah, Geografi, ASEAN', icon: IconIps, color: 'from-orange-400 to-red-500', shadow: 'shadow-orange-500/40' }
        ].map((item) => (
          <button key={item.id} onClick={() => { playSound('click'); setSubject(item.id); setCurrentScreen('setup'); }}
            className={`relative group overflow-hidden rounded-[2.5rem] p-8 text-left text-white transition-all duration-300 transform hover:scale-105 hover:-translate-y-2 shadow-xl ${item.shadow} bg-gradient-to-br ${item.color}`}>
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white opacity-20 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
            <div className="relative z-10 flex flex-col h-full justify-between">
              <div className="bg-white/20 w-20 h-20 rounded-2xl flex items-center justify-center backdrop-blur-md mb-6 shadow-inner">
                <item.icon />
              </div>
              <div>
                <h2 className="text-3xl font-black tracking-tight mb-2 leading-none">{item.title}</h2>
                <p className="text-white/80 font-medium text-sm line-clamp-2">{item.desc}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="flex justify-center mt-4">
        <button onClick={() => setCurrentScreen('leaderboard')} className="flex items-center gap-3 bg-white dark:bg-gray-800 text-gray-800 dark:text-white px-8 py-4 rounded-full font-black text-lg shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-1 border border-gray-100 dark:border-gray-700">
          <span className="text-2xl">🏆</span> Klasemen Nasional
        </button>
      </div>
    </div>
  );

  const renderSetup = () => (
    <div className="w-full max-w-3xl mx-auto glass-panel p-8 md:p-12 rounded-[3rem] shadow-2xl animate-fade-in-up">
      <div className="flex justify-between items-center mb-8">
        <button onClick={() => setCurrentScreen('home')} className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-5 py-2 rounded-full font-bold hover:bg-gray-300 transition-colors">
          ← Kembali
        </button>
        <h2 className="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-500 capitalize">
          Persiapan {subject}
        </h2>
      </div>

      <div className="space-y-8">
        <div>
          <h3 className="text-lg font-bold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
            <span>📝</span> Pilih Mode Soal
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { val: 10, title: 'MENU LATIHAN', desc: '10 Soal' },
              { val: 20, title: 'MENU PRA', desc: '20 Soal' },
              { val: 50, title: 'MENU UJIAN', desc: '50 Soal' }
            ].map(mode => (
              <button key={mode.val} onClick={() => { playSound('click'); setModeCount(mode.val); }}
                className={`p-4 flex flex-col items-center rounded-2xl font-black transition-all border-4 ${modeCount === mode.val ? 'bg-purple-100 border-purple-500 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-white border-transparent text-gray-500 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400'}`}>
                <span className="text-lg md:text-xl">{mode.title}</span>
                <span className="text-sm font-bold opacity-70">{mode.desc}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-bold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
            <span>🎯</span> Tingkat Kesulitan
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {['mudah', 'sedang', 'sulit', 'campuran'].map(diff => (
              <button key={diff} onClick={() => { playSound('click'); setDifficulty(diff); }}
                className={`py-3 rounded-2xl font-bold capitalize transition-all border-2 ${difficulty === diff ? 'bg-indigo-100 border-indigo-500 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' : 'bg-white border-transparent text-gray-500 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400'}`}>
                {diff}
              </button>
            ))}
          </div>
        </div>

        <button onClick={startQuiz} className="w-full bg-gradient-to-r from-green-400 to-emerald-600 hover:from-green-500 hover:to-emerald-700 text-white font-black text-2xl py-5 rounded-[2rem] shadow-xl transform transition hover:-translate-y-1 mt-4">
          MULAI UJIAN SEKARANG
        </button>
      </div>
    </div>
  );

  const renderQuiz = () => {
    if (questions.length === 0) return <div>Loading...</div>;
    const q = questions[currentIndex];
    const hasAnswered = answers[currentIndex] !== undefined;
    const isCorrect = answers[currentIndex] === q.correct;
    const progress = ((currentIndex) / questions.length) * 100;
    const isUjian = modeCount === 50;

    return (
      <div className="w-full max-w-4xl mx-auto space-y-6 animate-fade-in-up">
        <div className="glass-panel p-4 rounded-3xl shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white px-5 py-2 rounded-full font-black shadow-md">
              Soal {currentIndex + 1} / {questions.length}
            </div>
            <div className="text-sm font-bold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full">
              {q.category}
            </div>
          </div>
          
          <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
            {!isUjian && (
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(i => <IconHeart key={i} active={i <= lives} />)}
              </div>
            )}
            <div className={`font-mono text-2xl font-black px-4 py-1 rounded-xl shadow-inner ${timeLeft <= 60 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-gray-800 text-green-400'}`}>
              {formatTime(timeLeft)}
            </div>
            <div className="font-black text-2xl text-yellow-500 drop-shadow-sm flex items-center gap-1">
              ⭐ {score}
            </div>
          </div>
        </div>

        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden shadow-inner">
          <div className="bg-gradient-to-r from-blue-400 via-indigo-500 to-purple-600 h-full transition-all duration-700 ease-out" style={{ width: `${progress}%` }}></div>
        </div>

        <div className="glass-panel p-8 md:p-12 rounded-[3rem] shadow-xl relative overflow-hidden">
          <h3 className="text-2xl md:text-4xl font-bold text-gray-800 dark:text-white mb-6 leading-snug">
            {q.text}
          </h3>

          {!hasAnswered && !isUjian && (
            <div className="flex flex-wrap justify-center gap-4 mb-8">
              <button 
                onClick={onClickFiftyFifty}
                className={`px-5 py-2 rounded-full font-bold shadow-md transition-all flex items-center gap-2 border-2 ${usedFiftyFifty ? 'bg-gray-100 border-gray-300 text-gray-400 dark:bg-gray-800 dark:border-gray-700 cursor-not-allowed opacity-70' : 'bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100 hover:scale-105 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300'}`}
              >
                <span className="text-xl">⚖️</span> 50 : 50
              </button>
              <button 
                onClick={onClickBonus}
                className={`px-5 py-2 rounded-full font-bold shadow-md transition-all flex items-center gap-2 border-2 ${usedBonus ? 'bg-gray-100 border-gray-300 text-gray-400 dark:bg-gray-800 dark:border-gray-700 cursor-not-allowed opacity-70' : 'bg-pink-50 border-pink-200 text-pink-600 hover:bg-pink-100 hover:scale-105 dark:bg-pink-900/30 dark:border-pink-700 dark:text-pink-300'}`}
              >
                <span className="text-xl">🎁</span> Bonus Jawaban
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {q.options.map((opt, idx) => {
              if (hiddenOptions.includes(idx)) {
                return (
                  <div key={idx} className="relative p-5 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 opacity-40 flex items-center gap-4 pointer-events-none">
                     <span className="shrink-0 flex items-center justify-center w-10 h-10 rounded-full text-base font-black bg-gray-200 dark:bg-gray-700 text-gray-400">
                        {['A', 'B', 'C', 'D'][idx]}
                     </span>
                     <span className="text-gray-400 italic font-medium">Pilihan dihilangkan</span>
                  </div>
                );
              }

              let btnClass = "bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:border-purple-300 hover:bg-purple-50 dark:hover:bg-gray-700 shadow-sm";
              
              if (hasAnswered) {
                if (idx === q.correct) {
                  btnClass = "bg-green-500 border-green-600 text-white transform scale-[1.02] shadow-lg ring-4 ring-green-200 dark:ring-green-900";
                } else if (idx === answers[currentIndex]) {
                  btnClass = "bg-red-500 border-red-600 text-white shadow-md opacity-90";
                } else {
                  btnClass = "opacity-40 grayscale bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800";
                }
              }

              const letters = ['A', 'B', 'C', 'D'];
              return (
                <button key={idx} disabled={hasAnswered} onClick={() => handleAnswer(idx)}
                  className={`relative p-5 rounded-2xl text-left font-bold text-lg md:text-xl transition-all duration-300 flex items-start gap-4 ${btnClass}`}>
                  <span className={`shrink-0 flex items-center justify-center w-10 h-10 rounded-full text-base font-black ${hasAnswered && idx === q.correct ? 'bg-white text-green-600' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300'}`}>
                    {letters[idx]}
                  </span>
                  <span className="mt-1">{opt}</span>
                </button>
              );
            })}
          </div>

          {showExplanation && (
            <div className="mt-10 animate-fade-in-up">
              <div className={`p-6 rounded-3xl ${isCorrect ? 'bg-green-50 border border-green-200 dark:bg-green-900/20' : 'bg-red-50 border border-red-200 dark:bg-red-900/20'}`}>
                <div className="flex items-center gap-3 font-black mb-3 text-xl">
                  {isCorrect ? <span className="text-3xl">🎉</span> : <span className="text-3xl">💪</span>}
                  <span className={isCorrect ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}>
                    {isCorrect ? 'Luar Biasa! Jawaban Benar!' : 'Belum Tepat!'}
                  </span>
                </div>
                {!isUjian && (
                  <p className="text-gray-700 dark:text-gray-200 font-medium text-lg leading-relaxed">
                    <span className="font-bold bg-yellow-200 dark:bg-yellow-800/50 px-2 rounded">Pembahasan:</span> {q.explanation}
                  </p>
                )}
              </div>

              <div className="mt-8 flex justify-end">
                <button onClick={handleNext}
                  className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-8 py-4 rounded-full font-black text-lg shadow-xl hover:scale-105 transition-transform flex items-center gap-2">
                  {currentIndex < questions.length - 1 ? 'Lanjut Soal Berikutnya ➡️' : 'Lihat Skor Akhir 🏆'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderResult = () => {
    const totalCorrect = Object.keys(answers).filter(k => answers[k] === questions[k].correct).length;
    const isPerfect = totalCorrect === questions.length;
    
    return (
      <div className="flex flex-col items-center w-full max-w-3xl mx-auto animate-fade-in-up">
        {isPerfect && <Confetti />}
        
        <div className="glass-panel p-10 md:p-14 rounded-[3rem] shadow-2xl w-full text-center relative border-t-[12px] border-t-purple-500 overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-purple-100 dark:bg-purple-900/20 rounded-full blur-3xl -z-10"></div>
          
          <Mascot mood={isPerfect ? 'cool' : totalCorrect > questions.length/2 ? 'excited' : 'sad'} />
          
          <h2 className="text-4xl md:text-5xl font-black mt-6 text-gray-800 dark:text-white">Ujian Selesai!</h2>
          <p className="text-gray-500 font-bold mt-2 mb-8 text-lg">{userProfile.name} • {userProfile.school}</p>

          <div className="bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-[2rem] p-8 mb-8 border border-gray-200 dark:border-gray-700 shadow-inner">
            <div className="text-gray-500 font-black tracking-widest uppercase mb-2">Total Skor</div>
            <div className="text-7xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 drop-shadow-md">
              {score}
            </div>
            {isSubmitting ? (
              <div className="mt-4 text-sm text-purple-500 animate-pulse font-bold">Sedang menyimpan skor ke server nasional...</div>
            ) : (
              <div className="mt-4 text-sm text-green-500 font-bold">✓ Skor tersimpan di Leaderboard</div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 mb-10">
             <div className="bg-green-100 dark:bg-green-900/30 p-4 rounded-2xl">
                <div className="text-green-600 dark:text-green-400 font-black text-xl mb-1">Benar</div>
                <div className="text-4xl font-black text-green-700 dark:text-green-300">{totalCorrect}</div>
             </div>
             <div className="bg-red-100 dark:bg-red-900/30 p-4 rounded-2xl">
                <div className="text-red-600 dark:text-red-400 font-black text-xl mb-1">Salah</div>
                <div className="text-4xl font-black text-red-700 dark:text-red-300">{questions.length - totalCorrect}</div>
             </div>
          </div>

          <div className="flex flex-col md:flex-row justify-center gap-4">
            <button onClick={() => startQuiz()} className="bg-indigo-500 hover:bg-indigo-600 text-white px-8 py-4 rounded-full font-bold shadow-lg transition-transform hover:-translate-y-1">
              🔄 Coba Lagi
            </button>
            <button onClick={() => setCurrentScreen('leaderboard')} className="bg-yellow-400 hover:bg-yellow-500 text-yellow-900 px-8 py-4 rounded-full font-bold shadow-lg transition-transform hover:-translate-y-1">
              🏆 Lihat Peringkat
            </button>
            <button onClick={resetToHome} className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white hover:bg-gray-300 px-8 py-4 rounded-full font-bold shadow-md transition-transform hover:-translate-y-1">
              🏠 Beranda
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderLeaderboard = () => (
    <div className="w-full max-w-4xl mx-auto glass-panel p-6 md:p-10 rounded-[3rem] shadow-2xl animate-fade-in-up flex flex-col h-[85vh]">
      <div className="flex justify-between items-center mb-8 shrink-0">
        <div>
          <h2 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 to-orange-500 flex items-center gap-3">
            🏆 Klasemen Nasional
          </h2>
          <p className="text-sm font-bold text-gray-500 dark:text-gray-400 mt-1">Real-time OSN Smart Kids 2026</p>
        </div>
        <button onClick={() => setCurrentScreen('home')} className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-6 py-3 rounded-full font-bold hover:bg-gray-300 transition-colors">
          Tutup
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-6 animate-fade-in shrink-0">
        {['SEMUA', 'MATEMATIKA', 'IPA', 'IPS'].map((subj) => (
          <button
            key={subj}
            onClick={() => setLeaderboardSubject(subj)}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
              leaderboardSubject === subj
                ? 'bg-indigo-500 text-white shadow-md scale-105'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {subj}
          </button>
        ))}
      </div>

      <div className="flex-grow overflow-y-auto custom-scrollbar pr-2 space-y-3">
        {leaderboardData.length === 0 ? (
           <div className="text-center text-gray-500 py-10 font-bold">Belum ada data. Jadilah yang pertama!</div>
        ) : (
          leaderboardData.map((entry, idx) => (
            <div key={entry.id || idx} className={`flex flex-col md:flex-row items-start md:items-center justify-between p-4 md:p-5 rounded-2xl transition-transform hover:scale-[1.01] ${idx === 0 ? 'bg-gradient-to-r from-yellow-100 to-yellow-50 border-2 border-yellow-400 dark:from-yellow-900/40 dark:to-transparent' : idx === 1 ? 'bg-gradient-to-r from-gray-100 to-gray-50 border-2 border-gray-300 dark:from-gray-800 dark:to-transparent' : idx === 2 ? 'bg-gradient-to-r from-orange-100 to-orange-50 border-2 border-orange-300 dark:from-orange-900/30 dark:to-transparent' : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700'}`}>
              
              <div className="flex items-center gap-4 w-full md:w-auto mb-3 md:mb-0">
                <div className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center font-black text-xl shadow-inner ${idx === 0 ? 'bg-yellow-400 text-white' : idx === 1 ? 'bg-gray-400 text-white' : idx === 2 ? 'bg-orange-400 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                  {idx + 1}
                </div>
                <div>
                  <div className="font-black text-gray-800 dark:text-white text-lg md:text-xl flex items-center gap-2">
                    {entry.name} {idx === 0 && '👑'}
                  </div>
                  <div className="text-sm text-gray-500 font-bold">{entry.school} • Kelas {entry.grade}</div>
                </div>
              </div>

              <div className="flex items-center justify-between w-full md:w-auto gap-6 ml-16 md:ml-0 bg-gray-50 dark:bg-gray-900/50 p-2 md:p-3 rounded-xl">
                <div className="text-center">
                  <div className="text-xs font-bold text-gray-400 uppercase">Mapel</div>
                  <div className="font-bold text-sm text-indigo-500">{entry.subject}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold text-gray-400 uppercase">Mode</div>
                  <div className="font-bold text-sm text-gray-600 dark:text-gray-300">{entry.mode}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-gray-400 uppercase">Skor</div>
                  <div className="text-2xl font-black text-purple-600 dark:text-purple-400 leading-none">{entry.score}</div>
                </div>
              </div>
              
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen w-full transition-colors duration-500 font-sans ${darkMode ? 'dark bg-[#0f172a]' : 'bg-[#f4f6f8]'}`}>
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-purple-400 rounded-full mix-blend-multiply filter blur-[100px] opacity-40 dark:opacity-20 animate-float"></div>
        <div className="absolute top-40 -left-40 w-[500px] h-[500px] bg-yellow-400 rounded-full mix-blend-multiply filter blur-[100px] opacity-40 dark:opacity-20 animate-float" style={{animationDelay: '2s'}}></div>
        <div className="absolute -bottom-40 left-1/2 w-[500px] h-[500px] bg-pink-400 rounded-full mix-blend-multiply filter blur-[100px] opacity-40 dark:opacity-20 animate-float" style={{animationDelay: '4s'}}></div>
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <header className="w-full p-4 md:px-8 md:py-5 flex justify-between items-center bg-white/50 dark:bg-gray-900/50 backdrop-blur-xl border-b border-white/20 z-50 sticky top-0 shadow-sm">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => {
            if (isUjianActive) return;
            if (userProfile.name) resetToHome();
          }}>
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white w-10 h-10 rounded-xl flex items-center justify-center font-black text-xl shadow-lg transform group-hover:rotate-12 transition-transform">
              OSN
            </div>
            <span className="font-black text-xl text-gray-800 dark:text-white hidden md:block tracking-tight">Smart Kids 2026</span>
          </div>
          
          <div className="flex items-center gap-4">
            {!isUjianActive && userProfile.name && (
              <div className="flex items-center gap-2">
                <div className="hidden md:block text-sm font-bold text-gray-500 dark:text-gray-400 bg-white/50 dark:bg-gray-800/50 px-4 py-2 rounded-full border border-gray-200 dark:border-gray-700">
                  👤 {userProfile.name}
                </div>
                <button onClick={handleLogout}
                  className="text-sm font-bold text-red-500 bg-red-50 dark:bg-red-900/30 px-4 py-2 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors border border-red-200 dark:border-red-800 shadow-sm"
                  title="Ganti Akun"
                >
                  🚪 Keluar
                </button>
              </div>
            )}
            <button onClick={() => { playSound('click'); setDarkMode(!darkMode); }}
              className="w-12 h-12 flex items-center justify-center rounded-full bg-white dark:bg-gray-800 shadow-md hover:shadow-lg hover:scale-105 transition-all text-xl border border-gray-100 dark:border-gray-700">
              {darkMode ? '☀️' : '🌙'}
            </button>
          </div>
        </header>

        <main className="flex-grow flex items-center justify-center p-4 md:p-8">
          {currentScreen === 'login' && renderLogin()}
          {currentScreen === 'home' && renderHome()}
          {currentScreen === 'setup' && renderSetup()}
          {currentScreen === 'quiz' && renderQuiz()}
          {currentScreen === 'result' && renderResult()}
          {currentScreen === 'leaderboard' && renderLeaderboard()}
        </main>
        
        <footer className="w-full text-center p-6 bg-white/30 dark:bg-gray-900/30 backdrop-blur-md">
          <p className="text-sm font-bold text-gray-500 dark:text-gray-400">
            Dikembangkan Oleh Adi Agus Prihartanto,S.Kom untuk membantu Persiapan Olimpiade Sains Nasional Tingkat SD
          </p>
        </footer>
      </div>
    </div>
  );
}