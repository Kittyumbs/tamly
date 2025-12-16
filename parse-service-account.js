// Script để tạo FIREBASE_SERVICE_ACCOUNT_KEY từ Firebase Service Account JSON
// Run: node parse-service-account.js <path-to-json-file>

const fs = require('fs');

function createFirebaseServiceAccountKey(jsonPath) {
    try {
        const jsonContent = fs.readFileSync(jsonPath, 'utf8');
        const serviceAccount = JSON.parse(jsonContent);

        // Tạo .env content với FIREBASE_SERVICE_ACCOUNT_KEY
        const envContent = `# Firebase Admin SDK - Service Account JSON as string
FIREBASE_SERVICE_ACCOUNT_KEY=${JSON.stringify(serviceAccount)}

# Google Drive API - OAuth credentials (điền thủ công)
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET
GOOGLE_REFRESH_TOKEN=YOUR_GOOGLE_REFRESH_TOKEN

# Server
PORT=3000`;

        fs.writeFileSync('.env', envContent);
        console.log('✅ Đã tạo file .env với FIREBASE_SERVICE_ACCOUNT_KEY');
        console.log('🔧 Bạn cần điền thêm Google Drive OAuth credentials');

    } catch (error) {
        console.error('❌ Lỗi khi parse service account JSON:', error.message);
        console.log('\n📝 Cách sử dụng:');
        console.log('1. Download Firebase Service Account JSON từ Firebase Console');
        console.log('2. Chạy: node parse-service-account.js path/to/serviceAccount.json');
        console.log('3. Điền thêm GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN');
    }
}

// Auto-detect nếu có file JSON trong thư mục
const jsonFiles = fs.readdirSync('.').filter(file => file.endsWith('.json'));
if (jsonFiles.length > 0) {
    console.log('🔍 Tìm thấy file JSON:', jsonFiles);
    const jsonFile = jsonFiles.find(file => file.includes('firebase') || file.includes('service'));
    if (jsonFile) {
        console.log(`📄 Sử dụng file: ${jsonFile}`);
        createFirebaseServiceAccountKey(jsonFile);
    } else {
        console.log('📄 Sử dụng file đầu tiên:', jsonFiles[0]);
        createFirebaseServiceAccountKey(jsonFiles[0]);
    }
} else {
    console.log('📄 Không tìm thấy file JSON nào trong thư mục hiện tại');
    console.log('📝 Hướng dẫn:');
    console.log('1. Download Firebase Service Account JSON');
    console.log('2. Đặt file vào thư mục này');
    console.log('3. Chạy lại script: node parse-service-account.js');
}

// Nếu có argument từ command line
if (process.argv[2]) {
    createFirebaseServiceAccountKey(process.argv[2]);
}
