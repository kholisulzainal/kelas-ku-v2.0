# PANDUAN INTEGRASI GOOGLE APPS SCRIPT & WEBHOOK (HYBRID TRACKING TAHAP 2)

Panduan ini berisi langkah-langkah dan skrip **Google Apps Script** untuk menghubungkan Google Form dengan aplikasi **Kelas Ku**. Saat siswa menyelesaikan dan mengirim jawaban Google Form, skrip ini akan secara otomatis mengirimkan Email Siswa, ID Tugas (`assignment_id`), dan Skor Nilai ke Endpoint Webhook Aplikasi.

---

## 1. PENYIAPAN DI GOOGLE FORM & GOOGLE SHEETS

1. Buka **Google Form** tugas yang telah dibuat.
2. Masuk ke menu **Setelan (Settings)** Google Form:
   - Aktifkan **"Jadikan ini sebagai kuis" (Make this a quiz)** agar Google Form menghasilkan nilai/skor otomatis.
   - Di bagian **Respon (Responses)**, atur **"Kumpulkan alamat email" (Collect email addresses)** menjadi **Verified** atau **Input Pengguna**. (Email ini digunakan untuk mengidentifikasi akun siswa).
3. Pindah ke tab **Jawaban (Responses)**, lalu klik ikon **"Hubungkan ke Spreadsheet" (Link to Sheets)** untuk membuat Google Sheets penampung respon.

---

## 2. MEMASANG SKRIP DI GOOGLE SHEETS (APPS SCRIPT)

1. Di Google Sheets penampung respon tersebut, klik menu **Ekstensi (Extensions)** -> **Apps Script**.
2. Hapus semua kode default yang ada di editor Apps Script.
3. Salin (*copy*) dan tempel (*paste*) kode JavaScript berikut:

```javascript
/**
 * GOOGLE APPS SCRIPT - HYBRID TRACKING TAHAP 2 (KELAS KU)
 * Skrip ini akan terpicu secara otomatis saat siswa mengirimkan Google Form.
 */

// CONFIGURATION
var WEBHOOK_URL = "https://YOUR-APP-URL.run.app/api/webhook/google-form"; // Ganti dengan URL aplikasi Kelas Ku Anda
var WEBHOOK_SECRET = "kelasku-secret-key"; // Sesuaikan dengan WEBHOOK_SECRET di .env aplikasi
var ASSIGNMENT_ID = "PASTE-ASSIGNMENT-ID-DISINI"; // ID Tugas dari aplikasi Kelas Ku

function onFormSubmit(e) {
  try {
    if (!e) {
      Logger.log("Event object 'e' null. Jalankan fungsi ini melalui pemicu Form Submit.");
      return;
    }

    var itemResponses = e.response.getItemResponses();
    var studentEmail = e.response.getRespondentEmail(); // Email siswa yang terverifikasi
    
    // Jika getRespondentEmail() kosong, cari dari jawaban pertanyaan email
    if (!studentEmail) {
      for (var i = 0; i < itemResponses.length; i++) {
        var title = itemResponses[i].getItem().getTitle().toLowerCase();
        if (title.indexOf("email") !== -1) {
          studentEmail = itemResponses[i].getResponse();
          break;
        }
      }
    }

    // Mengambil nilai / skor otomatis dari Google Form Quiz
    var scoreText = "0";
    if (typeof e.response.getGradableItemResponses === "function") {
      var totalScore = 0;
      var maxScore = 0;
      var gradables = e.response.getGradableItemResponses();
      for (var j = 0; j < gradables.length; j++) {
        totalScore += gradables[j].getScore() || 0;
      }
      scoreText = String(totalScore);
    }

    // Jika e.values tersedia dari Spreadsheet trigger
    if (e.values && e.values.length > 1) {
      // e.values[1] biasanya adalah Email atau Skor pada sheet respon
      var possibleScore = e.values[1] || e.values[2];
      if (possibleScore && (possibleScore.indexOf("/") !== -1 || !isNaN(parseFloat(possibleScore)))) {
        scoreText = possibleScore;
      }
    }

    Logger.log("Mengarahkan webhook untuk Email: " + studentEmail + " | Score: " + scoreText + " | Assignment ID: " + ASSIGNMENT_ID);

    var payload = {
      "student_email": studentEmail,
      "assignment_id": ASSIGNMENT_ID,
      "score_text": String(scoreText)
    };

    var options = {
      "method": "post",
      "contentType": "application/json",
      "headers": {
        "x-webhook-secret": WEBHOOK_SECRET
      },
      "payload": JSON.stringify(payload),
      "muteHttpExceptions": true
    };

    var response = UrlFetchApp.fetch(WEBHOOK_URL, options);
    Logger.log("Webhook Response Code: " + response.getResponseCode());
    Logger.log("Webhook Response Body: " + response.getContentText());

  } catch (error) {
    Logger.log("Error pada onFormSubmit: " + error.toString());
  }
}
```

---

## 3. MEMBUAT PEMICU (TRIGGER) "ON FORM SUBMIT"

1. Di panel sebelah kiri Google Apps Script, klik ikon **Jam / Pemicu (Triggers)** (ikon berbentuk jam waker).
2. Klik tombol **"+ Tambah Pemicu" (+ Add Trigger)** di kanan bawah.
3. Konfigurasikan pemicu sebagai berikut:
   - **Pilih fungsi yang akan dijalankan:** `onFormSubmit`
   - **Pilih penyebaran mana yang harus dijalankan:** `Head`
   - **Pilih sumber acara (Select event source):** `Dari formulir` (*From form*) atau `Dari spreadsheet` (*From spreadsheet*)
   - **Pilih jenis acara (Select event type):** `Saat mendaftar formulir` (*On form submit*)
4. Klik **Simpan (Save)** dan berikan izin akses (*Grant Permissions*) jika diminta oleh Google.

---

## 4. PENGUJIAN INTEGRASI
1. Buka Google Form sebagai siswa dan isi pertanyaan hingga selesai.
2. Tekan tombol **Kirim / Submit**.
3. Buka dashboard **Guru / Operator** pada aplikasi **Kelas Ku**.
4. Status pengerjaan siswa akan otomatis berubah menjadi **SELESAI** dan nilai/skor hasil parsing dari Google Form akan langsung muncul di sistem!
