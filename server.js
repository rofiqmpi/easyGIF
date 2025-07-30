const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// বডি পার্সার মিডলওয়্যার যোগ করা (বড় ফাইল আপলোডের জন্য)
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ limit: '200mb', extended: true }));

// সার্ভার টাইমআউট বাড়ানো (মিলিসেকেন্ডে)
app.use((req, res, next) => {
  req.setTimeout(300000); // 5 মিনিট
  res.setTimeout(300000); // 5 মিনিট
  next();
});

// মাল্টার কনফিগারেশন (ফাইল সাইজ লিমিট বাড়ানো)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 200 * 1024 * 1024 // 200MB
  },
  fileFilter: (req, file, cb) => {
    // ফাইল টাইপ ভ্যালিডেশন
    const allowedTypes = /jpeg|jpg|png|gif|mp4|webm|avi|mov|mkv|flv|wmv|mpg|3gp|ogv|mp3|wav|ogg|flac|aac|m4a|alac|opus|amr/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only image, video and audio files are allowed.'));
    }
  }
});

// আউটপুট ডিরেক্টরি তৈরি করুন
const outputDir = 'outputs/';
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

// কোর্স মিডলওয়্যার
app.use(cors());

// স্ট্যাটিক ফাইল পরিবেশন করুন
app.use(express.static(__dirname));

// রূপান্তর এন্ডপয়েন্ট
app.post('/convert', upload.single('file'), (req, res) => {
  if (!req.file || !req.body.format) {
    return res.status(400).send('File and format are required');
  }
  
  const inputPath = req.file.path;
  const outputFormat = req.body.format.toLowerCase();
  const outputPath = `${outputDir}${Date.now()}.${outputFormat}`;
  
  // অডিও ফরম্যাট চেক করুন
  const audioFormats = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'alac', 'opus', 'amr'];
  const imageFormats = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'tiff', 'svg', 'avif', 'ico', 'gif'];
  
  let command = ffmpeg(inputPath);
  
  // অডিও ফরম্যাটে রূপান্তর
  if (audioFormats.includes(outputFormat)) {
    command = command.withAudioCodec('libmp3lame');
    if (outputFormat !== 'mp3') {
      command = command.toFormat(outputFormat);
    }
  }
  // ইমেজ ফরম্যাটে রূপান্তর
  else if (imageFormats.includes(outputFormat)) {
    command = command.frames(1); // প্রথম ফ্রেম নিন
  }
  
  command
    .on('error', (err) => {
      console.error('Error:', err);
      res.status(500).send('Conversion failed: ' + err.message);
    })
    .on('end', () => {
      // আউটপুট ফাইল পাঠান
      res.download(outputPath, (err) => {
        if (err) {
          console.error('Download error:', err);
        }
        // টেম্পোরারি ফাইল মুছুন
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);
      });
    })
    .save(outputPath);
});

// এরর হ্যান্ডলিং মিডলওয়্যার
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// সার্ভার শুরু করুন
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
